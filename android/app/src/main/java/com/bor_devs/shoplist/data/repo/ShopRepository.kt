package com.bor_devs.shoplist.data.repo

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import com.bor_devs.shoplist.data.local.CategoryDao
import com.bor_devs.shoplist.data.local.CustomCategoryEntity
import com.bor_devs.shoplist.data.local.CustomItemEntity
import com.bor_devs.shoplist.data.local.DisabledDao
import com.bor_devs.shoplist.data.local.DisabledProductEntity
import com.bor_devs.shoplist.data.local.ItemDao
import com.bor_devs.shoplist.data.local.ItemEntity
import com.bor_devs.shoplist.data.prefs.Settings
import com.bor_devs.shoplist.data.prefs.SettingsDataStore
import com.bor_devs.shoplist.data.remote.ItemRecord
import com.bor_devs.shoplist.data.remote.PbRealtimeClient
import com.bor_devs.shoplist.data.remote.PocketBaseClient
import com.bor_devs.shoplist.data.remote.MemberDto
import com.bor_devs.shoplist.data.remote.RealtimeEvent
import com.bor_devs.shoplist.data.remote.ShareResponse
import com.bor_devs.shoplist.data.sync.SyncMeta
import com.bor_devs.shoplist.data.sync.WriteKind
import com.bor_devs.shoplist.data.sync.WriteOp
import com.bor_devs.shoplist.data.sync.WriteQueue
import com.bor_devs.shoplist.di.AppScope
import com.bor_devs.shoplist.domain.CachedItem
import com.bor_devs.shoplist.domain.Category
import com.bor_devs.shoplist.domain.DefaultCatalog
import com.bor_devs.shoplist.domain.LocalizedItem
import com.bor_devs.shoplist.domain.MsgType
import com.bor_devs.shoplist.domain.PresenceUser
import com.bor_devs.shoplist.domain.SavedList
import com.bor_devs.shoplist.domain.ShopItem
import com.bor_devs.shoplist.domain.SyncHistoryItem
import com.bor_devs.shoplist.domain.SyncState
import com.bor_devs.shoplist.ui.widget.WidgetUpdater
import com.bor_devs.shoplist.util.NotificationHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * App-wide shopping state and sync, the Kotlin counterpart of the web's
 * shopStore.ts + useListSync.ts. Items are persisted in Room (offline-first);
 * mutations are optimistic and reconciled through a retry [WriteQueue] and the
 * PocketBase realtime stream.
 */
