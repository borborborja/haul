package com.bor_devs.shoplist.wear

import com.bor_devs.shoplist.data.repo.ShopRepository
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WearServiceEntryPoint {
    fun shopRepository(): ShopRepository
    fun wearBridge(): WearBridge
}

/** Receives toggle / refresh requests from the watch and applies them via the repo. */
class WearMessageService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        val ep = EntryPointAccessors.fromApplication(applicationContext, WearServiceEntryPoint::class.java)
        when (event.path) {
            "/haul/toggle" -> {
                val id = String(event.data)
                if (id.isNotBlank()) ep.shopRepository().toggleCheck(id)
            }
            "/haul/request" -> {
                val repo = ep.shopRepository()
                ep.wearBridge().pushSnapshot(repo.listName.value, repo.items.value)
            }
        }
    }
}
