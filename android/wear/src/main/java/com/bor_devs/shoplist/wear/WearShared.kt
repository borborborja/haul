package com.bor_devs.shoplist.wear

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Data Layer paths/keys shared with the phone (must match WearBridge on :app). */
object WearPaths {
    const val LIST = "/haul/list"
    const val TOGGLE = "/haul/toggle"
    const val REQUEST = "/haul/request"
    const val KEY_LIST_NAME = "listName"
    const val KEY_TS = "ts"
    const val KEY_ITEMS = "items"
}

@Serializable
data class WItem(
    val id: String,
    val name: String,
    val category: String = "other",
    val checked: Boolean = false,
)

data class WearSnapshot(val listName: String, val items: List<WItem>)

/** Process-wide holder of the latest list snapshot (updated by the listener service). */
object WearRepo {
    private val json = Json { ignoreUnknownKeys = true }
    val snapshot = MutableStateFlow<WearSnapshot?>(null)

    fun apply(listName: String, itemsJson: String) {
        val items = runCatching { json.decodeFromString<List<WItem>>(itemsJson) }.getOrDefault(emptyList())
        snapshot.value = WearSnapshot(listName, items)
    }

    /** Optimistically flip an item so it leaves the pending list immediately. */
    fun optimisticToggle(id: String) {
        val s = snapshot.value ?: return
        snapshot.value = s.copy(items = s.items.map { if (it.id == id) it.copy(checked = !it.checked) else it })
    }
}