@Singleton
class ShopRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val pb: PocketBaseClient,
    private val realtime: PbRealtimeClient,
    private val syncMeta: SyncMeta,
    private val prefs: SettingsDataStore,
    private val itemDao: ItemDao,
    private val categoryDao: CategoryDao,
    private val disabledDao: DisabledDao,
    private val wearBridge: com.bor_devs.shoplist.wear.WearBridge,
    private val notifications: NotificationHelper,
    @AppScope private val scope: CoroutineScope,
) {
    // ---- Observable state ----

    val items: StateFlow<List<ShopItem>> =
        itemDao.observeAll().map { list -> list.map { it.toDomain() } }
            .stateIn(scope, SharingStarted.Eagerly, emptyList())

    private val serverCatalog = MutableStateFlow<List<Category>>(emptyList())

    val categories: StateFlow<Map<String, Category>> = combine(
        serverCatalog,
        categoryDao.observeCategories(),
        categoryDao.observeItems(),
    ) { server, customCats, customItems ->
        buildCategories(server, customCats, customItems)
    }.stateIn(scope, SharingStarted.Eagerly, DefaultCatalog.byKey)

    /** Canonical keys of products deactivated for the active list (synced). */
    val disabledProducts: StateFlow<Set<String>> =
        disabledDao.observe().map { list -> list.map { it.name }.toSet() }
            .stateIn(scope, SharingStarted.Eagerly, emptySet())

    /** Keys of default categories hidden for the active list (synced, in-memory). */
    private val _disabledCategories = MutableStateFlow<Set<String>>(emptySet())
    val disabledCategories: StateFlow<Set<String>> = _disabledCategories

    /** Pending list invitations (added as admin by email) awaiting accept/decline. */
    private val _invites = MutableStateFlow<List<com.bor_devs.shoplist.data.remote.InviteDto>>(emptyList())
    val invites: StateFlow<List<com.bor_devs.shoplist.data.remote.InviteDto>> = _invites

    private val _sync = MutableStateFlow(SyncState())
    val sync: StateFlow<SyncState> = _sync

    private val _listName = MutableStateFlow<String?>(null)
    val listName: StateFlow<String?> = _listName

    private val _activeUsers = MutableStateFlow<List<PresenceUser>>(emptyList())
    val activeUsers: StateFlow<List<PresenceUser>> = _activeUsers

    /** True while the active list is a guest list (opened via a share link). */
    private val _isGuest = MutableStateFlow(false)
    val isGuest: StateFlow<Boolean> = _isGuest

    /** The active share link's mode ("read"|"shop"|"plan") when [isGuest]. */
    private val _shareMode = MutableStateFlow("")
    val shareMode: StateFlow<String> = _shareMode

    /** Current user's avatar file URL (absolute) and color hex, for Settings. */
    private val _avatarUrl = MutableStateFlow<String?>(null)
    val avatarUrl: StateFlow<String?> = _avatarUrl
    private val _avatarColor = MutableStateFlow<String?>(null)
    val avatarColor: StateFlow<String?> = _avatarColor

    val serverName = MutableStateFlow("ShoppingList")
    val enableUsernames = MutableStateFlow(false)
    val requireAccount = MutableStateFlow(false)
    val registrationOpen = MutableStateFlow(true)

    /** True when a server is configured (not local mode). */
    val hasServer: Boolean get() = pb.hasServer

    // ---- Multi-list ("Les meves llistes") ----
    val lists: StateFlow<List<SavedList>> =
        prefs.data.map { it.lists }.stateIn(scope, SharingStarted.Eagerly, emptyList())
    val activeListId: StateFlow<String> =
        prefs.data.map { it.activeListId }.stateIn(scope, SharingStarted.Eagerly, "default")

    /** done/total counts per list id (active list from live items, others from cache). */
    val listCounts: StateFlow<Map<String, Pair<Int, Int>>> = combine(prefs.data, items) { s, its ->
        s.lists.associate { l ->
            val pair = if (l.id == s.activeListId) {
                val a = its.filter { it.inList }; a.count { it.checked } to a.size
            } else {
                val a = (s.listCaches[l.id] ?: emptyList()).filter { it.inList }; a.count { it.checked } to a.size
            }
            l.id to pair
        }
    }.stateIn(scope, SharingStarted.Eagerly, emptyMap())

    private var listDataRef: JsonObject = JsonObject(emptyMap())
    private var realtimeJob: Job? = null
    private var presenceJob: Job? = null
    private var guestJob: Job? = null
    private var sessionUserId: String? = null

    // ---- Write queue (ported from itemWriteQueue.ts) ----

    private val itemQueue = WriteQueue(
        scope = scope,
        isOnline = { pb.hasServer && isNetworkAvailable() },
        execute = { op -> executeWrite(op) },
        onApplied = { op, result -> onWriteApplied(op, result) },
        onGaveUp = { op, error -> onWriteGaveUp(op, error) },
        shouldRetry = { error, _ ->
            val status = (error as? com.bor_devs.shoplist.data.remote.PbException)?.status ?: 0
            status == 0 || status >= 500
        },
    )

    private suspend fun executeWrite(op: WriteOp): Any? {
        syncMeta.beginWrite(op.recordId)
        try {
            return when (op.kind) {
                WriteKind.UPDATE -> pb.updateItem(op.recordId, mapToJson(op.body ?: emptyMap()))
                WriteKind.DELETE -> {
                    try {
                        pb.deleteItem(op.recordId)
                    } catch (e: com.bor_devs.shoplist.data.remote.PbException) {
                        if (!e.isNotFound) throw e // deleting something already gone is success
                    }
                    null
                }
            }
        } finally {
            syncMeta.endWrite(op.recordId)
        }
    }

    private fun onWriteApplied(op: WriteOp, result: Any?) {
        if (op.kind != WriteKind.UPDATE || result !is ItemRecord) return
        scope.launch {
            itemDao.getById(result.id)?.let {
                itemDao.upsert(it.copy(serverUpdated = SyncMeta.parsePbDate(result.updated), dirty = false))
            }
        }
    }

    private fun onWriteGaveUp(op: WriteOp, error: Throwable) {
        val status = (error as? com.bor_devs.shoplist.data.remote.PbException)?.status ?: 0
        scope.launch {
            if (status == 404) {
                itemDao.deleteById(op.recordId)
            } else if (op.kind == WriteKind.UPDATE) {
                Log.w(TAG, "Item write gave up, marking dirty: ${op.recordId}")
                itemDao.getById(op.recordId)?.let { itemDao.upsert(it.copy(dirty = true)) }
            }
        }
    }

    @Volatile private var settingsCache: com.bor_devs.shoplist.data.prefs.Settings? = null

    // ---- Initialization / session restore ----

    @Volatile private var initialized = false

    suspend fun initialize() {
        if (initialized) return
        initialized = true
        scope.launch { prefs.data.collect { settingsCache = it } }
        val s = prefs.snapshot()
        settingsCache = s
        if (s.serverUrl.isNotBlank()) pb.setBaseUrl(s.serverUrl)
        pb.setToken(s.authToken)
        sessionUserId = s.auth.userId
        _listName.value = s.listName
        _sync.update { it.copy(code = s.syncCode, recordId = s.syncRecordId, syncHistory = s.syncHistory) }

        // Seed multi-list state for first run / upgrade from single-list v1
        if (s.lists.isEmpty()) {
            prefs.setLists(listOf(SavedList("default", s.listName, "🛒", s.syncCode, s.syncRecordId, s.syncCode == null)))
            prefs.setActiveListId("default")
        }

        // Mirror the active list to the Wear OS companion on every change.
        scope.launch {
            combine(items, _listName) { its, name -> name to its }
                .collect { (name, its) -> wearBridge.pushSnapshot(name, its) }
        }

        if (!pb.hasServer) return // local mode
        ensureGuestSession()
        loadCatalog()
        reconcileAccountLists() // pull lists shared with this account (e.g. invited as admin)
        refreshInvites() // pending admin invitations awaiting accept/decline
        val active = s.lists.firstOrNull { it.id == s.activeListId }
        val guestToken = if (active != null && active.role == "guest") active.code else null
        when {
            guestToken != null -> connectAsGuest(guestToken, active?.recordId)
            s.syncRecordId != null -> connectToList(s.syncRecordId)
            s.syncCode != null -> runCatching { connectToList(pb.joinList(s.syncCode).id) }
            else -> syncActiveListToServer() // server present but list still local → auto-sync
        }
    }

    suspend fun ensureGuestSession(): Boolean {
        if (!pb.hasServer) return false
        if (!pb.token.isNullOrBlank()) {
            val refreshed = runCatching { pb.authRefresh("users") }.getOrNull()
            if (refreshed != null) {
                pb.setToken(refreshed.token); sessionUserId = refreshed.record.id
                persistAuth(refreshed); return true
            }
            pb.setToken(null)
        }
        return runCatching {
            val auth = pb.createGuest()
            pb.setToken(auth.token); sessionUserId = auth.record.id
            persistAuth(auth); true
        }.getOrDefault(false)
    }

    private suspend fun persistAuth(auth: com.bor_devs.shoplist.data.remote.AuthResponse) {
        prefs.setAuth(
            auth.token, auth.record.id, auth.record.email,
            auth.record.displayName, auth.record.accountType,
            auth.record.collectionName ?: "users",
        )
        _avatarUrl.value = auth.record.avatar.takeIf { it.isNotBlank() }
            ?.let { "${pb.baseUrl}/api/files/users/${auth.record.id}/$it" }
        _avatarColor.value = auth.record.avatarColor.ifBlank { null }
    }

    suspend fun loadCatalog() {
        runCatching {
            val cats = pb.getCatalogCategories()
            val products = pb.getCatalogItems()
            if (cats.isEmpty()) return@runCatching
            val map = LinkedHashMap<String, Category>()
            cats.forEach { map[it.key] = Category(it.key, it.icon, emptyList(), it.color.ifBlank { null }) }
            products.forEach { i ->
                val key = i.expand?.category?.key
                if (key != null) map[key]?.let { c ->
                    map[key] = c.copy(items = c.items + LocalizedItem(i.nameEs, i.nameCa.ifBlank { i.nameEs }, i.nameEn.ifBlank { i.nameEs }))
                }
            }
            serverCatalog.value = map.values.toList()
        }
        runCatching {
            val cfg = pb.getAppConfig()
            cfg.firstOrNull { it.key == "server_name" }?.value?.let { serverName.value = it.jsonPrimitive.content }
            cfg.firstOrNull { it.key == "enable_usernames" }?.value?.let { enableUsernames.value = parseBoolConfig(it) }
            requireAccount.value = cfg.firstOrNull { it.key == "require_account" }?.value?.let { parseBoolConfig(it) } ?: false
            registrationOpen.value = cfg.firstOrNull { it.key == "registration_open" }?.value?.let { parseBoolConfig(it) } ?: true
        }
    }

    /** Register a new account directly (the require_account wall). */
    suspend fun register(email: String, password: String): Boolean = runCatching {
        val auth = pb.register(email, password)
        pb.setToken(auth.token); sessionUserId = auth.record.id; persistAuth(auth); true
    }.getOrDefault(false)

    // ---- Item actions (ported from shopStore.ts) ----

    fun addItem(name: String, category: String? = null) = scope.launch {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return@launch
        val cat = category ?: DefaultCatalog.guessCategory(trimmed)
        guestToken()?.let { token ->
            if (_shareMode.value == "plan") runCatching { pb.publicAdd(token, trimmed, cat, myName()) }
            return@launch
        }
        val all = itemDao.getAll()
        val existing = all.firstOrNull { it.name.equals(trimmed, ignoreCase = true) }
        if (existing != null) {
            if (existing.inList && !existing.checked) return@launch
            val updated = existing.copy(inList = true, checked = false, category = cat, updatedAt = now())
            itemDao.upsert(updated)
            pushFieldUpdate(updated, mapOf("in_list" to true, "checked" to false, "category" to cat))
            notifyWidgets()
            return@launch
        }
        val tempId = "local_" + UUID.randomUUID()
        itemDao.upsert(ItemEntity(tempId, trimmed, false, "", cat, true, 0, now(), false))
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) {
            syncMeta.pendingCreates.add(tempId)
            try {
                val record = pb.createItem(createBody(recordId, trimmed, cat, false, "", true, tempId))
                swapTempId(tempId, record)
            } catch (e: Exception) {
                Log.e(TAG, "add failed, keeping local: ${e.message}")
            } finally {
                syncMeta.pendingCreates.remove(tempId)
            }
        }
        notifyWidgets()
    }

    fun toggleCheck(id: String) = scope.launch {
        val item = itemDao.getById(id) ?: return@launch
        guestToken()?.let { token ->
            if (_shareMode.value != "shop" && _shareMode.value != "plan") return@launch
            val updated = item.copy(checked = !item.checked, updatedAt = now())
            itemDao.upsert(updated); notifyWidgets()
            runCatching { pb.publicCheck(token, id, updated.checked, myName()) }
            return@launch
        }
        val updated = item.copy(checked = !item.checked, updatedAt = now())
        itemDao.upsert(updated)
        pushFieldUpdate(updated, mapOf("checked" to updated.checked))
        notifyWidgets()
    }

    fun deleteItem(id: String) = scope.launch {
        guestToken()?.let { token ->
            if (_shareMode.value != "plan") return@launch
            itemDao.deleteById(id); notifyWidgets()
            runCatching { pb.publicRemove(token, id) }
            return@launch
        }
        itemDao.deleteById(id)
        if (!id.startsWith("local_") && _sync.value.connected) itemQueue.enqueueDelete("shopping_items", id)
        notifyWidgets()
    }

    fun updateNote(id: String, note: String) = scope.launch {
        val item = itemDao.getById(id) ?: return@launch
        val updated = item.copy(note = note, updatedAt = now())
        itemDao.upsert(updated)
        pushFieldUpdate(updated, mapOf("note" to note))
    }

    fun removeFromList(id: String) = scope.launch {
        guestToken()?.let { token ->
            if (_shareMode.value != "plan") return@launch
            itemDao.deleteById(id); notifyWidgets()
            runCatching { pb.publicRemove(token, id) }
            return@launch
        }
        val item = itemDao.getById(id) ?: return@launch
        val updated = item.copy(inList = false, checked = false, updatedAt = now())
        itemDao.upsert(updated)
        pushFieldUpdate(updated, mapOf("in_list" to false, "checked" to false))
        notifyWidgets()
    }

    fun addBackToList(id: String) = scope.launch {
        val item = itemDao.getById(id) ?: return@launch
        val updated = item.copy(inList = true, checked = false, updatedAt = now())
        itemDao.upsert(updated)
        pushFieldUpdate(updated, mapOf("in_list" to true, "checked" to false))
        notifyWidgets()
    }

    fun clearCompleted() = scope.launch {
        val all = itemDao.getAll()
        val completed = all.filter { it.checked && it.inList }
        if (completed.isEmpty()) return@launch
        itemDao.upsertAll(completed.map { it.copy(checked = false, inList = false, updatedAt = now()) })
        notifyWidgets()
        val remote = completed.filter { !it.id.startsWith("local_") }.map { it.id }
        if (remote.isEmpty()) return@launch
        val body = mapOf<String, Any?>("in_list" to false, "checked" to false)
        if (!_sync.value.connected) { remote.forEach { markDirty(it) }; return@launch }
        if (remote.size == 1) { itemQueue.enqueueUpdate("shopping_items", remote[0], body); return@launch }
        remote.forEach { syncMeta.beginWrite(it) }
        try {
            if (!pb.batchUpdateItems(remote, mapToJson(body))) {
                remote.forEach { itemQueue.enqueueUpdate("shopping_items", it, body) }
            }
        } catch (e: Exception) {
            remote.forEach { itemQueue.enqueueUpdate("shopping_items", it, body) }
        } finally {
            remote.forEach { syncMeta.endWrite(it) }
        }
    }

    fun clearPreviouslyUsed(planning: Boolean) = scope.launch {
        val all = itemDao.getAll()
        val prev = all.filter { !it.inList || (planning && it.checked) }
        if (prev.isEmpty()) return@launch
        itemDao.deleteByIds(prev.map { it.id })
        if (!_sync.value.connected) return@launch
        val remote = prev.filter { !it.id.startsWith("local_") }.map { it.id }
        if (remote.isEmpty()) return@launch
        if (remote.size == 1) { itemQueue.enqueueDelete("shopping_items", remote[0]); return@launch }
        remote.forEach { syncMeta.beginWrite(it) }
        try {
            if (!pb.batchDeleteItems(remote)) remote.forEach { itemQueue.enqueueDelete("shopping_items", it) }
        } catch (e: Exception) {
            remote.forEach { itemQueue.enqueueDelete("shopping_items", it) }
        } finally {
            remote.forEach { syncMeta.endWrite(it) }
        }
    }

    /** Auto-clear stale completed items (>1h), called on resume. */
    fun checkAndAutoClear() = scope.launch {
        val s = settingsCache ?: return@launch
        if (!s.autoClearEnabled) return@launch
        val now = now()
        // Scheduled timer-based clear
        if (s.autoClearScheduled > 0L && now - s.autoClearScheduled >= s.autoClearMinutes * 60_000L) {
            clearCompleted()
            cancelAutoClear()
            return@launch
        }
        // Staleness-based clear (>1h since check)
        val oneHour = 60 * 60 * 1000L
        val hasStale = itemDao.getAll().any { it.checked && it.inList && it.updatedAt in 1 until (now - oneHour) }
        if (hasStale) clearCompleted()
    }

    fun scheduleAutoClear(minutes: Int = 60) = scope.launch {
        prefs.setAutoClearMinutes(minutes)
        prefs.setAutoClearScheduled(now())
    }

    fun cancelAutoClear() = scope.launch {
        prefs.setAutoClearScheduled(0L)
    }

    fun setListName(name: String?) = scope.launch {
        _listName.value = name
        prefs.setListName(name)
        upsertActiveListMeta()
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) {
            runCatching {
                val data = buildJsonObject {
                    listDataRef.forEach { (k, v) -> if (k != "listName") put(k, v) }
                    if (name == null) put("listName", JsonNull) else put("listName", name)
                }
                listDataRef = pb.updateListData(recordId, data).data ?: data
            }
        }
    }

    // ---- Category actions ----

    fun addCategory(key: String, icon: String) = scope.launch {
        categoryDao.upsertCategory(CustomCategoryEntity(key, icon))
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching { pb.createListCategory(recordId, key, icon) }
    }

    fun removeCategory(key: String) = scope.launch {
        categoryDao.deleteCategory(key)
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching {
            pb.getListCategories(recordId).firstOrNull { it.key == key }?.let { pb.deleteListCategory(it.id) }
        }
    }

    fun addCategoryItem(catKey: String, name: String) = scope.launch {
        addCustomItemLocal(catKey, name)
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching { pb.createListItem(recordId, catKey, name) }
    }

    fun removeCategoryItem(catKey: String, name: String) = scope.launch {
        categoryDao.deleteItemByName(catKey, name)
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching {
            pb.getListItems(recordId).firstOrNull { it.categoryKey == catKey && it.name == name }?.let { pb.deleteListItem(it.id) }
        }
    }

    // ---- Per-list product deactivation (synced) ----

    private fun canonicalKey(item: LocalizedItem): String =
        item.en.ifBlank { item.es.ifBlank { item.ca } }.trim().lowercase()

    private fun localizedVariants(item: LocalizedItem): Set<String> =
        setOf(item.en, item.es, item.ca).filter { it.isNotBlank() }.map { it.trim().lowercase() }.toSet()

    /** Deactivate a product for the active list: translucent in settings, removed from the list, synced. */
    fun deactivateProduct(item: LocalizedItem) = scope.launch {
        val key = canonicalKey(item)
        if (key.isBlank()) return@launch
        disabledDao.insert(DisabledProductEntity(key))
        val variants = localizedVariants(item)
        itemDao.getAll().filter { variants.contains(it.name.trim().lowercase()) }.forEach { deleteItem(it.id) }
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching { pb.createDisabledProduct(recordId, key) }
    }

    fun reactivateProduct(item: LocalizedItem) = scope.launch {
        val key = canonicalKey(item)
        disabledDao.deleteByName(key)
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching {
            pb.getListDisabledProducts(recordId).firstOrNull { it.name == key }?.let { pb.deleteDisabledProduct(it.id) }
        }
    }

    private suspend fun loadListDisabled(recordId: String) {
        runCatching {
            disabledDao.replaceAll(pb.getListDisabledProducts(recordId).map { DisabledProductEntity(it.name) })
        }
        runCatching {
            _disabledCategories.value = pb.getListDisabledCategories(recordId).map { it.key }.toSet()
        }
    }

    /** Hide a default category for the active list (synced). */
    fun deactivateCategory(key: String) = scope.launch {
        if (key.isBlank() || _disabledCategories.value.contains(key)) return@launch
        _disabledCategories.update { it + key }
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching { pb.createDisabledCategory(recordId, key) }
    }

    fun reactivateCategory(key: String) = scope.launch {
        _disabledCategories.update { it - key }
        val recordId = _sync.value.recordId
        if (_sync.value.connected && recordId != null) runCatching {
            pb.getListDisabledCategories(recordId).firstOrNull { it.key == key }?.let { pb.deleteDisabledCategory(it.id) }
        }
    }

    // ---- Multi-list switching ----

    /** Create a new local list and make it active (the "Nova llista" action). */
    fun createLocalList(name: String, emoji: String = "🛒") = scope.launch {
        val s = prefs.snapshot()
        snapshotActiveItems(s)
        val id = "list_" + UUID.randomUUID()
        val display = name.trim().ifBlank { null }
        prefs.setLists(s.lists + SavedList(id, display, emoji, null, null, true))
        prefs.setActiveListId(id)
        itemDao.clear()
        _listName.value = display; prefs.setListName(display)
        goLocal()
        prefs.setSync(null, null)
        notifyWidgets()
        // With a server configured, a new list is synced by default.
        if (pb.hasServer) syncActiveListToServer()
    }

    /** Make another saved list the active one, swapping items through the cache. */
    fun switchList(id: String) = scope.launch {
        val s = prefs.snapshot()
        if (id == s.activeListId) return@launch
        val target = s.lists.firstOrNull { it.id == id } ?: return@launch
        val caches = snapshotActiveItems(s).toMutableMap()
        val targetItems = caches.remove(id) ?: emptyList()
        prefs.setListCaches(caches)
        prefs.setActiveListId(id)
        itemDao.replaceAll(targetItems.map { it.toEntity() })
        _listName.value = target.name; prefs.setListName(target.name)
        prefs.setSync(target.code, target.recordId)
        if (target.role == "guest" && target.code != null) {
            connectAsGuest(target.code, target.recordId)
        } else if (pb.hasServer && target.recordId != null) {
            _sync.update { it.copy(connected = true, code = target.code, recordId = target.recordId, msg = "", msgType = MsgType.INFO) }
            connectToList(target.recordId)
        } else {
            goLocal(target.code, target.recordId)
            // Opening a never-synced list while a server exists syncs it (lazy).
            // (A list with a code but no recordId was synced before — don't duplicate it.)
            if (pb.hasServer && target.recordId == null && target.code == null) syncActiveListToServer()
        }
        notifyWidgets()
    }

    fun deleteList(id: String) = scope.launch {
        val s = prefs.snapshot()
        if (s.lists.size <= 1) return@launch
        val remaining = s.lists.filterNot { it.id == id }
        val caches = s.listCaches.toMutableMap(); caches.remove(id)
        if (id == s.activeListId) {
            val next = remaining.first()
            val nextItems = caches.remove(next.id) ?: emptyList()
            prefs.setLists(remaining); prefs.setListCaches(caches); prefs.setActiveListId(next.id)
            itemDao.replaceAll(nextItems.map { it.toEntity() })
            _listName.value = next.name; prefs.setListName(next.name); prefs.setSync(next.code, next.recordId)
            if (next.role == "guest" && next.code != null) {
                connectAsGuest(next.code, next.recordId)
            } else if (pb.hasServer && next.recordId != null) {
                _sync.update { it.copy(connected = true, code = next.code, recordId = next.recordId, msg = "", msgType = MsgType.INFO) }
                connectToList(next.recordId)
            } else {
                goLocal(next.code, next.recordId)
                if (pb.hasServer && next.recordId == null && next.code == null) syncActiveListToServer()
            }
            notifyWidgets()
        } else {
            prefs.setLists(remaining); prefs.setListCaches(caches)
        }
    }

    fun setActiveListEmoji(emoji: String) = scope.launch {
        val s = prefs.snapshot()
        prefs.setLists(s.lists.map { if (it.id == s.activeListId) it.copy(emoji = emoji) else it })
        val rid = _sync.value.recordId
        if (_sync.value.connected && rid != null) {
            runCatching { listDataRef = pb.updateListData(rid, JsonObject(listDataRef + mapOf("emoji" to JsonPrimitive(emoji)))).data ?: listDataRef }
        }
    }

    /** Snapshot the current active items into the DataStore cache; returns the new map. */
    private suspend fun snapshotActiveItems(s: Settings): Map<String, List<CachedItem>> {
        val caches = s.listCaches.toMutableMap()
        caches[s.activeListId] = itemDao.getAll().map { it.toCached() }
        prefs.setListCaches(caches)
        return caches
    }

    /** Stop realtime/presence and mark the active list local (optionally keeping linkage for re-join). */
    private fun goLocal(code: String? = null, recordId: String? = null) {
        stopGuest()
        realtime.stop(); realtimeJob?.cancel(); presenceJob?.cancel()
        _activeUsers.value = emptyList()
        scope.launch { disabledDao.clear() } // disabled set is per-list; local lists start empty
        _disabledCategories.value = emptySet()
        _sync.update { it.copy(connected = false, code = code, recordId = recordId, msg = "", msgType = MsgType.INFO) }
    }

    /** Keep the active SavedList's metadata aligned with the current name/sync linkage. */
    private suspend fun upsertActiveListMeta() {
        val s = prefs.snapshot()
        val activeId = s.activeListId
        if (s.lists.none { it.id == activeId }) return
        val name = _listName.value
        val code = _sync.value.code
        val recordId = _sync.value.recordId
        prefs.setLists(s.lists.map {
            if (it.id == activeId) it.copy(name = name, code = code, recordId = recordId, isLocal = code == null) else it
        })
    }

    // ---- Sync / connect ----

    fun createList(name: String) = scope.launch {
        if (!ensureGuestSession()) { setMsg("No server", MsgType.ERROR); return@launch }
        runCatching {
            val r = pb.createList(name)
            _listName.value = name; prefs.setListName(name)
            setConnected(r.inviteCode, r.id)
            addToHistory(r.inviteCode)
            connectToList(r.id)
        }.onFailure { setMsg("Error", MsgType.ERROR) }
    }

    /**
     * Lazy auto-sync: when a server is configured, promote the *current* local
     * list to a synced one (creates it on the server, keeping its name, and
     * pushes the local items via connectToList → pushPending). No-op without a
     * server or if the active list is already synced. This is what makes
     * "server ⇒ every list synced" hold without a manual "create shared" step.
     */
    private suspend fun syncActiveListToServer() {
        if (!pb.hasServer || _sync.value.recordId != null) return
        if (!ensureGuestSession()) return
        val name = _listName.value
        runCatching {
            val r = pb.createList(name?.ifBlank { null } ?: "Shopping list")
            setConnected(r.inviteCode, r.id)
            addToHistory(r.inviteCode)
            connectToList(r.id)
        }
    }

    /** Joins the list membership and reports whether local data would be affected. */
    suspend fun beginJoin(code: String): JoinInfo? {
        if (!ensureGuestSession()) return null
        val r = runCatching { pb.joinList(code.trim().uppercase()) }.getOrNull() ?: return null
        return JoinInfo(r.id, r.name, r.inviteCode.ifBlank { code.trim().uppercase() }, itemDao.getAll().isNotEmpty())
    }

    fun finishJoin(info: JoinInfo, replace: Boolean) = scope.launch {
        if (replace) itemDao.clear()
        _listName.value = info.name; prefs.setListName(info.name)
        setConnected(info.code, info.recordId)
        addToHistory(info.code)
        connectToList(info.recordId)
    }

    fun rotateCode() = scope.launch {
        val id = _sync.value.recordId ?: return@launch
        runCatching {
            val r = pb.rotateCode(id)
            _sync.update { it.copy(code = r.inviteCode) }
            prefs.setSync(r.inviteCode, id); addToHistory(r.inviteCode)
            upsertActiveListMeta()
        }
    }

    // ---- Public link sharing ----
    /** Base server URL, used to build the public /s/<token> link. */
    fun serverBaseUrl(): String = pb.baseUrl

    suspend fun getShare(): ShareResponse? {
        val id = _sync.value.recordId ?: return null
        return runCatching { pb.getShare(id) }.getOrNull()
    }

    suspend fun setShare(mode: String, rotate: Boolean = false): ShareResponse? {
        val id = _sync.value.recordId ?: return null
        return runCatching { pb.setShare(id, mode, rotate) }.getOrNull()
    }

    suspend fun revokeShare() {
        val id = _sync.value.recordId ?: return
        runCatching { pb.revokeShare(id) }
    }

    // ---- Members / admins ----

    /** Add an admin by email. true = added, null = no account with that email, false = error. */
    suspend fun addAdmin(email: String): Boolean? {
        val id = _sync.value.recordId ?: return false
        return runCatching {
            val r = pb.addAdmin(id, email.trim())
            if (r.noAccount) null else r.ok
        }.getOrDefault(false)
    }

    /** Generate/return the admin invite link ({origin}/s/<token>), or null if not allowed. */
    suspend fun adminLink(): String? {
        val id = _sync.value.recordId ?: return null
        return runCatching { "${pb.baseUrl}/s/${pb.adminLink(id).token}" }.getOrNull()
    }

    suspend fun listMembers(): List<MemberDto> {
        val id = _sync.value.recordId ?: return emptyList()
        return runCatching {
            pb.listMembers(id).map { it.copy(avatarUrl = absolutize(it.avatarUrl)) }
        }.getOrDefault(emptyList())
    }

    suspend fun removeMember(userId: String) {
        val id = _sync.value.recordId ?: return
        runCatching { pb.removeMember(id, userId) }
    }

    private fun absolutize(url: String): String =
        if (url.isBlank() || url.startsWith("http")) url else "${pb.baseUrl}$url"

    // ---- Avatar ----

    suspend fun uploadAvatar(bytes: ByteArray, filename: String, mime: String) {
        val uid = sessionUserId ?: return
        runCatching {
            val rec = pb.uploadAvatar(uid, bytes, filename, mime)
            _avatarUrl.value = rec.avatar.takeIf { it.isNotBlank() }?.let { "${pb.baseUrl}/api/files/users/$uid/$it" }
        }
    }

    suspend fun setAvatarColor(color: String) {
        val uid = sessionUserId ?: return
        _avatarColor.value = color
        runCatching { pb.setAvatarColor(uid, color) }
    }

    // ---- Guest lists (opened via a share link) ----

    private fun guestToken(): String? = if (_isGuest.value) _sync.value.code else null

    private fun stopGuest() {
        guestJob?.cancel(); guestJob = null
        _isGuest.value = false
        _shareMode.value = ""
    }

    /**
     * Open a share/admin link while signed in. Admin tokens make a full member
     * (normal authenticated sync); share tokens make a guest list driven by the
     * mode-gated public endpoints.
     */
    fun openSharedLink(token: String) = scope.launch {
        if (!ensureGuestSession()) { setMsg("No server", MsgType.ERROR); return@launch }
        val r = runCatching { pb.joinByToken(token) }.getOrNull()
        if (r == null || r.listId.isBlank()) { setMsg("Error", MsgType.ERROR); return@launch }

        val s = prefs.snapshot()
        snapshotActiveItems(s)
        val existing = s.lists.firstOrNull { it.recordId == r.listId }
        val localId = existing?.id ?: ("list_" + UUID.randomUUID())
        val role = if (r.role == "admin") "admin" else "guest"
        val saved = SavedList(
            id = localId,
            name = r.name.ifBlank { null },
            emoji = existing?.emoji ?: "🛒",
            code = if (role == "guest") token else null,
            recordId = r.listId,
            isLocal = false,
            role = role,
        )
        prefs.setLists(if (existing != null) s.lists.map { if (it.id == localId) saved else it } else s.lists + saved)
        prefs.setActiveListId(localId)
        itemDao.clear()
        _listName.value = saved.name; prefs.setListName(saved.name)

        if (role == "admin") {
            prefs.setSync(null, r.listId)
            setConnected(null, r.listId)
            connectToList(r.listId)
        } else {
            prefs.setSync(token, r.listId)
            connectAsGuest(token, r.listId)
        }
        notifyWidgets()
    }

    /** Drive a guest list from the public token endpoints: poll the snapshot and
     *  map items read-only; writes go through the gated public endpoints. */
    private fun connectAsGuest(token: String, recordId: String?) {
        realtime.stop(); realtimeJob?.cancel(); presenceJob?.cancel()
        _activeUsers.value = emptyList()
        _sync.update { it.copy(connected = false, code = token, recordId = recordId, msg = "", msgType = MsgType.INFO) }
        _isGuest.value = true
        guestJob?.cancel()
        guestJob = scope.launch {
            while (true) {
                runCatching {
                    val snap = pb.publicSnapshot(token)
                    _shareMode.value = snap.mode
                    _listName.value = snap.list.name.ifBlank { null }
                    prefs.setListName(snap.list.name.ifBlank { null })
                    itemDao.replaceAll(snap.items.map {
                        ItemEntity(it.id, it.name, it.checked, it.note, it.category.ifBlank { "other" }, true, 0, now(), false, it.addedBy, it.checkedBy)
                    })
                    notifyWidgets()
                }
                delay(5_000)
            }
        }
    }

    fun disconnect() = scope.launch {
        stopGuest()
        realtime.stop(); realtimeJob?.cancel(); presenceJob?.cancel()
        _activeUsers.value = emptyList()
        _sync.update { it.copy(connected = false, code = null, recordId = null, msg = "", msgType = MsgType.INFO) }
        prefs.setSync(null, null)
        upsertActiveListMeta()
    }

    private suspend fun setConnected(code: String?, recordId: String) {
        _sync.update { it.copy(connected = true, code = code, recordId = recordId, msg = "Connected", msgType = MsgType.SUCCESS) }
        prefs.setSync(code, recordId)
        upsertActiveListMeta()
    }

    private fun connectToList(recordId: String) {
        stopGuest()
        _sync.update { it.copy(connected = true, recordId = recordId) }
        startRealtime(recordId)
        scope.launch {
            runCatching {
                fetchAndMerge(recordId)
                pushPending(recordId)
                loadListCustomData(recordId)
            }.onFailure { Log.e(TAG, "connect failed", it); setMsg("Sync Error", MsgType.ERROR) }
        }
        startPresence(recordId)
    }

    private fun startRealtime(recordId: String) {
        realtimeJob?.cancel()
        realtime.start(listOf("shopping_items/*", "list_categories/*", "list_items/*", "list_disabled_products/*", "list_disabled_categories/*", "shopping_lists/$recordId"))
        realtimeJob = scope.launch { realtime.events.collect { handleRealtime(recordId, it) } }
    }

    private suspend fun fetchAndMerge(recordId: String) {
        val records = pb.getItems(recordId)
        val listRecord = pb.getList(recordId)
        listDataRef = listRecord.data ?: JsonObject(emptyMap())
        val local = itemDao.getAll()
        val localById = local.associateBy { it.id }
        val offline = local.filter { it.id.startsWith("local_") }
        val merged = records.map { r ->
            val l = localById[r.id]
            if (l != null && (l.dirty || syncMeta.hasPendingWrite(r.id))) l else r.toEntity(l)
        }
        itemDao.replaceAll(offline + merged)
        listRecord.data?.get("listName")?.let { el ->
            val name = if (el is JsonNull) null else el.jsonPrimitive.contentOrNull
            _listName.value = name; prefs.setListName(name)
        }
        // Emoji is stored on the server (data.emoji) so it shows on every device.
        val remoteEmoji = listRecord.data?.get("emoji")?.let { if (it is JsonNull) null else it.jsonPrimitive.contentOrNull }
        val es = prefs.snapshot()
        val localEmoji = es.lists.firstOrNull { it.recordId == recordId }?.emoji
        if (!remoteEmoji.isNullOrBlank()) {
            if (localEmoji != remoteEmoji) prefs.setLists(es.lists.map { if (it.recordId == recordId) it.copy(emoji = remoteEmoji) else it })
        } else if (!localEmoji.isNullOrBlank() && localEmoji != "🛒") {
            // Back-fill an emoji chosen before server-side emoji sync existed.
            runCatching { listDataRef = pb.updateListData(recordId, JsonObject(listDataRef + mapOf("emoji" to JsonPrimitive(localEmoji)))).data ?: listDataRef }
        }
        notifyWidgets()
    }

    private suspend fun pushPending(recordId: String) {
        val all = itemDao.getAll()
        all.filter { it.dirty && !it.id.startsWith("local_") }.forEach {
            itemQueue.enqueueUpdate(
                "shopping_items", it.id,
                mapOf("name" to it.name, "category" to it.category, "checked" to it.checked, "note" to it.note, "in_list" to it.inList),
            )
        }
        val offline = all.filter { it.id.startsWith("local_") && !syncMeta.pendingCreates.contains(it.id) }
        if (offline.isEmpty()) return
        offline.forEach { syncMeta.pendingCreates.add(it.id) }
        try {
            if (offline.size > 1) {
                val bodies = offline.map { createBody(recordId, it.name, it.category, it.checked, it.note, it.inList, it.id) }
                val results = runCatching { pb.batchCreateItems(bodies) }.getOrNull()
                if (results != null && results.size == offline.size) {
                    results.forEachIndexed { i, rec -> swapTempId(offline[i].id, rec) }
                } else {
                    offline.forEach { item ->
                        runCatching { swapTempId(item.id, pb.createItem(createBody(recordId, item.name, item.category, item.checked, item.note, item.inList, item.id))) }
                    }
                }
            } else {
                val item = offline[0]
                runCatching { swapTempId(item.id, pb.createItem(createBody(recordId, item.name, item.category, item.checked, item.note, item.inList, item.id))) }
            }
        } finally {
            offline.forEach { syncMeta.pendingCreates.remove(it.id) }
        }
    }

    private suspend fun loadListCustomData(recordId: String) {
        runCatching {
            pb.getListCategories(recordId).forEach { categoryDao.upsertCategory(CustomCategoryEntity(it.key, it.icon)) }
            pb.getListItems(recordId).forEach { addCustomItemLocal(it.categoryKey, it.name) }
        }
        loadListDisabled(recordId)
    }

    // ---- Realtime handling (ported from useListSync.ts) ----

    private suspend fun handleRealtime(recordId: String, e: RealtimeEvent) {
        when (e.collection) {
            "shopping_items" -> handleItemEvent(recordId, e)
            "list_categories" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.CategoryRecord.serializer(), e.record)
                if (rec.list != recordId) return
                when (e.action) {
                    "create" -> categoryDao.upsertCategory(CustomCategoryEntity(rec.key, rec.icon))
                    "delete" -> categoryDao.deleteCategory(rec.key)
                }
            }
            "list_items" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.ListItemRecord.serializer(), e.record)
                if (rec.list != recordId) return
                when (e.action) {
                    "create" -> addCustomItemLocal(rec.categoryKey, rec.name)
                    "delete" -> categoryDao.deleteItemByName(rec.categoryKey, rec.name)
                }
            }
            "list_disabled_products" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.DisabledProductRecord.serializer(), e.record)
                if (rec.list != recordId) return
                when (e.action) {
                    "create" -> disabledDao.insert(DisabledProductEntity(rec.name))
                    "delete" -> disabledDao.deleteByName(rec.name)
                }
            }
            "list_disabled_categories" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.DisabledCategoryRecord.serializer(), e.record)
                if (rec.list != recordId) return
                when (e.action) {
                    "create" -> _disabledCategories.update { it + rec.key }
                    "delete" -> _disabledCategories.update { it - rec.key }
                }
            }
            "shopping_lists" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.ListRecord.serializer(), e.record)
                if (rec.id != recordId || e.action != "update") return
                val data = rec.data ?: return
                listDataRef = data
                data["listName"]?.let { el ->
                    val name = if (el is JsonNull) null else el.jsonPrimitive.contentOrNull
                    _listName.value = name; prefs.setListName(name)
                }
            }
        }
    }

    private suspend fun handleItemEvent(recordId: String, e: RealtimeEvent) {
        val rec = pb.json.decodeFromJsonElement(ItemRecord.serializer(), e.record)
        if (rec.list != recordId) return
        when (e.action) {
            "create" -> {
                val ext = rec.externalId
                if (ext.isNotBlank() && itemDao.getById(ext) != null) {
                    val temp = itemDao.getById(ext)
                    itemDao.deleteById(ext)
                    if (itemDao.getById(rec.id) == null) itemDao.upsert(rec.toEntity(temp))
                    notifyWidgets()
                    return
                }
                if (itemDao.getById(rec.id) == null) {
                    val prev = items.value
                    val entity = rec.toEntity(null)
                    itemDao.upsert(entity)
                    maybeNotify(prev, listOf(entity.toDomain()))
                    notifyWidgets()
                }
            }
            "update" -> {
                val current = itemDao.getById(rec.id) ?: return
                if (syncMeta.shouldSkipRemoteUpdate(rec.id, rec.updated, current.serverUpdated)) return
                val prev = items.value
                val updated = rec.toEntity(current)
                itemDao.upsert(updated)
                maybeNotify(prev, listOf(updated.toDomain()))
                notifyWidgets()
            }
            "delete" -> { itemDao.deleteById(rec.id); notifyWidgets() }
        }
    }

    private fun maybeNotify(prev: List<ShopItem>, changed: List<ShopItem>) {
        val s = settingsCache ?: return
        notifications.notifyChanges(prev, changed, s.notifyOnAdd, s.notifyOnCheck)
    }

    private fun notifyWidgets() {
        WidgetUpdater.updateAll(context)
    }

    // ---- Presence ----

    private fun startPresence(recordId: String) {
        presenceJob?.cancel()
        presenceJob = scope.launch {
            while (true) {
                val code = _sync.value.code
                val uid = sessionUserId
                if (uid != null && code != null) {
                    runCatching { pb.request("PATCH", "/api/collections/users/records/$uid", buildJsonObject { put("current_list", code) }) }
                    runCatching { _activeUsers.value = pb.presence(recordId).map { PresenceUser(it.id, it.username, it.lastActiveAt) } }
                }
                delay(20_000)
            }
        }
    }

    // ---- Auth ----

    suspend fun claimAccount(email: String, password: String): Boolean = runCatching {
        val auth = pb.claimAccount(email, password)
        pb.setToken(auth.token); sessionUserId = auth.record.id; persistAuth(auth); true
    }.getOrDefault(false)

    suspend fun login(email: String, password: String): Boolean = runCatching {
        val auth = pb.authWithPassword(email, password)
        pb.setToken(auth.token); sessionUserId = auth.record.id; persistAuth(auth); true
    }.getOrDefault(false)

    /** After login, connect to the user's first remembered list (recover). */
    /**
     * Pull every list this account is a member of into the local multi-list set,
     * so a list shared with you (e.g. added as admin by email) shows up without a
     * manual step. Additive: only ADDS memberships not already saved. Runs on
     * startup and from the "recover lists" action.
     */
    suspend fun reconcileAccountLists() {
        val uid = sessionUserId ?: return
        val members = runCatching { pb.getMyListMemberships(uid) }.getOrNull() ?: return
        if (members.isEmpty()) return
        val s = prefs.snapshot()
        val known = s.lists.mapNotNull { it.recordId }.toSet()
        val additions = members.mapNotNull { m ->
            val l = m.expand?.list ?: return@mapNotNull null
            if (known.contains(l.id)) return@mapNotNull null
            val nm = l.data?.get("listName")?.let { if (it is JsonNull) null else it.jsonPrimitive.contentOrNull } ?: l.name.ifBlank { null }
            val emoji = l.data?.get("emoji")?.let { if (it is JsonNull) null else it.jsonPrimitive.contentOrNull } ?: "🛒"
            SavedList(
                id = "list_${l.id}", name = nm, emoji = emoji,
                code = l.inviteCode.ifBlank { null }, recordId = l.id, isLocal = false,
                role = if (m.role == "owner") "owner" else "admin",
            )
        }
        if (additions.isNotEmpty()) prefs.setLists(s.lists + additions)
    }

    suspend fun refreshInvites() {
        _invites.value = runCatching { pb.listInvites() }.getOrDefault(emptyList())
    }

    fun acceptInvite(id: String) = scope.launch {
        runCatching { pb.acceptInvite(id) }
        _invites.update { list -> list.filterNot { it.id == id } }
        reconcileAccountLists()
    }

    fun declineInvite(id: String) = scope.launch {
        runCatching { pb.declineInvite(id) }
        _invites.update { list -> list.filterNot { it.id == id } }
    }

    suspend fun recoverLists(): Int {
        val uid = sessionUserId ?: return 0
        val members = runCatching { pb.getMyListMemberships(uid) }.getOrDefault(emptyList())
        reconcileAccountLists()
        val first = members.firstOrNull()?.expand?.list ?: return members.size
        val target = prefs.snapshot().lists.firstOrNull { it.recordId == first.id }
        if (target != null) switchList(target.id) else connectToList(first.id)
        return members.size
    }

    fun logout(keepLocal: Boolean) = scope.launch {
        disconnect().join()
        prefs.clearAuth(); pb.setToken(null); sessionUserId = null
        if (!keepLocal) { itemDao.clear(); _listName.value = null; prefs.setListName(null) }
        ensureGuestSession()
    }

    fun setUsername(name: String) = scope.launch {
        val uid = sessionUserId ?: return@launch
        runCatching { pb.request("PATCH", "/api/collections/users/records/$uid", buildJsonObject { put("display_name", name) }) }
        val s = settingsCache
        prefs.setAuth(pb.token, uid, s?.auth?.email, name, if (s?.auth?.isLoggedIn == true) "account" else "guest", "users")
    }

    suspend fun isUsernameAvailable(name: String): Boolean = runCatching {
        pb.request("GET", "/api/collections/users/records?perPage=1&filter=" + java.net.URLEncoder.encode("display_name = \"$name\"", "UTF-8"))
        true // membership-scoped list rules hide others; treat as available (server enforces uniqueness if configured)
    }.getOrDefault(true)

    // ---- Local list management / backup ----

    fun resetLocal() = scope.launch {
        itemDao.clear()
        categoryDao.getCategories().forEach { categoryDao.deleteCategory(it.key) }
        _listName.value = null; prefs.setListName(null)
        disconnect()
    }

    suspend fun exportJson(): String {
        val its = itemDao.getAll().map { it.toDomain() }
        return pb.json.encodeToString(
            BackupData.serializer(),
            BackupData(
                listName = _listName.value,
                items = its.map { BackupItem(it.id, it.name, it.checked, it.note, it.category, it.inList) },
            ),
        )
    }

    suspend fun importJson(text: String): Boolean = runCatching {
        val backup = pb.json.decodeFromString(BackupData.serializer(), text)
        _listName.value = backup.listName; prefs.setListName(backup.listName)
        itemDao.replaceAll(backup.items.map {
            ItemEntity(
                id = if (it.id.isBlank()) "local_" + UUID.randomUUID() else it.id,
                name = it.name, checked = it.checked, note = it.note,
                category = it.category, inList = it.inList, serverUpdated = 0, updatedAt = now(), dirty = false,
            )
        })
        true
    }.getOrDefault(false)

    // ---- Server configuration ----

    suspend fun testServer(url: String): Boolean = pb.health(url)

    suspend fun applyServer(url: String) {
        val clean = url.trim().trimEnd('/')
        pb.setBaseUrl(clean)
        prefs.setServerUrl(clean)
        prefs.setWizardDone(true)
        if (clean.isNotBlank()) {
            ensureGuestSession()
            loadCatalog()
        }
    }

    suspend fun useLocalMode() {
        prefs.setServerUrl("")
        pb.setBaseUrl("")
        prefs.setWizardDone(true)
    }

    // ---- Helpers ----

    private suspend fun markDirty(id: String) {
        itemDao.getById(id)?.let { itemDao.upsert(it.copy(dirty = true)) }
    }

    private fun pushFieldUpdate(item: ItemEntity, body: Map<String, Any?>) {
        if (item.id.startsWith("local_")) return
        if (_sync.value.connected) itemQueue.enqueueUpdate("shopping_items", item.id, body)
        else scope.launch { markDirty(item.id) }
    }

    private suspend fun swapTempId(tempId: String, record: ItemRecord) {
        val temp = itemDao.getById(tempId)
        val realExists = itemDao.getById(record.id) != null
        itemDao.deleteById(tempId)
        if (!realExists) itemDao.upsert(record.toEntity(temp))
    }

    private suspend fun addCustomItemLocal(categoryKey: String, name: String) {
        if (categoryDao.findItem(categoryKey, name) == null) {
            categoryDao.insertItem(CustomItemEntity(categoryKey = categoryKey, name = name))
        }
    }

    private suspend fun addToHistory(code: String) {
        val entry = SyncHistoryItem(code, _listName.value, now())
        val history = (listOf(entry) + _sync.value.syncHistory.filterNot { it.code == code }).take(5)
        _sync.update { it.copy(syncHistory = history) }
        prefs.setSyncHistory(history)
    }

    private fun setMsg(msg: String, type: MsgType) {
        _sync.update { it.copy(msg = msg, msgType = type) }
    }

    private fun now() = System.currentTimeMillis()

    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun parseBoolConfig(el: kotlinx.serialization.json.JsonElement): Boolean {
        val prim = (el as? kotlinx.serialization.json.JsonPrimitive) ?: return false
        prim.booleanOrNull?.let { return it }
        return prim.content.equals("true", ignoreCase = true) || prim.content == "1"
    }

    private fun ItemEntity.toCached() = CachedItem(id, name, checked, note, category, inList, serverUpdated, updatedAt, dirty)
    private fun CachedItem.toEntity() = ItemEntity(id, name, checked, note, category, inList, serverUpdated, updatedAt, dirty)

    private fun ItemRecord.toEntity(local: ItemEntity?): ItemEntity = ItemEntity(
        id = id, name = name, checked = checked, note = note,
        category = category.ifBlank { "other" }, inList = inList,
        serverUpdated = SyncMeta.parsePbDate(updated), updatedAt = local?.updatedAt ?: now(), dirty = false,
        addedBy = addedBy, checkedBy = checkedBy,
    )

    /** This user's display name for public-link attribution ("" → server uses "External"). */
    private fun myName(): String = settingsCache?.auth?.username?.takeIf { it.isNotBlank() } ?: ""

    private fun createBody(recordId: String, name: String, category: String, checked: Boolean, note: String, inList: Boolean, externalId: String): JsonObject =
        buildJsonObject {
            put("list", recordId); put("name", name); put("category", category)
            put("checked", checked); put("note", note); put("in_list", inList); put("external_id", externalId)
        }

    private fun mapToJson(map: Map<String, Any?>): JsonObject = buildJsonObject {
        map.forEach { (k, v) ->
            when (v) {
                is Boolean -> put(k, v)
                is Number -> put(k, v)
                is String -> put(k, v)
                null -> put(k, JsonNull)
                else -> put(k, v.toString())
            }
        }
    }

    private fun buildCategories(
        server: List<Category>,
        customCats: List<CustomCategoryEntity>,
        customItems: List<CustomItemEntity>,
    ): Map<String, Category> {
        val base = server.ifEmpty { DefaultCatalog.categories }
        val map = LinkedHashMap<String, Category>()
        base.forEach { map[it.key] = it }
        customCats.forEach { cc -> if (!map.containsKey(cc.key)) map[cc.key] = Category(cc.key, cc.icon, emptyList()) }
        customItems.forEach { ci ->
            map[ci.categoryKey]?.let { cat ->
                map[ci.categoryKey] = cat.copy(items = cat.items + LocalizedItem(ci.name, ci.name, ci.name))
            }
        }
        return map
    }

    data class JoinInfo(val recordId: String, val name: String, val code: String, val hasLocalItems: Boolean)

    @kotlinx.serialization.Serializable
    private data class BackupData(val listName: String?, val items: List<BackupItem>)

    @kotlinx.serialization.Serializable
    private data class BackupItem(
        val id: String, val name: String, val checked: Boolean,
        val note: String, val category: String, val inList: Boolean,
    )

    companion object { private const val TAG = "ShopRepository" }
}
