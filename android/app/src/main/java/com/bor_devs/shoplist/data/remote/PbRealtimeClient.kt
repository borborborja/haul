package com.bor_devs.shoplist.data.remote

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

data class RealtimeEvent(val collection: String, val action: String, val record: JsonObject)

/**
 * PocketBase realtime over SSE. Connects to /api/realtime, captures the
 * clientId from the PB_CONNECT event, then POSTs the subscription set. Record
 * events are parsed and routed by `record.collectionName` (client-side
 * filtering by list mirrors the web's defensive guard, so no fragile
 * server-side filter encoding is needed). Reconnects with backoff.
 */
@Singleton
class PbRealtimeClient @Inject constructor(
    baseHttp: OkHttpClient,
    private val client: PocketBaseClient,
) {
    private val sseHttp: OkHttpClient = baseHttp.newBuilder()
        .readTimeout(0, TimeUnit.MILLISECONDS) // SSE stream stays open
        .retryOnConnectionFailure(true)
        .build()

    private val _events = MutableSharedFlow<RealtimeEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<RealtimeEvent> = _events

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var eventSource: EventSource? = null
    private var reconnectJob: Job? = null
    private var attempt = 0
    private var clientId: String? = null

    @Volatile private var subscriptions: List<String> = emptyList()
    @Volatile private var running = false

    fun start(subs: List<String>) {
        subscriptions = subs
        running = true
        connect()
    }

    fun stop() {
        running = false
        reconnectJob?.cancel()
        eventSource?.cancel()
        eventSource = null
        clientId = null
    }

    private fun connect() {
        if (!running || !client.hasServer) return
        eventSource?.cancel()
        val req = Request.Builder()
            .url(client.baseUrl + "/api/realtime")
            .header("Accept", "text/event-stream")
            .apply { client.token?.let { header("Authorization", it) } }
            .build()
        eventSource = EventSources.createFactory(sseHttp).newEventSource(req, listener)
    }

    private fun scheduleReconnect() {
        if (!running) return
        reconnectJob?.cancel()
        val backoff = minOf(30_000L, 1_000L * (1L shl minOf(attempt, 5)))
        attempt++
        reconnectJob = scope.launch {
            delay(backoff)
            if (running) connect()
        }
    }

    private fun submitSubscriptions() {
        val id = clientId ?: return
        scope.launch {
            runCatching {
                client.request("POST", "/api/realtime", buildJsonObject {
                    put("clientId", id)
                    put("subscriptions", buildJsonArray { subscriptions.forEach { add(JsonPrimitive(it)) } })
                })
            }.onFailure { Log.w(TAG, "submitSubscriptions failed: ${it.message}") }
        }
    }

    private val listener = object : EventSourceListener() {
        override fun onOpen(eventSource: EventSource, response: okhttp3.Response) {
            attempt = 0
        }

        override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
            if (data.isBlank()) return
            try {
                if (type == "PB_CONNECT") {
                    val obj = client.json.parseToJsonElement(data).jsonObject
                    clientId = obj["clientId"]?.jsonPrimitive?.content
                    submitSubscriptions()
                    return
                }
                val msg = client.json.decodeFromString(RealtimeMessage.serializer(), data)
                val record = msg.record ?: return
                val collection = record["collectionName"]?.jsonPrimitive?.content ?: return
                _events.tryEmit(RealtimeEvent(collection, msg.action, record))
            } catch (e: Exception) {
                Log.w(TAG, "Bad realtime event: ${e.message}")
            }
        }

        override fun onClosed(eventSource: EventSource) {
            if (running) scheduleReconnect()
        }

        override fun onFailure(eventSource: EventSource, t: Throwable?, response: okhttp3.Response?) {
            if (running) scheduleReconnect()
        }
    }

    companion object { private const val TAG = "PbRealtime" }
}
