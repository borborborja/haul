package com.bor_devs.shoplist.data.prefs

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.bor_devs.shoplist.domain.AppMode
import com.bor_devs.shoplist.domain.AuthState
import com.bor_devs.shoplist.domain.CachedItem
import com.bor_devs.shoplist.domain.SavedList
import com.bor_devs.shoplist.domain.SortOrder
import com.bor_devs.shoplist.domain.SyncHistoryItem
import com.bor_devs.shoplist.domain.ThemeMode
import com.bor_devs.shoplist.domain.ViewMode
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/** All persisted preferences, mirroring the web Zustand `partialize`. */
@Singleton
class SettingsDataStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val json: Json,
) {
    private object Keys {
        val SERVER_URL = stringPreferencesKey("server_url")
        val WIZARD_DONE = booleanPreferencesKey("wizard_done")
        val THEME = stringPreferencesKey("theme")
        val APP_LANG = stringPreferencesKey("app_lang") // null = follow system locale
        val APP_MODE = stringPreferencesKey("app_mode")
        val VIEW_MODE = stringPreferencesKey("view_mode")
        val SORT_ORDER = stringPreferencesKey("sort_order")
        val SHOW_COMPLETED_INLINE = booleanPreferencesKey("show_completed_inline")
        val NOTIFY_ADD = booleanPreferencesKey("notify_add")
        val NOTIFY_CHECK = booleanPreferencesKey("notify_check")
        val AUTO_CLEAR = booleanPreferencesKey("auto_clear_enabled")
        val AUTO_CLEAR_SCHEDULED = stringPreferencesKey("auto_clear_scheduled")  // epoch millis as string
        val AUTO_CLEAR_MINUTES = stringPreferencesKey("auto_clear_minutes")       // int as string
        val LIST_NAME = stringPreferencesKey("list_name")

        val SYNC_CODE = stringPreferencesKey("sync_code")
        val SYNC_RECORD_ID = stringPreferencesKey("sync_record_id")
        val SYNC_HISTORY = stringPreferencesKey("sync_history")

        // v2 multi-list
        val ACTIVE_LIST_ID = stringPreferencesKey("active_list_id")
        val LISTS = stringPreferencesKey("lists_json")
        val LIST_CACHES = stringPreferencesKey("list_caches_json")

        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val AUTH_MODEL = stringPreferencesKey("auth_model")
    }

    @kotlinx.serialization.Serializable
    private data class AuthModel(
        val id: String? = null,
        val email: String? = null,
        val displayName: String? = null,
        val accountType: String? = null,
        val collectionName: String? = null,
    )

    val data: Flow<Settings> = context.appDataStore.data.map { p ->
        Settings(
            serverUrl = p[Keys.SERVER_URL] ?: "",
            wizardDone = p[Keys.WIZARD_DONE] ?: false,
            theme = runCatching { ThemeMode.valueOf(p[Keys.THEME] ?: "LIGHT") }.getOrDefault(ThemeMode.LIGHT),
            appLang = p[Keys.APP_LANG],
            appMode = runCatching { AppMode.valueOf(p[Keys.APP_MODE] ?: "PLANNING") }.getOrDefault(AppMode.PLANNING),
            viewMode = runCatching { ViewMode.valueOf(p[Keys.VIEW_MODE] ?: "LIST") }.getOrDefault(ViewMode.LIST),
            sortOrder = runCatching { SortOrder.valueOf(p[Keys.SORT_ORDER] ?: "CATEGORY") }.getOrDefault(SortOrder.CATEGORY),
            showCompletedInline = p[Keys.SHOW_COMPLETED_INLINE] ?: false,
            notifyOnAdd = p[Keys.NOTIFY_ADD] ?: true,
            notifyOnCheck = p[Keys.NOTIFY_CHECK] ?: true,
            autoClearEnabled = p[Keys.AUTO_CLEAR] ?: true,
            autoClearScheduled = p[Keys.AUTO_CLEAR_SCHEDULED]?.toLongOrNull() ?: 0L,
            autoClearMinutes = p[Keys.AUTO_CLEAR_MINUTES]?.toIntOrNull() ?: 60,
            listName = p[Keys.LIST_NAME],
            syncCode = p[Keys.SYNC_CODE],
            syncRecordId = p[Keys.SYNC_RECORD_ID],
            syncHistory = p[Keys.SYNC_HISTORY]?.let {
                runCatching { json.decodeFromString<List<SyncHistoryItem>>(it) }.getOrDefault(emptyList())
            } ?: emptyList(),
            authToken = p[Keys.AUTH_TOKEN],
            auth = p[Keys.AUTH_MODEL]?.let {
                runCatching { json.decodeFromString<AuthModel>(it) }.getOrNull()
            }?.toAuthState() ?: AuthState(),
            activeListId = p[Keys.ACTIVE_LIST_ID] ?: "default",
            lists = p[Keys.LISTS]?.let {
                runCatching { json.decodeFromString<List<SavedList>>(it) }.getOrNull()
            } ?: emptyList(),
            listCaches = p[Keys.LIST_CACHES]?.let {
                runCatching { json.decodeFromString<Map<String, List<CachedItem>>>(it) }.getOrNull()
            } ?: emptyMap(),
        )
    }

    suspend fun snapshot(): Settings = data.first()

    suspend fun setServerUrl(url: String) = edit { it[Keys.SERVER_URL] = url }
    suspend fun setWizardDone(done: Boolean) = edit { it[Keys.WIZARD_DONE] = done }
    suspend fun setTheme(theme: ThemeMode) = edit { it[Keys.THEME] = theme.name }
    suspend fun setAppLang(code: String?) = edit { if (code == null) it.remove(Keys.APP_LANG) else it[Keys.APP_LANG] = code }
    suspend fun setAppMode(mode: AppMode) = edit { it[Keys.APP_MODE] = mode.name }
    suspend fun setViewMode(mode: ViewMode) = edit { it[Keys.VIEW_MODE] = mode.name }
    suspend fun setSortOrder(order: SortOrder) = edit { it[Keys.SORT_ORDER] = order.name }
    suspend fun setShowCompletedInline(v: Boolean) = edit { it[Keys.SHOW_COMPLETED_INLINE] = v }
    suspend fun setNotifyOnAdd(v: Boolean) = edit { it[Keys.NOTIFY_ADD] = v }
    suspend fun setNotifyOnCheck(v: Boolean) = edit { it[Keys.NOTIFY_CHECK] = v }
    suspend fun setAutoClearEnabled(v: Boolean) = edit { it[Keys.AUTO_CLEAR] = v }
    suspend fun setAutoClearScheduled(ts: Long) = edit { it[Keys.AUTO_CLEAR_SCHEDULED] = ts.toString() }
    suspend fun setAutoClearMinutes(minutes: Int) = edit { it[Keys.AUTO_CLEAR_MINUTES] = minutes.toString() }

    suspend fun setListName(name: String?) = edit {
        if (name == null) it.remove(Keys.LIST_NAME) else it[Keys.LIST_NAME] = name
    }

    suspend fun setSync(code: String?, recordId: String?) = edit {
        if (code == null) it.remove(Keys.SYNC_CODE) else it[Keys.SYNC_CODE] = code
        if (recordId == null) it.remove(Keys.SYNC_RECORD_ID) else it[Keys.SYNC_RECORD_ID] = recordId
    }

    suspend fun setSyncHistory(history: List<SyncHistoryItem>) = edit {
        it[Keys.SYNC_HISTORY] = json.encodeToString(history)
    }

    suspend fun setActiveListId(id: String) = edit { it[Keys.ACTIVE_LIST_ID] = id }
    suspend fun setLists(lists: List<SavedList>) = edit { it[Keys.LISTS] = json.encodeToString(lists) }
    suspend fun setListCaches(caches: Map<String, List<CachedItem>>) = edit {
        it[Keys.LIST_CACHES] = json.encodeToString(caches)
    }

    suspend fun setAuth(token: String?, id: String?, email: String?, displayName: String?, accountType: String?, collectionName: String?) =
        edit {
            if (token == null) it.remove(Keys.AUTH_TOKEN) else it[Keys.AUTH_TOKEN] = token
            it[Keys.AUTH_MODEL] = json.encodeToString(
                AuthModel(id, email, displayName, accountType, collectionName)
            )
        }

    suspend fun clearAuth() = edit {
        it.remove(Keys.AUTH_TOKEN)
        it.remove(Keys.AUTH_MODEL)
    }

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.appDataStore.edit(block)
    }

    private fun AuthModel.toAuthState() = AuthState(
        isLoggedIn = accountType == "account",
        email = email,
        userId = id,
        username = displayName,
    )
}

data class Settings(
    val serverUrl: String,
    val wizardDone: Boolean,
    val theme: ThemeMode,
    val appLang: String? = null, // null = follow device locale
    val appMode: AppMode,
    val viewMode: ViewMode,
    val sortOrder: SortOrder,
    val showCompletedInline: Boolean,
    val notifyOnAdd: Boolean,
    val notifyOnCheck: Boolean,
    val autoClearEnabled: Boolean,
    val autoClearScheduled: Long,
    val autoClearMinutes: Int,
    val listName: String?,
    val syncCode: String?,
    val syncRecordId: String?,
    val syncHistory: List<SyncHistoryItem>,
    val authToken: String?,
    val auth: AuthState,
    val activeListId: String = "default",
    val lists: List<SavedList> = emptyList(),
    val listCaches: Map<String, List<CachedItem>> = emptyMap(),
)
