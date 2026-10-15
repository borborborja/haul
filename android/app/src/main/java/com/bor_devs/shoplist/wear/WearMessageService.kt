package com.bor_devs.shoplist.wear

import com.bor_devs.shoplist.data.repo.ShopRepository
import com.bor_devs.shoplist.data.local.AppDatabase
import com.bor_devs.shoplist.di.AppScope
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@EntryPoint
@InstallIn(SingletonComponent::class)
interface WearServiceEntryPoint {
    fun shopRepository(): ShopRepository
    fun wearBridge(): WearBridge
    fun appDatabase(): AppDatabase
    @AppScope fun appScope(): CoroutineScope
}

/** Receives toggle / refresh requests from the watch and applies them via the repo. */
class WearMessageService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        val ep = EntryPointAccessors.fromApplication(applicationContext, WearServiceEntryPoint::class.java)
        if (event.path != "/haul/toggle" && event.path != "/haul/request") return
        ep.appScope().launch {
            val repo = ep.shopRepository()
            // A Data Layer message can start the process without an Activity.
            // Restore auth/list state before mutating or replying to the watch.
            repo.initialize()
            if (event.path == "/haul/toggle") {
                val id = event.data.toString(Charsets.UTF_8)
                if (id.isNotBlank()) repo.toggleCheck(id).join()
            }
            val items = ep.appDatabase().itemDao().getAll().map { it.toDomain() }
            ep.wearBridge().pushSnapshot(repo.listName.value, items)
        }
    }
}
