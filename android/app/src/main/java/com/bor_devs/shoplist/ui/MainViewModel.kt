package com.bor_devs.shoplist.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bor_devs.shoplist.data.prefs.Settings
import com.bor_devs.shoplist.data.prefs.SettingsDataStore
import com.bor_devs.shoplist.data.repo.ShopRepository
import com.bor_devs.shoplist.domain.AppMode
import com.bor_devs.shoplist.domain.SortOrder
import com.bor_devs.shoplist.domain.ThemeMode
import com.bor_devs.shoplist.domain.ViewMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    val repo: ShopRepository,
    private val prefs: SettingsDataStore,
) : ViewModel() {

    val settings = prefs.data.stateIn(
        viewModelScope, SharingStarted.Eagerly,
        Settings(
            serverUrl = "", wizardDone = false, theme = ThemeMode.LIGHT, lang = com.bor_devs.shoplist.domain.Lang.CA,
            appMode = AppMode.PLANNING, viewMode = ViewMode.LIST, sortOrder = SortOrder.CATEGORY,
            showCompletedInline = false, notifyOnAdd = true, notifyOnCheck = true,
            autoClearEnabled = true, autoClearScheduled = 0L, autoClearMinutes = 60,
            listName = null, syncCode = null, syncRecordId = null,
            syncHistory = emptyList(), authToken = null, auth = com.bor_devs.shoplist.domain.AuthState(),
        ),
    )

    val items = repo.items
    val categories = repo.categories
    val sync = repo.sync
    val listName = repo.listName
    val lists = repo.lists
    val activeListId = repo.activeListId
    val listCounts = repo.listCounts
    val activeUsers = repo.activeUsers
    val serverName = repo.serverName
    val enableUsernames = repo.enableUsernames

    /** A sync code received from a deep link, surfaced to open the join flow. */
    val pendingJoinCode = MutableStateFlow<String?>(null)

    init {
        viewModelScope.launch { repo.initialize() }
    }

    fun onResume() = repo.checkAndAutoClear()

    // ---- Deep links ----
    fun onDeepLink(uriString: String?) {
        viewModelScope.launch {
            com.bor_devs.shoplist.util.parseServerOverride(uriString)?.let { repo.applyServer(it) }
            com.bor_devs.shoplist.util.parseSyncCode(uriString)?.let { pendingJoinCode.value = it }
        }
    }
    fun consumePendingCode() { pendingJoinCode.value = null }

    // ---- Item actions ----
    fun addItem(name: String, category: String? = null) = repo.addItem(name, category)
    fun toggleCheck(id: String) = repo.toggleCheck(id)
    fun deleteItem(id: String) = repo.deleteItem(id)
    fun updateNote(id: String, note: String) = repo.updateNote(id, note)
    fun clearCompleted() = repo.clearCompleted()
    fun removeFromList(id: String) = repo.removeFromList(id)
    fun addBackToList(id: String) = repo.addBackToList(id)
    fun clearPreviouslyUsed(planning: Boolean) = repo.clearPreviouslyUsed(planning)
    fun setListName(name: String?) = repo.setListName(name)

    // ---- Categories ----
    fun addCategory(key: String, icon: String) = repo.addCategory(key, icon)
    fun removeCategory(key: String) = repo.removeCategory(key)
    fun addCategoryItem(catKey: String, name: String) = repo.addCategoryItem(catKey, name)
    fun removeCategoryItem(catKey: String, name: String) = repo.removeCategoryItem(catKey, name)

    // ---- Preferences ----
    fun setTheme(theme: ThemeMode) = launch { prefs.setTheme(theme) }
    fun setLanguage(lang: com.bor_devs.shoplist.domain.Lang) = launch { prefs.setLanguage(lang) }
    fun setAppMode(mode: AppMode) = launch {
        // grid is shopping-only; fall back to compact in planning (mirrors web)
        if (mode == AppMode.PLANNING && settings.value.viewMode == ViewMode.GRID) prefs.setViewMode(ViewMode.COMPACT)
        prefs.setAppMode(mode)
    }
    fun setViewMode(mode: ViewMode) = launch { prefs.setViewMode(mode) }
    fun setSortOrder(order: SortOrder) = launch { prefs.setSortOrder(order) }
    fun setShowCompletedInline(v: Boolean) = launch { prefs.setShowCompletedInline(v) }
    fun setNotifyOnAdd(v: Boolean) = launch { prefs.setNotifyOnAdd(v) }
    fun setNotifyOnCheck(v: Boolean) = launch { prefs.setNotifyOnCheck(v) }
    fun setAutoClearEnabled(v: Boolean) = launch { prefs.setAutoClearEnabled(v) }
    fun scheduleAutoClear(minutes: Int = 60) = repo.scheduleAutoClear(minutes)
    fun cancelAutoClear() = repo.cancelAutoClear()

    // ---- Sync / server ----
    suspend fun testServer(url: String) = repo.testServer(url)
    fun applyServer(url: String) = launch { repo.applyServer(url) }
    fun useLocalMode() = launch { repo.useLocalMode() }
    fun createList(name: String) = repo.createList(name)

    // ---- Multi-list ("Les meves llistes") ----
    fun createLocalList(name: String, emoji: String = "🛒") = repo.createLocalList(name, emoji)
    fun switchList(id: String) = repo.switchList(id)
    fun deleteList(id: String) = repo.deleteList(id)
    fun setActiveListEmoji(emoji: String) = repo.setActiveListEmoji(emoji)

    suspend fun beginJoin(code: String) = repo.beginJoin(code)
    fun finishJoin(info: ShopRepository.JoinInfo, replace: Boolean) = repo.finishJoin(info, replace)
    fun rotateCode() = repo.rotateCode()
    fun disconnect() = repo.disconnect()

    // ---- Auth ----
    suspend fun claimAccount(email: String, password: String) = repo.claimAccount(email, password)
    suspend fun login(email: String, password: String) = repo.login(email, password)
    suspend fun recoverLists() = repo.recoverLists()
    fun logout(keepLocal: Boolean) = repo.logout(keepLocal)
    fun setUsername(name: String) = repo.setUsername(name)

    // ---- Backup ----
    suspend fun exportJson() = repo.exportJson()
    suspend fun importJson(text: String) = repo.importJson(text)
    fun resetLocal() = repo.resetLocal()

    private fun launch(block: suspend () -> Unit) = viewModelScope.launch { block() }
}
