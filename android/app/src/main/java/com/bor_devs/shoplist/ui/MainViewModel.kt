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
            serverUrl = "", wizardDone = false, theme = ThemeMode.LIGHT,
            appMode = AppMode.PLANNING, viewMode = ViewMode.LIST, sortOrder = SortOrder.CATEGORY,
            showCompletedInline = false, notifyOnAdd = true, notifyOnCheck = true,
            autoClearEnabled = true, autoClearScheduled = 0L, autoClearMinutes = 60,
            listName = null, syncCode = null, syncRecordId = null,
            syncHistory = emptyList(), authToken = null, auth = com.bor_devs.shoplist.domain.AuthState(),
        ),
    )

    val items = repo.items
    val categories = repo.categories
    val disabledProducts = repo.disabledProducts
    val disabledCategories = repo.disabledCategories
    val sync = repo.sync
    val listName = repo.listName
    val lists = repo.lists
    val activeListId = repo.activeListId
    val listCounts = repo.listCounts
    val activeUsers = repo.activeUsers
    val isGuest = repo.isGuest
    val shareMode = repo.shareMode
    val avatarUrl = repo.avatarUrl
    val avatarColor = repo.avatarColor
    val serverName = repo.serverName
    val enableUsernames = repo.enableUsernames
    val requireAccount = repo.requireAccount
    val registrationOpen = repo.registrationOpen
    val hasServer: Boolean get() = repo.hasServer

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
            val token = com.bor_devs.shoplist.util.parseShareToken(uriString)
            if (token != null) { repo.openSharedLink(token); return@launch }
            com.bor_devs.shoplist.util.parseSyncCode(uriString)?.let { pendingJoinCode.value = it }
        }
    }
    fun consumePendingCode() { pendingJoinCode.value = null }
    fun onShareLink(token: String) = repo.openSharedLink(token)

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
    fun deactivateProduct(item: com.bor_devs.shoplist.domain.LocalizedItem) = repo.deactivateProduct(item)
    fun reactivateProduct(item: com.bor_devs.shoplist.domain.LocalizedItem) = repo.reactivateProduct(item)
    fun deactivateCategory(key: String) = repo.deactivateCategory(key)
    fun reactivateCategory(key: String) = repo.reactivateCategory(key)

    // ---- Preferences ----
    fun setTheme(theme: ThemeMode) = launch { prefs.setTheme(theme) }
    fun setAppLang(code: String?) = launch { prefs.setAppLang(code) }
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

    // ---- Public link sharing ----
    fun serverBaseUrl() = repo.serverBaseUrl()
    suspend fun getShare() = repo.getShare()
    suspend fun setShare(mode: String, rotate: Boolean = false) = repo.setShare(mode, rotate)
    suspend fun revokeShare() = repo.revokeShare()

    // ---- Members / admins / avatar ----
    /** true = added, null = no account with that email, false = error. */
    suspend fun addAdmin(email: String): Boolean? = repo.addAdmin(email)
    suspend fun adminLink(): String? = repo.adminLink()
    suspend fun listMembers() = repo.listMembers()
    suspend fun removeMember(userId: String) = repo.removeMember(userId)
    val invites = repo.invites
    fun acceptInvite(id: String) = repo.acceptInvite(id)
    fun declineInvite(id: String) = repo.declineInvite(id)
    suspend fun uploadAvatar(bytes: ByteArray, filename: String, mime: String) = repo.uploadAvatar(bytes, filename, mime)
    suspend fun setAvatarColor(color: String) = repo.setAvatarColor(color)

    // ---- Auth ----
    suspend fun claimAccount(email: String, password: String) = repo.claimAccount(email, password)
    suspend fun login(email: String, password: String) = repo.login(email, password)
    suspend fun register(email: String, password: String) = repo.register(email, password)
    suspend fun recoverLists() = repo.recoverLists()
    fun logout(keepLocal: Boolean) = repo.logout(keepLocal)
    fun setUsername(name: String) = repo.setUsername(name)

    // ---- Backup ----
    suspend fun exportJson() = repo.exportJson()
    suspend fun importJson(text: String) = repo.importJson(text)
    fun resetLocal() = repo.resetLocal()

    private fun launch(block: suspend () -> Unit) = viewModelScope.launch { block() }
}
