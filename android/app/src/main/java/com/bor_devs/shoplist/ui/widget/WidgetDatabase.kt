package com.bor_devs.shoplist.ui.widget

import android.content.Context
import com.bor_devs.shoplist.data.local.AppDatabase
import com.bor_devs.shoplist.data.prefs.SettingsDataStore
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/**
 * Glance widgets run in the main app process but outside the Compose/ViewModel
 * tree, so they can't use constructor injection. We still want them to share the
 * SAME singletons as the app: a second Room instance would not propagate Room's
 * invalidation (the app's list would not refresh after a widget toggle), and a
 * second DataStore on the same file throws at runtime.
 *
 * Pull the singletons out of the Hilt graph via an EntryPoint instead.
 */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetEntryPoint {
    fun appDatabase(): AppDatabase
    fun settingsDataStore(): SettingsDataStore
}

private fun entryPoint(context: Context): WidgetEntryPoint =
    EntryPointAccessors.fromApplication(context.applicationContext, WidgetEntryPoint::class.java)

object WidgetDatabase {
    fun get(context: Context): AppDatabase = entryPoint(context).appDatabase()
    fun settings(context: Context): SettingsDataStore = entryPoint(context).settingsDataStore()
}

/** Read the list name from the app's shared DataStore. */
suspend fun getListName(context: Context): String? =
    runCatching { entryPoint(context).settingsDataStore().snapshot().listName }.getOrNull()
