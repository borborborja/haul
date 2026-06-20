package com.bor_devs.shoplist.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/** Receives the list snapshot the phone pushes and updates [WearRepo]. */
class ListListenerService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == WearPaths.LIST) {
                val map = DataMapItem.fromDataItem(event.dataItem).dataMap
                WearRepo.apply(
                    map.getString(WearPaths.KEY_LIST_NAME, "Haul"),
                    map.getString(WearPaths.KEY_ITEMS, "[]"),
                )
            }
        }
    }
}
