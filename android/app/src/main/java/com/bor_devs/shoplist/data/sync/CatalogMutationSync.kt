package com.bor_devs.shoplist.data.sync

import com.bor_devs.shoplist.data.local.CatalogMutationEntity
import com.bor_devs.shoplist.data.remote.PbException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import java.net.URLEncoder

/** Stateless transport: the durable row supplies identity after every restart. */
internal class CatalogMutationSync(
    private val transport: suspend (String, String, JsonObject?, String, String?) -> JsonObject,
    private val json: Json = Json,
) {
    suspend fun sync(row: CatalogMutationEntity, listId: String, token: String?): String {
        val base = "/api/collections/${row.collection}/records"
        suspend fun request(method: String, path: String, body: JsonObject? = null) = transport(method, path, body, row.origin, token)
        var remoteId = row.remoteId.ifBlank { row.entityId }
        val current = try { request("GET", "$base/$remoteId") } catch (e: com.bor_devs.shoplist.data.remote.PbException) { if (e.status == 404) null else throw e }
        val payload = json.decodeFromString<JsonObject>(row.payload)
        if (current != null && current["list"]?.jsonPrimitive?.content != listId) throw com.bor_devs.shoplist.data.remote.PbException(403, "Catalog record belongs to another list")
        if (row.deleted) {
            if (current != null) request("DELETE", "$base/$remoteId")
            else {
                findNaturalCatalogRecord(row, listId, token)?.let { existing ->
                    remoteId = existing["id"]!!.jsonPrimitive.content
                    request("DELETE", "$base/$remoteId")
                }
            }
            return remoteId
        }
        if (current != null) {
            try { request("PATCH", "$base/$remoteId", payload) }
            catch (e: PbException) {
                if (e.status != 400 && e.status != 409 || !row.collection.startsWith("list_disabled_")) throw e
                val existing = findNaturalCatalogRecord(row, listId, token) ?: throw e
                val adoptedId = existing["id"]!!.jsonPrimitive.content
                if (adoptedId == remoteId || existing["list"]?.jsonPrimitive?.content != listId) throw e
                request("DELETE", "$base/$remoteId")
                return adoptedId
            }
            return remoteId
        }
        findNaturalCatalogRecord(row, listId, token)?.let { return it["id"]!!.jsonPrimitive.content }
        val body = JsonObject(payload + mapOf("id" to JsonPrimitive(row.entityId), "list" to JsonPrimitive(listId)))
        return try { request("POST", base, body)["id"]!!.jsonPrimitive.content }
        catch (e: com.bor_devs.shoplist.data.remote.PbException) {
            if (e.status != 400 && e.status != 409) throw e
            val accepted = runCatching { request("GET", "$base/${row.entityId}") }.getOrNull() ?: findNaturalCatalogRecord(row, listId, token) ?: throw e
            if (accepted["list"]?.jsonPrimitive?.content != listId) throw e
            accepted["id"]!!.jsonPrimitive.content
        }
    }

    private suspend fun findNaturalCatalogRecord(row: CatalogMutationEntity, listId: String, token: String?): JsonObject? {
        val payload = json.decodeFromString<JsonObject>(row.payload)
        val keys = when (row.collection) { "list_categories" -> listOf("key"); "list_items" -> listOf("category_key", "name"); "list_disabled_categories" -> listOf("key"); else -> listOf("name") }
        val terms = listOf("list = ${JsonPrimitive(listId)}") + keys.map { "$it = ${payload[it]}" }
        val filter = URLEncoder.encode(terms.joinToString(" && "), "UTF-8")
        val page = transport("GET", "/api/collections/${row.collection}/records?perPage=1&filter=$filter", null, row.origin, token)
        return (page["items"] as? JsonArray)?.firstOrNull() as? JsonObject
    }

}
