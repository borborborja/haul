package com.bor_devs.shoplist.wear

import android.content.Context
import com.bor_devs.shoplist.domain.ShopItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class WItem(val id: String, val name: String, val category: String = "other", val checked: Boolean = false)

/** Pushes the active list snapshot to the paired Wear OS watch via the Data Layer. */
@Singleton
class WearBridge @Inject constructor(@ApplicationContext private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true }

    fun pushSnapshot(listName: String?, items: List<ShopItem>) {
        runCatching {
            val inList = items.filter { it.inList }.map { WItem(it.id, it.name, it.category, it.checked) }
            val req = PutDataMapRequest.create("/haul/list").apply {
                dataMap.putString("listName", listName ?: "Haul")
                dataMap.putLong("ts", System.currentTimeMillis())
                dataMap.putString("items", json.encodeToString(inList))
            }.asPutDataRequest().setUrgent()
            Wearable.getDataClient(context).putDataItem(req)
        }
    }
}
