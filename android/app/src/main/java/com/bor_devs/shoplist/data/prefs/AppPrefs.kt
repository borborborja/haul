package com.bor_devs.shoplist.data.prefs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

/**
 * The single Preferences DataStore for the whole process.
 *
 * DataStore enforces that only one instance may be active per file in a given
 * process. Both the main app (via [SettingsDataStore]) and the Glance widgets
 * run in the same process, so they MUST share this one delegate — declaring a
 * second `preferencesDataStore("shoplist_prefs")` elsewhere throws
 * "There are multiple DataStores active for the same file".
 */
val Context.appDataStore: DataStore<Preferences> by preferencesDataStore(name = "shoplist_prefs")
