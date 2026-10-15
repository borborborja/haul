package com.bor_devs.shoplist.data.repo

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import androidx.room.withTransaction
import com.bor_devs.shoplist.data.local.AppDatabase
import com.bor_devs.shoplist.data.local.CatalogMutationDao
import com.bor_devs.shoplist.data.local.CatalogMutationEntity
import com.bor_devs.shoplist.data.local.CategoryDao
import com.bor_devs.shoplist.data.local.CustomCategoryEntity
import com.bor_devs.shoplist.data.local.CustomItemEntity
import com.bor_devs.shoplist.data.local.DisabledDao
import com.bor_devs.shoplist.data.local.DisabledProductEntity
import com.bor_devs.shoplist.data.local.ItemDao
import com.bor_devs.shoplist.data.local.ItemEntity
import com.bor_devs.shoplist.data.local.PendingItemDeleteDao
import com.bor_devs.shoplist.data.local.PendingItemDeleteEntity
import com.bor_devs.shoplist.data.prefs.Settings
import com.bor_devs.shoplist.data.prefs.CachedListExtras
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
import com.bor_devs.shoplist.data.sync.canSyncQuantity
import com.bor_devs.shoplist.data.sync.matches
import com.bor_devs.shoplist.data.sync.reconcileCreatedItem
import com.bor_devs.shoplist.data.sync.reconcileItemSnapshot
import com.bor_devs.shoplist.di.AppScope
import com.bor_devs.shoplist.domain.CommandStatus
import com.bor_devs.shoplist.domain.ProductCommandResult
import com.bor_devs.shoplist.domain.CategoryCommandResult
import com.bor_devs.shoplist.domain.validateProduct
import com.bor_devs.shoplist.domain.normalizeProductName
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
import kotlinx.coroutines.CancellationException
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.text.Normalizer
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
    private val pendingDeleteDao: PendingItemDeleteDao,
    private val catalogMutationDao: CatalogMutationDao,
    private val database: AppDatabase,
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
    val quantitySupported = MutableStateFlow(true)
    val catalogSyncError = MutableStateFlow<String?>(null)
    val catalogPendingCount = MutableStateFlow(0)
    private val catalogFlushLock = Mutex()

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
    private var memberPollJob: Job? = null
    private var connectJob: Job? = null
    @Volatile private var activeConnection: Any = Any()
    private var sessionUserId: String? = null

    /** Pull-to-refresh / manual-refresh in-progress indicator. */
    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

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
        val current = if (op.kind == WriteKind.UPDATE) itemDao.getById(op.recordId) else null
        if (current != null && !canSyncQuantity(current.quantity, quantitySupported.value)) throw com.bor_devs.shoplist.data.remote.PbException(400, "QUANTITY_UNSUPPORTED")
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
        if (op.kind == WriteKind.DELETE) {
            scope.launch { pendingDeleteDao.deleteById(op.recordId) }
            return
        }
        if (op.kind != WriteKind.UPDATE || result !is ItemRecord) return
        scope.launch {
            itemDao.updateById(result.id) {
                it.copy(serverUpdated = SyncMeta.parsePbDate(result.updated), dirty = !it.matches(result))
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
                markDirty(op.recordId)
            }
        }
    }

    @Volatile private var settingsCache: com.bor_devs.shoplist.data.prefs.Settings? = null

    // ---- Initialization / session restore ----

    @Volatile private var initialized = false
    private val initializeLock = Mutex()
    private val authLock = Mutex()
    private val listLock = Mutex()

    suspend fun initialize() {
      initializeLock.withLock {
        if (initialized) return
        initialized = true
        scope.launch { prefs.data.collect { settingsCache = it } }
        val s = prefs.snapshot()
        settingsCache = s
        if (s.serverUrl.isNotBlank()) pb.setBaseUrl(s.serverUrl)
        quantitySupported.value = s.serverUrl.isBlank() || s.quantityCapabilities[s.serverUrl] == true
        serverCatalog.value = s.catalogSnapshots[pb.baseUrl].orEmpty()
        pb.setToken(s.authToken)
        sessionUserId = s.auth.userId
        _listName.value = s.listName
        _sync.update { it.copy(code = s.syncCode, recordId = s.syncRecordId, syncHistory = s.syncHistory) }
        val restoring = activeConnection

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

        listLock.withLock { ensureLegacyCatalogMutationsLocked(); restorePendingCatalogLocked() }
        scope.launch {
            while (true) {
                delay(15_000)
                flushCatalogMutations()
            }
        }
        if (!pb.hasServer) return // local mode
        ensureGuestSession()
        loadCatalog()
        reconcileAccountLists() // pull lists shared with this account (e.g. invited as admin)
        refreshInvites() // pending admin invitations awaiting accept/decline
        if (pb.baseUrl != s.serverUrl.trim().trimEnd('/')) return
        listLock.withLock {
        if (activeConnection !== restoring || prefs.snapshot().activeListId != s.activeListId) return
        val active = s.lists.firstOrNull { it.id == s.activeListId }
        val guestToken = if (active != null && active.role == "guest") active.code else null
        when {
            guestToken != null -> connectAsGuest(guestToken, active?.recordId)
            s.syncRecordId != null -> connectToList(s.syncRecordId)
            s.syncCode != null -> runCatching { connectToList(pb.joinList(s.syncCode).id) }
            else -> syncActiveListToServer() // server present but list still local → auto-sync
        }
        }
      }
    }

    suspend fun ensureGuestSession(): Boolean {
      return authLock.withLock {
        if (!pb.hasServer) return false
        if (!pb.token.isNullOrBlank()) {
            try {
                val refreshed = pb.authRefresh("users")
                pb.setToken(refreshed.token); sessionUserId = refreshed.record.id
                persistAuth(refreshed); return true
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                // A timeout/offline server must never replace an existing user's
                // identity with a fresh guest (and lose access to their lists).
                val status = (error as? com.bor_devs.shoplist.data.remote.PbException)?.status
                if (status != 401 && status != 403) return false
            }
            pb.setToken(null)
        }
        runCatching {
            val auth = pb.createGuest()
            pb.setToken(auth.token); sessionUserId = auth.record.id
            persistAuth(auth); true
        }.getOrDefault(false)
      }
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
        val origin = pb.baseUrl
        val capability = runCatching { pb.capabilities().supportsQuantity }.getOrNull()
        if (pb.baseUrl != origin) return
        quantitySupported.value = capability ?: prefs.snapshot().quantityCapabilities[origin] ?: false
        if (capability != null) prefs.setQuantityCapability(origin, capability)
        runCatching {
            val cats = pb.getCatalogCategories()
            val products = pb.getCatalogItems()
            if (pb.baseUrl != origin) return@runCatching
            if (cats.isEmpty()) return@runCatching
            val map = LinkedHashMap<String, Category>()
            cats.forEach { map[it.key] = Category(it.key, it.icon, emptyList(), it.color.ifBlank { null }) }
            products.forEach { i ->
                val key = i.expand?.category?.key
                if (key != null) map[key]?.let { c ->
                    map[key] = c.copy(items = c.items + LocalizedItem(i.nameEs, i.nameCa.ifBlank { i.nameEs }, i.nameEn.ifBlank { i.nameEs }, i.id, "global", key))
                }
            }
            serverCatalog.value = map.values.toList()
            prefs.setCatalogSnapshot(origin, map.values.toList())
        }
        runCatching {
            val cfg = pb.getAppConfig()
            if (pb.baseUrl != origin) return@runCatching
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
      listLock.withLock {
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
            val updated = existing.copy(inList = true, checked = false, category = cat, updatedAt = now(), dirty = !existing.id.startsWith("local_"))
            itemDao.upsert(updated)
            pushFieldUpdate(updated, mapOf("in_list" to true, "checked" to false, "category" to cat))
            notifyWidgets()
            return@launch
        }
        val tempId = "local_" + UUID.randomUUID()
        val recordId = _sync.value.recordId
        val createNow = _sync.value.connected && recordId != null
        if (createNow) syncMeta.pendingCreates.add(tempId)
        itemDao.upsert(ItemEntity(tempId, trimmed, false, "", cat, true, 0, now(), false))
        if (createNow && recordId != null) {
            try {
                val record = pb.createItem(createBody(recordId, trimmed, cat, false, "", true, tempId))
                if (_sync.value.recordId == recordId && !_isGuest.value) swapTempId(tempId, record)
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                Log.e(TAG, "add failed, keeping local: ${e.message}")
            } finally {
                syncMeta.pendingCreates.remove(tempId)
            }
        }
        notifyWidgets()
      }
    }

    fun toggleCheck(id: String) = scope.launch {
      listLock.withLock {
        guestToken()?.let { token ->
            if (_shareMode.value != "shop" && _shareMode.value != "plan") return@launch
            val updated = itemDao.updateById(id) { it.copy(checked = !it.checked, updatedAt = now()) } ?: return@launch
            notifyWidgets()
            runCatching { pb.publicCheck(token, id, updated.checked, myName()) }
            return@launch
        }
        val updated = itemDao.updateById(id) {
            it.copy(checked = !it.checked, updatedAt = now(), dirty = !id.startsWith("local_"))
        } ?: return@launch
        pushFieldUpdate(updated, mapOf("checked" to updated.checked))
        notifyWidgets()
      }
    }

    fun deleteItem(id: String) = scope.launch {
        listLock.withLock { deleteItemLocked(id) }
    }

    private suspend fun deleteItemLocked(id: String) {
        guestToken()?.let { token ->
            if (_shareMode.value != "plan") return
            itemDao.deleteById(id); notifyWidgets()
            runCatching { pb.publicRemove(token, id) }
            return
        }
        val recordId = _sync.value.recordId
        if (!id.startsWith("local_") && recordId != null) {
            pendingDeleteDao.enqueueAndDelete(PendingItemDeleteEntity(id, recordId))
            if (_sync.value.connected) itemQueue.enqueueDelete("shopping_items", id)
        } else itemDao.deleteById(id)
        notifyWidgets()
    }

    fun updateNote(id: String, note: String) = scope.launch {
      listLock.withLock {
        if (_isGuest.value) return@launch // public links expose no note-write endpoint
        val updated = itemDao.updateById(id) {
            it.copy(note = note, updatedAt = now(), dirty = !id.startsWith("local_"))
        } ?: return@launch
        pushFieldUpdate(updated, mapOf("note" to note))
      }
    }

    fun removeFromList(id: String) = scope.launch {
      listLock.withLock {
        guestToken()?.let { token ->
            if (_shareMode.value != "plan") return@launch
            itemDao.deleteById(id); notifyWidgets()
            runCatching { pb.publicRemove(token, id) }
            return@launch
        }
        val updated = itemDao.updateById(id) {
            it.copy(inList = false, checked = false, updatedAt = now(), dirty = !id.startsWith("local_"))
        } ?: return@launch
        pushFieldUpdate(updated, mapOf("in_list" to false, "checked" to false))
        notifyWidgets()
      }
    }

    fun addBackToList(id: String) = scope.launch {
      listLock.withLock {
        if (_isGuest.value) return@launch
        val updated = itemDao.updateById(id) {
            it.copy(inList = true, checked = false, updatedAt = now(), dirty = !id.startsWith("local_"))
        } ?: return@launch
        pushFieldUpdate(updated, mapOf("in_list" to true, "checked" to false))
        notifyWidgets()
      }
    }

    fun clearCompleted() = scope.launch {
      listLock.withLock {
        val all = itemDao.getAll()
        if (_isGuest.value) return@launch
        val completed = all.filter { it.checked && it.inList }
        if (completed.isEmpty()) return@launch
        itemDao.upsertAll(completed.map { it.copy(checked = false, inList = false, updatedAt = now(), dirty = !it.id.startsWith("local_")) })
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
    }

    fun clearPreviouslyUsed(planning: Boolean) = scope.launch {
      listLock.withLock {
        if (_isGuest.value) return@launch
        val all = itemDao.getAll()
        val prev = all.filter { !it.inList || (planning && it.checked) }
        if (prev.isEmpty()) return@launch
        val recordId = _sync.value.recordId
        prev.forEach {
            if (!it.id.startsWith("local_") && recordId != null) {
                pendingDeleteDao.enqueueAndDelete(PendingItemDeleteEntity(it.id, recordId))
            } else itemDao.deleteById(it.id)
        }
        notifyWidgets()
        if (!_sync.value.connected) return@launch
        val remote = prev.filter { !it.id.startsWith("local_") }.map { it.id }
        if (remote.isEmpty()) return@launch
        if (remote.size == 1) { itemQueue.enqueueDelete("shopping_items", remote[0]); return@launch }
        remote.forEach { syncMeta.beginWrite(it) }
        try {
            if (!pb.batchDeleteItems(remote)) remote.forEach { itemQueue.enqueueDelete("shopping_items", it) }
            else remote.forEach { pendingDeleteDao.deleteById(it) }
        } catch (e: Exception) {
            remote.forEach { itemQueue.enqueueDelete("shopping_items", it) }
        } finally {
            remote.forEach { syncMeta.endWrite(it) }
        }
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
      listLock.withLock {
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
    }

    /** Create a reusable suggestion for this list, optionally adding it to the purchase. */
    suspend fun createProduct(name: String, categoryKey: String, quantity: String = "", note: String = "", addToList: Boolean = true, expectedListId: String? = null): ProductCommandResult =
        productCommand(expectedListId) {
            val clean = name.trim()
            validateProduct(clean, categoryKey, quantity.trim(), note)?.let { return@productCommand ProductCommandResult(CommandStatus.VALIDATION_ERROR, error = it) }
            if (_isGuest.value) {
                val token = guestToken()
                if (_shareMode.value != "plan" || token == null || !addToList) return@productCommand ProductCommandResult(CommandStatus.FAILED, error = "PERMISSION")
                pb.publicAdd(token, clean, categoryKey, myName(), quantity.trim(), note)
                return@productCommand ProductCommandResult(CommandStatus.SYNCED, categoryKey = categoryKey)
            }
            val cats = currentCategories()
            if (!cats.containsKey(categoryKey)) return@productCommand ProductCommandResult(CommandStatus.VALIDATION_ERROR, error = "CATEGORY_NOT_FOUND")
            if (cats[categoryKey]?.items?.any { localizedVariants(it).any { candidate -> normalizeProductName(candidate) == normalizeProductName(clean) } } == true) {
                return@productCommand ProductCommandResult(CommandStatus.DUPLICATE, error = "DUPLICATE_CATALOG", categoryKey = categoryKey)
            }
            if (addToList) {
                val existing = itemDao.getAll().firstOrNull { normalizeProductName(it.name) == normalizeProductName(clean) && it.inList && !it.checked }
                if (existing != null) return@productCommand ProductCommandResult(CommandStatus.DUPLICATE, existing.id, categoryKey, "DUPLICATE_LIST")
            }
            val id = newCatalogId()
            persistCatalogMutationLocked("list_items", buildJsonObject { put("category_key", categoryKey); put("name", clean) }, id)
            categoryDao.insertItem(CustomItemEntity(categoryKey = categoryKey, name = clean, sourceId = id))
            val purchaseId = if (addToList) addShoppingProductLocked(clean, categoryKey, quantity.trim(), note, id, "custom", categoryKey) else null
            launchPendingWrites()
            ProductCommandResult(savedStatus(), purchaseId, categoryKey)
        }

    /** Catalog selection adds to the purchase without creating another suggestion. */
    suspend fun addCatalogProduct(product: LocalizedItem, categoryKey: String, displayName: String? = null, expectedListId: String? = null): ProductCommandResult = productCommand(expectedListId) {
        val language = com.bor_devs.shoplist.domain.Lang.from(settingsCache?.appLang ?: java.util.Locale.getDefault().language)
        val name = displayName?.trim()?.ifBlank { null } ?: product.forLang(language).trim()
        val existing = itemDao.getAll().firstOrNull { normalizeProductName(it.name) == normalizeProductName(name) && it.inList && !it.checked }
        if (existing != null) return@productCommand ProductCommandResult(CommandStatus.DUPLICATE, existing.id, categoryKey, "DUPLICATE_LIST")
        if (_isGuest.value) {
            val token = guestToken()
            if (token == null || _shareMode.value != "plan") return@productCommand ProductCommandResult(CommandStatus.FAILED, error = "PERMISSION")
            pb.publicAdd(token, name, categoryKey, myName())
            return@productCommand ProductCommandResult(CommandStatus.SYNCED, categoryKey = categoryKey)
        }
        val effective = currentCategories()[categoryKey]?.items?.firstOrNull { localizedVariants(it).any { value -> normalizeProductName(value) == normalizeProductName(name) } } ?: product
        val id = addShoppingProductLocked(name, categoryKey, "", "", effective.sourceId, effective.sourceKind, categoryKey)
        launchPendingWrites()
        ProductCommandResult(savedStatus(), id, categoryKey)
    }

    /** Edit this purchase; catalog changes require the explicit opt-in. */
    suspend fun editProduct(itemId: String, name: String, categoryKey: String, quantity: String, note: String, saveToCatalog: Boolean = false, expectedListId: String? = null): ProductCommandResult = productCommand(expectedListId) {
        validateProduct(name.trim(), categoryKey, quantity.trim(), note)?.let { return@productCommand ProductCommandResult(CommandStatus.VALIDATION_ERROR, error = it) }
        if (_isGuest.value) return@productCommand ProductCommandResult(CommandStatus.FAILED, error = "PERMISSION")
        if (!currentCategories().containsKey(categoryKey)) return@productCommand ProductCommandResult(CommandStatus.VALIDATION_ERROR, error = "CATEGORY_NOT_FOUND")
        val old = itemDao.getById(itemId) ?: return@productCommand ProductCommandResult(CommandStatus.FAILED, error = "NOT_FOUND")
        val duplicate = itemDao.getAll().firstOrNull { it.id != itemId && normalizeProductName(it.name) == normalizeProductName(name) && it.inList && !it.checked }
        if (duplicate != null) return@productCommand ProductCommandResult(CommandStatus.DUPLICATE, duplicate.id, categoryKey, "DUPLICATE_LIST")
        val catalog = currentCategories()
        val original = catalog[old.sourceCategory.ifBlank { old.category }]?.items?.firstOrNull {
            old.sourceId.isNotBlank() && it.sourceId == old.sourceId || localizedVariants(it).any { value -> normalizeProductName(value) == normalizeProductName(old.name) }
        }
        var sourceId = old.sourceId.ifBlank { original?.sourceId.orEmpty() }
        var sourceKind = old.sourceKind.ifBlank { original?.sourceKind.orEmpty() }
        if (saveToCatalog) {
            val settings = prefs.snapshot()
            val alias = catalogMutationDao.forList(pb.baseUrl, settings.activeListId).firstOrNull { it.entityId == sourceId || it.remoteId == sourceId }
            val custom = categoryDao.getItems().firstOrNull { sourceId.isNotBlank() && (it.sourceId == sourceId || alias != null && (it.sourceId == alias.entityId || it.sourceId == alias.remoteId)) }
            val ownIds = setOf(sourceId, alias?.entityId.orEmpty(), alias?.remoteId.orEmpty()).filter { it.isNotBlank() }.toSet()
            if (catalog[categoryKey]?.items?.any { product -> product.sourceId !in ownIds && localizedVariants(product).any { normalizeProductName(it) == normalizeProductName(name) } } == true) {
                return@productCommand ProductCommandResult(CommandStatus.DUPLICATE, error = "DUPLICATE_CATALOG", categoryKey = categoryKey)
            }
            if (sourceKind == "custom" && custom != null) {
                sourceId = custom.sourceId
                val body = buildJsonObject { put("category_key", categoryKey); put("name", name.trim()) }
                persistCatalogMutationLocked("list_items", body, custom.sourceId, remoteId = custom.sourceId)
                categoryDao.insertItem(custom.copy(name = name.trim(), categoryKey = categoryKey))
            } else {
                sourceId = newCatalogId(); sourceKind = "custom"
                persistCatalogMutationLocked("list_items", buildJsonObject { put("category_key", categoryKey); put("name", name.trim()) }, sourceId)
                categoryDao.insertItem(CustomItemEntity(categoryKey = categoryKey, name = name.trim(), sourceId = sourceId))
            }
        }
        val updated = old.copy(name = name.trim(), category = categoryKey, quantity = quantity.trim(), note = note, sourceId = sourceId, sourceKind = sourceKind, sourceCategory = if (saveToCatalog) categoryKey else old.sourceCategory, dirty = !old.id.startsWith("local_"), updatedAt = now())
        itemDao.upsert(updated)
        pushFieldUpdate(updated, editableItemFields(updated))
        launchPendingWrites()
        notifyWidgets()
        ProductCommandResult(savedStatus(), itemId, categoryKey)
    }

    suspend fun createCategory(name: String, icon: String, expectedListId: String? = null): CategoryCommandResult = try {
        val origin = pb.baseUrl
        val principal = sessionUserId
        val targetList = expectedListId ?: prefs.snapshot().activeListId
        listLock.withLock {
            if (origin != pb.baseUrl || principal != sessionUserId || targetList != prefs.snapshot().activeListId) return@withLock CategoryCommandResult(CommandStatus.FAILED, error = "SCOPE_CHANGED")
            val clean = name.trim()
            if (_isGuest.value) return@withLock CategoryCommandResult(CommandStatus.FAILED, error = "PERMISSION")
            if (clean.isBlank() || clean.codePointCount(0, clean.length) > 80 || icon.codePointCount(0, icon.length) > 20) return@withLock CategoryCommandResult(CommandStatus.VALIDATION_ERROR, error = "NAME_REQUIRED")
            val key = Normalizer.normalize(clean.lowercase(), Normalizer.Form.NFD).replace("\\p{M}".toRegex(), "").replace("[^a-z0-9]+".toRegex(), "_").trim('_').take(70).ifBlank { "category_${newCatalogId()}" }
            if (currentCategories().containsKey(key)) return@withLock CategoryCommandResult(CommandStatus.DUPLICATE, key, "DUPLICATE")
            val id = newCatalogId()
            database.withTransaction {
                persistCatalogMutationLocked("list_categories", buildJsonObject { put("key", key); put("icon", icon); put("name", clean) }, id)
                categoryDao.upsertCategory(CustomCategoryEntity(key, icon, clean, id))
            }
            launchPendingWrites()
            CategoryCommandResult(savedStatus(), key)
        }
    } catch (e: Exception) {
        if (e is CancellationException) throw e
        CategoryCommandResult(CommandStatus.FAILED, error = "PERSISTENCE")
    }

    suspend fun setProductHidden(item: LocalizedItem, hidden: Boolean, expectedListId: String? = null): ProductCommandResult = productCommand(expectedListId) {
        if (_isGuest.value) return@productCommand ProductCommandResult(CommandStatus.FAILED, error = "PERMISSION")
        setProductHiddenLocked(item, hidden)
        launchPendingWrites()
        ProductCommandResult(savedStatus())
    }

    suspend fun retryPendingCatalog(): ProductCommandResult {
      return try {
        val origin = pb.baseUrl
        val principal = sessionUserId
        val state = prefs.snapshot()
        if (origin.isNotBlank()) {
            val capability = runCatching { pb.catalogRequest("GET", "/api/shoplist/health", null, origin, null)["supports_quantity"]?.jsonPrimitive?.booleanOrNull ?: false }.getOrNull()
            val applied = listLock.withLock {
                val current = prefs.snapshot()
                if (origin != pb.baseUrl || principal != sessionUserId || state.activeListId != current.activeListId) false
                else {
                    if (capability != null) {
                        quantitySupported.value = capability
                        prefs.setQuantityCapability(origin, capability)
                    }
                    true
                }
            }
            if (!applied) return ProductCommandResult(CommandStatus.FAILED, error = "SCOPE_CHANGED")
        }
        catalogMutationDao.retry(origin, state.activeListId)
        flushCatalogMutations()
        if (origin != pb.baseUrl || principal != sessionUserId || prefs.snapshot().activeListId != state.activeListId) return ProductCommandResult(CommandStatus.FAILED, error = "SCOPE_CHANGED")
        _sync.value.recordId?.takeIf { _sync.value.connected }?.let { pushPending(it) }
        itemQueue.flush()
        listLock.withLock {
            val current = prefs.snapshot()
            if (origin == pb.baseUrl && principal == sessionUserId && current.activeListId == state.activeListId) refreshCatalogStatusLocked()
        }
        if (!quantitySupported.value && itemDao.getAll().any { it.quantity.isNotBlank() }) return ProductCommandResult(CommandStatus.FAILED, error = "QUANTITY_UNSUPPORTED")
        val pending = catalogMutationDao.forList(pb.baseUrl, state.activeListId).any { it.revision > it.acknowledgedRevision } || itemDao.getAll().any { it.dirty || it.id.startsWith("local_") }
        val blocked = catalogMutationDao.forList(pb.baseUrl, state.activeListId).firstOrNull { it.revision > it.acknowledgedRevision && it.lastError.startsWith("HTTP_") }
        if (blocked != null) ProductCommandResult(CommandStatus.FAILED, error = blocked.lastError) else ProductCommandResult(if (pending) savedStatus() else CommandStatus.SYNCED)
    } catch (e: Exception) {
        if (e is CancellationException) throw e
        ProductCommandResult(CommandStatus.FAILED, error = "PERSISTENCE")
      }
    }

    private suspend fun productCommand(expectedListId: String? = null, block: suspend () -> ProductCommandResult): ProductCommandResult = try {
        val origin = pb.baseUrl
        val principal = sessionUserId
        val targetList = expectedListId ?: prefs.snapshot().activeListId
        listLock.withLock {
            if (origin != pb.baseUrl || principal != sessionUserId || targetList != prefs.snapshot().activeListId) ProductCommandResult(CommandStatus.FAILED, error = "SCOPE_CHANGED")
            else if (_isGuest.value) block() else database.withTransaction { ensureLegacyCatalogMutationsLocked(); block() }.also { refreshCatalogStatusLocked() }
        }
    } catch (e: Exception) {
        if (e is CancellationException) throw e
        Log.e(TAG, "Product command failed", e)
        ProductCommandResult(CommandStatus.FAILED, error = "PERSISTENCE")
    }

    private fun savedStatus() = if (pb.hasServer) CommandStatus.PENDING_SYNC else CommandStatus.SAVED_LOCAL
    private fun newCatalogId() = UUID.randomUUID().toString().replace("-", "").take(15)
    private suspend fun currentCategories() = buildCategories(serverCatalog.value, categoryDao.getCategories(), categoryDao.getItems())

    private fun editableItemFields(item: ItemEntity): Map<String, Any?> = mapOf(
        "name" to item.name, "category" to item.category, "quantity" to item.quantity, "note" to item.note,
        "catalog_source_id" to item.sourceId, "catalog_source_kind" to item.sourceKind, "catalog_source_category" to item.sourceCategory,
    )

    private suspend fun addShoppingProductLocked(name: String, category: String, quantity: String, note: String, sourceId: String, sourceKind: String, sourceCategory: String): String {
        val existing = itemDao.getAll().firstOrNull { normalizeProductName(it.name) == normalizeProductName(name) }
        val entity = if (existing != null) existing.copy(inList = true, checked = false, category = category, quantity = quantity.ifBlank { existing.quantity }, note = note.ifBlank { existing.note }, sourceId = sourceId, sourceKind = sourceKind, sourceCategory = sourceCategory, updatedAt = now(), dirty = !existing.id.startsWith("local_"))
        else ItemEntity("local_${UUID.randomUUID()}", name, false, note, category, true, 0, now(), false, quantity = quantity, sourceId = sourceId, sourceKind = sourceKind, sourceCategory = sourceCategory)
        itemDao.upsert(entity)
        if (!entity.id.startsWith("local_")) pushFieldUpdate(entity, editableItemFields(entity) + mapOf("in_list" to true, "checked" to false))
        notifyWidgets()
        return entity.id
    }

    private fun launchPendingWrites() {
        scope.launch {
            flushCatalogMutations()
            _sync.value.recordId?.takeIf { _sync.value.connected }?.let { pushPending(it) }
        }
    }

    private suspend fun setProductHiddenLocked(item: LocalizedItem, hidden: Boolean) {
        val key = com.bor_devs.shoplist.domain.catalogVisibilityKey(item)
        if (key.isBlank()) return
        val state = prefs.snapshot()
        val rows = catalogMutationDao.forList(pb.baseUrl, state.activeListId)
        val existing = rows.firstOrNull { it.collection == "list_disabled_products" && catalogPayload(it)["name"]?.jsonPrimitive?.content == key }
        persistCatalogMutationLocked("list_disabled_products", buildJsonObject { put("name", key) }, existing?.entityId, deleted = !hidden)
        if (hidden) disabledDao.insert(DisabledProductEntity(key)) else {
            disabledDao.deleteByName(key)
            val legacy = canonicalKey(item)
            if (legacy != key && disabledDao.getAll().any { it.name == legacy }) {
                val old = rows.firstOrNull { it.collection == "list_disabled_products" && catalogPayload(it)["name"]?.jsonPrimitive?.content == legacy }
                persistCatalogMutationLocked("list_disabled_products", buildJsonObject { put("name", legacy) }, old?.entityId, deleted = true)
                disabledDao.deleteByName(legacy)
            }
        }
    }

    private fun catalogPayload(row: CatalogMutationEntity): JsonObject = pb.json.decodeFromString(row.payload)

    private suspend fun persistCatalogMutationLocked(collection: String, payload: JsonObject, entityId: String? = null, deleted: Boolean = false, remoteId: String = ""): CatalogMutationEntity {
        val state = prefs.snapshot()
        val rows = catalogMutationDao.forList(pb.baseUrl, state.activeListId)
        val existing = entityId?.let { id -> rows.firstOrNull { it.entityId == id || it.remoteId == id } }
        val id = existing?.entityId ?: entityId ?: newCatalogId()
        val row = CatalogMutationEntity(pb.baseUrl, state.activeListId, id, collection, payload.toString(), existing?.remoteId ?: remoteId, existing?.remoteListId?.ifBlank { _sync.value.recordId.orEmpty() } ?: _sync.value.recordId.orEmpty(), deleted, (existing?.revision ?: 0) + 1, existing?.acknowledgedRevision ?: 0, principalId = existing?.principalId?.ifBlank { sessionUserId.orEmpty() } ?: sessionUserId.orEmpty())
        catalogMutationDao.upsert(row)
        refreshCatalogStatusLocked()
        return row
    }

    /** Upgrade older custom caches before a remote refresh can replace them. */
    private suspend fun ensureLegacyCatalogMutationsLocked() {
        categoryDao.getCategories().filter { it.sourceId.isBlank() }.forEach { category ->
            val id = newCatalogId()
            persistCatalogMutationLocked("list_categories", buildJsonObject { put("key", category.key); put("icon", category.icon); put("name", category.displayName.ifBlank { category.key }) }, id)
            categoryDao.upsertCategory(category.copy(sourceId = id))
        }
        categoryDao.getItems().filter { it.sourceId.isBlank() }.forEach { item ->
            val id = newCatalogId()
            persistCatalogMutationLocked("list_items", buildJsonObject { put("category_key", item.categoryKey); put("name", item.name) }, id)
            categoryDao.insertItem(item.copy(sourceId = id))
        }
    }

    /** Replay durable mutations onto the active projection after a restart/fetch/list switch. */
    private suspend fun restorePendingCatalogLocked() {
        val state = prefs.snapshot()
        normalizeBuiltinVisibilityLocked()
        val aliases = catalogMutationDao.forList(pb.baseUrl, state.activeListId).filter { it.collection == "list_items" && it.remoteId.isNotBlank() && it.remoteId != it.entityId && it.acknowledgedRevision > 0 }
        aliases.forEach { remapCatalogSourceLocked(it.entityId, it.remoteId) }
        val rows = catalogMutationDao.forList(pb.baseUrl, state.activeListId).filter { it.revision > it.acknowledgedRevision }
        rows.sortedBy { if (it.collection == "list_categories") 0 else 1 }.forEach { row ->
            val data = catalogPayload(row)
            fun value(key: String) = data[key]?.jsonPrimitive?.content.orEmpty()
            when (row.collection) {
                "list_categories" -> if (row.deleted) categoryDao.deleteCategory(value("key")) else categoryDao.upsertCategory(CustomCategoryEntity(value("key"), value("icon"), value("name"), row.remoteId.ifBlank { row.entityId }))
                "list_items" -> {
                    categoryDao.getItems().filter { it.sourceId == row.entityId || it.sourceId == row.remoteId && row.remoteId.isNotBlank() }.forEach { categoryDao.deleteItem(it) }
                    if (!row.deleted) addCustomItemLocal(value("category_key"), value("name"), row.remoteId.ifBlank { row.entityId })
                }
                "list_disabled_products" -> if (row.deleted) disabledDao.deleteByName(value("name")) else disabledDao.insert(DisabledProductEntity(value("name")))
                "list_disabled_categories" -> _disabledCategories.update { if (row.deleted) it - value("key") else it + value("key") }
            }
        }
        refreshCatalogStatusLocked()
    }

    /** A local built-in suggestion gets the server identity on its first connection. */
    private suspend fun normalizeBuiltinVisibilityLocked() {
        if (serverCatalog.value.isEmpty()) return
        val hidden = disabledDao.getAll().map { it.name }.filter { it.startsWith("source:global:builtin_") }
        if (hidden.isEmpty()) return
        val current = serverCatalog.value.associateBy { it.key }
        for (category in DefaultCatalog.categories) for (item in category.items) {
            val from = "source:global:${builtinSourceId(category.key, item)}"
            if (from !in hidden) continue
            val names = localizedVariants(item).map(::normalizeProductName).toSet()
            val remote = current[category.key]?.items?.firstOrNull { candidate -> localizedVariants(candidate).any { normalizeProductName(it) in names } } ?: continue
            if (remote.sourceId.isBlank()) continue
            val to = "source:global:${remote.sourceId}"
            val state = prefs.snapshot()
            val old = catalogMutationDao.forList(pb.baseUrl, state.activeListId).firstOrNull { it.collection == "list_disabled_products" && catalogPayload(it)["name"]?.jsonPrimitive?.content == from }
            if (old != null) catalogMutationDao.upsert(old.copy(payload = buildJsonObject { put("name", to) }.toString(), revision = old.revision + 1, nextAttemptAt = 0, lastError = ""))
            else {
                persistCatalogMutationLocked("list_disabled_products", buildJsonObject { put("name", to) })
                persistCatalogMutationLocked("list_disabled_products", buildJsonObject { put("name", from) }, deleted = true)
            }
            disabledDao.deleteByName(from)
            disabledDao.insert(DisabledProductEntity(to))
        }
    }

    private fun builtinSourceId(key: String, item: LocalizedItem) = "builtin_" + UUID.nameUUIDFromBytes((key + "|" + canonicalKey(item)).toByteArray()).toString().replace("-", "")

    private suspend fun refreshCatalogStatusLocked() {
        val state = prefs.snapshot()
        val pending = catalogMutationDao.forList(pb.baseUrl, state.activeListId).filter { it.revision > it.acknowledgedRevision }
        catalogPendingCount.value = pending.size
        catalogSyncError.value = pending.firstOrNull { it.lastError.startsWith("HTTP_") }?.lastError
            ?: if (!quantitySupported.value && itemDao.getAll().any { it.quantity.isNotBlank() }) "QUANTITY_UNSUPPORTED" else null
    }

    private suspend fun remapCatalogSourceLocked(oldId: String, remoteId: String) {
        categoryDao.getItems().filter { it.sourceId == oldId }.forEach { categoryDao.insertItem(it.copy(sourceId = remoteId)) }
        itemDao.getAll().filter { it.sourceId == oldId && it.sourceKind == "custom" }.forEach {
            val updated = it.copy(sourceId = remoteId, dirty = !it.id.startsWith("local_"))
            itemDao.upsert(updated)
            pushFieldUpdate(updated, mapOf("catalog_source_id" to remoteId))
        }
        val state = prefs.snapshot()
        val from = "source:custom:$oldId"
        val to = "source:custom:$remoteId"
        catalogMutationDao.forList(pb.baseUrl, state.activeListId).filter { it.collection == "list_disabled_products" && catalogPayload(it)["name"]?.jsonPrimitive?.content == from }.forEach {
            catalogMutationDao.upsert(it.copy(payload = buildJsonObject { put("name", to) }.toString(), revision = it.revision + 1, nextAttemptAt = 0))
        }
        if (disabledDao.getAll().any { it.name == from }) { disabledDao.deleteByName(from); disabledDao.insert(DisabledProductEntity(to)) }
    }

    /** Captured origin/token plus revision acknowledgements keep retries isolated. */
    private suspend fun flushCatalogMutations() {
        catalogFlushLock.withLock {
            val origin = pb.baseUrl
            val token = pb.token
            val state = prefs.snapshot()
            val listId = state.activeListId
            val remoteListId = _sync.value.recordId ?: return
            val connection = activeConnection
            if (!_sync.value.connected || _isGuest.value || !isNetworkAvailable()) return
            val rows = catalogMutationDao.forList(origin, listId).filter { it.revision > it.acknowledgedRevision && it.nextAttemptAt <= now() }
            for (row in rows.sortedBy { if (it.collection == "list_categories") 0 else 1 }) {
                if (!isActiveConnection(remoteListId, origin, connection) || prefs.snapshot().activeListId != listId) return
                if (row.remoteListId.isNotBlank() && row.remoteListId != remoteListId || row.principalId.isNotBlank() && row.principalId != sessionUserId) {
                    catalogMutationDao.fail(origin, listId, row.entityId, row.revision, Long.MAX_VALUE, "HTTP_403")
                    listLock.withLock { refreshCatalogStatusLocked() }
                    continue
                }
                try {
                    val id = com.bor_devs.shoplist.data.sync.CatalogMutationSync({ method, path, body, targetOrigin, authToken -> pb.catalogRequest(method, path, body, targetOrigin, authToken) }, pb.json).sync(row, remoteListId, token)
                    listLock.withLock {
                        catalogMutationDao.acknowledge(origin, listId, row.entityId, id, remoteListId, row.revision)
                        if (isActiveConnection(remoteListId, origin, connection) && prefs.snapshot().activeListId == listId) {
                            if (row.collection == "list_items" && id != row.entityId) remapCatalogSourceLocked(row.entityId, id)
                            refreshCatalogStatusLocked()
                        }
                    }
                } catch (e: Exception) {
                    if (e is CancellationException) throw e
                    val status = (e as? com.bor_devs.shoplist.data.remote.PbException)?.status ?: 0
                    val permanent = status in 400..499 && status != 429 && status != 401
                    val delayMs = if (permanent) Long.MAX_VALUE else now() + minOf(300_000L, 1000L shl minOf(row.attempts, 8))
                    catalogMutationDao.fail(origin, listId, row.entityId, row.revision, delayMs, if (permanent) "HTTP_$status" else "PENDING")
                    listLock.withLock { if (pb.baseUrl == origin && prefs.snapshot().activeListId == listId) refreshCatalogStatusLocked() }
                    if (!permanent || row.collection == "list_categories") return
                }
            }
        }
    }

    // ---- Category actions ----

    fun addCategory(key: String, icon: String) = scope.launch { createCategory(key, icon) }

    fun removeCategory(key: String) = scope.launch { setCategoryHidden(key, true) }

    fun addCategoryItem(catKey: String, name: String) = scope.launch { createProduct(name, catKey, addToList = false) }

    fun removeCategoryItem(catKey: String, name: String) = scope.launch {
        val product = currentCategories()[catKey]?.items?.firstOrNull { localizedVariants(it).contains(name.trim().lowercase()) }
        if (product != null) setProductHidden(product, true)
    }

    private fun canonicalKey(item: LocalizedItem): String =
        item.en.ifBlank { item.es.ifBlank { item.ca } }.trim().lowercase()

    private fun localizedVariants(item: LocalizedItem): Set<String> =
        setOf(item.en, item.es, item.ca).filter { it.isNotBlank() }.map { it.trim().lowercase() }.toSet()

    /** Hiding a catalog suggestion never removes a current purchase. */
    fun deactivateProduct(item: LocalizedItem) = scope.launch { setProductHidden(item, true) }
    fun reactivateProduct(item: LocalizedItem) = scope.launch { setProductHidden(item, false) }

    private suspend fun loadListDisabled(recordId: String) {
        val origin = pb.baseUrl
        val connection = activeConnection
        runCatching {
            val records = pb.getListDisabledProducts(recordId)
            listLock.withLock {
                if (isActiveConnection(recordId, origin, connection)) { disabledDao.replaceAll(records.map { DisabledProductEntity(it.name) }); restorePendingCatalogLocked() }
            }
        }
        runCatching {
            val records = pb.getListDisabledCategories(recordId)
            listLock.withLock {
                if (isActiveConnection(recordId, origin, connection)) { _disabledCategories.value = records.map { it.key }.toSet(); restorePendingCatalogLocked() }
            }
        }
    }

    /** Hide a category in this list without removing its purchases. */
    fun deactivateCategory(key: String) = scope.launch { setCategoryHidden(key, true) }
    fun reactivateCategory(key: String) = scope.launch { setCategoryHidden(key, false) }

    private suspend fun setCategoryHidden(key: String, hidden: Boolean) = productCommand {
        val state = prefs.snapshot()
        val existing = catalogMutationDao.forList(pb.baseUrl, state.activeListId).firstOrNull {
            it.collection == "list_disabled_categories" && catalogPayload(it)["key"]?.jsonPrimitive?.content == key
        }
        persistCatalogMutationLocked("list_disabled_categories", buildJsonObject { put("key", key) }, existing?.entityId, deleted = !hidden)
        _disabledCategories.update { if (hidden) it + key else it - key }
        launchPendingWrites()
        ProductCommandResult(savedStatus())
    }

    // ---- Multi-list switching ----

    /** Create a new local list and make it active (the "Nova llista" action). */
    fun createLocalList(name: String, emoji: String = "🛒") = scope.launch {
      listLock.withLock {
        val s = prefs.snapshot()
        goLocal()
        snapshotActiveItems(s)
        val id = "list_" + UUID.randomUUID()
        val display = name.trim().ifBlank { null }
        prefs.setLists(s.lists + SavedList(id, display, emoji, null, null, true))
        prefs.setActiveListId(id)
        itemDao.clear()
        restoreListExtras(null)
        _listName.value = display; prefs.setListName(display)
        prefs.setSync(null, null)
        notifyWidgets()
        // With a server configured, a new list is synced by default.
        if (pb.hasServer) syncActiveListToServer()
      }
    }

    /** Make another saved list the active one, swapping items through the cache. */
    fun switchList(id: String) = scope.launch {
      listLock.withLock {
        val s = prefs.snapshot()
        if (id == s.activeListId) return@launch
        val target = s.lists.firstOrNull { it.id == id } ?: return@launch
        goLocal()
        val caches = snapshotActiveItems(s).toMutableMap()
        val targetItems = caches.remove(id) ?: emptyList()
        prefs.setListCaches(caches)
        prefs.setActiveListId(id)
        itemDao.replaceAll(targetItems.map { it.toEntity() })
        restoreListExtras(s.listExtras[id])
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
    }

    fun deleteList(id: String) = scope.launch {
      listLock.withLock {
        val s = prefs.snapshot()
        if (s.lists.size <= 1) return@launch
        val remaining = s.lists.filterNot { it.id == id }
        val caches = s.listCaches.toMutableMap(); caches.remove(id)
        prefs.setListExtras(s.listExtras - id)
        if (id == s.activeListId) {
            goLocal()
            val next = remaining.first()
            val nextItems = caches.remove(next.id) ?: emptyList()
            prefs.setLists(remaining); prefs.setListCaches(caches); prefs.setActiveListId(next.id)
            itemDao.replaceAll(nextItems.map { it.toEntity() })
            restoreListExtras(s.listExtras[next.id])
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
    }

    fun setActiveListEmoji(emoji: String) = scope.launch {
      listLock.withLock {
        val s = prefs.snapshot()
        prefs.setLists(s.lists.map { if (it.id == s.activeListId) it.copy(emoji = emoji) else it })
        val rid = _sync.value.recordId
        if (_sync.value.connected && rid != null) {
            runCatching { listDataRef = pb.updateListData(rid, JsonObject(listDataRef + mapOf("emoji" to JsonPrimitive(emoji)))).data ?: listDataRef }
        }
      }
    }

    /** Snapshot the current active items into the DataStore cache; returns the new map. */
    private suspend fun snapshotActiveItems(s: Settings): Map<String, List<CachedItem>> {
        val caches = s.listCaches.toMutableMap()
        caches[s.activeListId] = itemDao.getAll().map { it.toCached() }
        prefs.setListCaches(caches)
        val extras = CachedListExtras(
            categories = categoryDao.getCategories(), items = categoryDao.getItems(),
            disabledProducts = disabledDao.getAll(), disabledCategories = _disabledCategories.value,
        )
        prefs.setListExtras(s.listExtras + (s.activeListId to extras))
        return caches
    }

    private suspend fun restoreListExtras(cached: CachedListExtras?) {
        val extras = cached ?: CachedListExtras()
        categoryDao.replaceAll(extras.categories, extras.items)
        disabledDao.replaceAll(extras.disabledProducts)
        _disabledCategories.value = extras.disabledCategories
        ensureLegacyCatalogMutationsLocked()
        restorePendingCatalogLocked()
    }

    /** Stop realtime/presence and mark the active list local (optionally keeping linkage for re-join). */
    private suspend fun goLocal(code: String? = null, recordId: String? = null) {
        activeConnection = Any()
        stopGuest()
        connectJob?.cancel()
        realtime.stop(); realtimeJob?.cancel(); presenceJob?.cancel(); memberPollJob?.cancel()
        _activeUsers.value = emptyList()
        listDataRef = JsonObject(emptyMap())
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
      listLock.withLock {
        if (!ensureGuestSession()) { setMsg("No server", MsgType.ERROR); return@launch }
        runCatching {
            val r = pb.createList(name)
            _listName.value = name; prefs.setListName(name)
            setConnected(r.inviteCode, r.id)
            addToHistory(r.inviteCode)
            connectToList(r.id)
        }.onFailure { setMsg("Error", MsgType.ERROR) }
      }
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
        val sourceListId = prefs.snapshot().activeListId
        val origin = pb.baseUrl
        if (!ensureGuestSession()) return null
        val r = runCatching { pb.joinList(code.trim().uppercase()) }.getOrNull() ?: return null
        return JoinInfo(r.id, r.name, r.inviteCode.ifBlank { code.trim().uppercase() }, itemDao.getAll().isNotEmpty(), sourceListId, origin)
    }

    fun finishJoin(info: JoinInfo, replace: Boolean) = scope.launch {
      listLock.withLock {
        val s = prefs.snapshot()
        if (s.activeListId != info.sourceListId || pb.baseUrl != info.serverUrl) return@launch
        val sourceRecordId = _sync.value.recordId
        val existing = s.lists.firstOrNull { it.recordId == info.recordId }
        goLocal()
        val sourceItems = itemDao.getAll()
        val copying = existing?.id?.let { it != s.activeListId } == true ||
            (sourceRecordId != null && sourceRecordId != info.recordId)
        if (copying) {
            snapshotActiveItems(s)
            val id = existing?.id ?: ("list_" + UUID.randomUUID())
            val target = (s.listCaches[id] ?: emptyList()).map { it.toEntity() }
            val copies = if (replace) emptyList() else sourceItems.map {
                it.copy(id = "local_" + UUID.randomUUID(), serverUpdated = 0, dirty = false, sourceId = "", sourceKind = "", sourceCategory = "")
            }
            prefs.setLists(if (existing != null) s.lists.map {
                if (it.id == id && it.role == "guest") it.copy(role = "admin") else it
            } else s.lists + SavedList(id, info.name, code = info.code, recordId = info.recordId, isLocal = false))
            prefs.setActiveListId(id)
            itemDao.replaceAll(target + copies)
            restoreListExtras(s.listExtras[id])
        } else if (replace) itemDao.clear()
        _listName.value = info.name; prefs.setListName(info.name)
        setConnected(info.code, info.recordId)
        addToHistory(info.code)
        connectToList(info.recordId)
      }
    }

    fun rotateCode() = scope.launch {
      listLock.withLock {
        val id = _sync.value.recordId ?: return@launch
        runCatching {
            val r = pb.rotateCode(id)
            _sync.update { it.copy(code = r.inviteCode) }
            prefs.setSync(r.inviteCode, id); addToHistory(r.inviteCode)
            upsertActiveListMeta()
        }
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
      listLock.withLock {
        val sourceListId = prefs.snapshot().activeListId
        val origin = pb.baseUrl
        if (!ensureGuestSession()) { setMsg("No server", MsgType.ERROR); return@launch }
        val r = runCatching { pb.joinByToken(token) }.getOrNull()
        if (r == null || r.listId.isBlank()) { setMsg("Error", MsgType.ERROR); return@launch }

        val s = prefs.snapshot()
        if (s.activeListId != sourceListId || pb.baseUrl != origin) return@launch
        goLocal()
        val caches = snapshotActiveItems(s)
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
        itemDao.replaceAll(if (role == "admin") caches[localId].orEmpty().map { it.toEntity() } else emptyList())
        restoreListExtras(if (role == "admin") prefs.snapshot().listExtras[localId] else null)
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
    }

    /** Drive a guest list from the public token endpoints: poll the snapshot and
     *  map items read-only; writes go through the gated public endpoints. */
    private fun connectAsGuest(token: String, recordId: String?) {
        val connection = Any()
        activeConnection = connection
        val origin = pb.baseUrl
        connectJob?.cancel()
        realtime.stop(); realtimeJob?.cancel(); presenceJob?.cancel(); memberPollJob?.cancel()
        _activeUsers.value = emptyList()
        _sync.update { it.copy(connected = false, code = token, recordId = recordId, msg = "", msgType = MsgType.INFO) }
        _isGuest.value = true
        guestJob?.cancel()
        guestJob = scope.launch {
            while (true) {
                runCatching {
                    val snap = pb.publicSnapshot(token)
                    listLock.withLock {
                    if (activeConnection !== connection || guestToken() != token || pb.baseUrl != origin) return@withLock
                    _shareMode.value = snap.mode
                quantitySupported.value = snap.quantitySupported
                    _listName.value = snap.list.name.ifBlank { null }
                    prefs.setListName(snap.list.name.ifBlank { null })
                    itemDao.replaceAll(snap.items.map {
                        ItemEntity(it.id, it.name, it.checked, it.note, it.category.ifBlank { "other" }, true, 0, now(), false, it.addedBy, it.checkedBy, it.quantity)
                    })
                    notifyWidgets()
                    }
                }
                delay(5_000)
            }
        }
    }

    fun disconnect() = scope.launch {
        listLock.withLock { disconnectLocked() }
    }

    private suspend fun disconnectLocked() {
        activeConnection = Any()
        stopGuest()
        connectJob?.cancel()
        realtime.stop(); realtimeJob?.cancel(); presenceJob?.cancel(); memberPollJob?.cancel()
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
        activeConnection = Any()
        stopGuest()
        _sync.update { it.copy(connected = true, recordId = recordId) }
        startRealtime(recordId)
        connectJob?.cancel()
        connectJob = scope.launch {
            runCatching {
                listLock.withLock { ensureLegacyCatalogMutationsLocked(); restorePendingCatalogLocked() }
                fetchAndMerge(recordId)
                pushPending(recordId)
                flushCatalogMutations()
                loadListCustomData(recordId)
            }.onFailure { Log.e(TAG, "connect failed", it); setMsg("Sync Error", MsgType.ERROR) }
        }
        startPresence(recordId)
    }

    private fun startRealtime(recordId: String) {
        realtimeJob?.cancel()
        realtime.start(listOf("shopping_items/*", "list_categories/*", "list_items/*", "list_disabled_products/*", "list_disabled_categories/*", "shopping_lists/$recordId"))
        realtimeJob = scope.launch { realtime.events.collect { handleRealtime(recordId, it) } }
        // Poll fallback: realtime is primary (instant), but mobile SSE can drop
        // silently — re-merge periodically so the list still syncs on its own.
        memberPollJob?.cancel()
        memberPollJob = scope.launch {
            while (true) {
                delay(25_000)
                runCatching { fetchAndMerge(recordId); pushPending(recordId); itemQueue.flush(); flushCatalogMutations(); loadListCustomData(recordId) }
            }
        }
    }

    /** Manual / pull-to-refresh: re-pull the active list now. */
    fun refresh() = scope.launch {
        val token = guestToken()
        if (token != null) {
            val origin = pb.baseUrl
            val connection = activeConnection
            _refreshing.value = true
            runCatching {
                val snap = pb.publicSnapshot(token)
                listLock.withLock {
                if (activeConnection !== connection || guestToken() != token || pb.baseUrl != origin) return@withLock
                _shareMode.value = snap.mode
                quantitySupported.value = snap.quantitySupported
                _listName.value = snap.list.name.ifBlank { null }
                itemDao.replaceAll(snap.items.map {
                    ItemEntity(it.id, it.name, it.checked, it.note, it.category.ifBlank { "other" }, true, 0, now(), false, it.addedBy, it.checkedBy, it.quantity)
                })
                notifyWidgets()
                }
            }
            _refreshing.value = false
            return@launch
        }
        val recordId = _sync.value.recordId ?: return@launch
        _refreshing.value = true
        runCatching { fetchAndMerge(recordId); pushPending(recordId); itemQueue.flush(); flushCatalogMutations(); loadListCustomData(recordId) }
        _refreshing.value = false
    }

    private suspend fun fetchAndMerge(recordId: String) {
        val origin = pb.baseUrl
        val connection = activeConnection
        val records = pb.getItems(recordId)
        val listRecord = pb.getList(recordId)
        listLock.withLock {
        if (!isActiveConnection(recordId, origin, connection)) return
        listDataRef = listRecord.data ?: JsonObject(emptyMap())
        itemDao.mergeAll(recordId) { local, deletedIds ->
            if (_sync.value.recordId != recordId || _isGuest.value) return@mergeAll local
            reconcileItemSnapshot(local, records, deletedIds, syncMeta::hasPendingWrite, now())
        }
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
    }

    private suspend fun pushPending(recordId: String) {
        val origin = pb.baseUrl
        val connection = activeConnection
        val offline = listLock.withLock {
            if (!isActiveConnection(recordId, origin, connection)) return
            pendingDeleteDao.forList(recordId).forEach { itemQueue.enqueueDelete("shopping_items", it.id) }
            val allItems = itemDao.getAll()
            val blocked = allItems.filter { !canSyncQuantity(it.quantity, quantitySupported.value) }
            blocked.filter { !it.id.startsWith("local_") && !it.dirty }.forEach { itemDao.upsert(it.copy(dirty = true)) }
            if (blocked.isNotEmpty()) catalogSyncError.value = "QUANTITY_UNSUPPORTED"
            val all = allItems.filter { canSyncQuantity(it.quantity, quantitySupported.value) }
            all.filter { it.dirty && !it.id.startsWith("local_") }.forEach {
                itemQueue.enqueueUpdate(
                    "shopping_items", it.id,
                    mapOf("name" to it.name, "category" to it.category, "checked" to it.checked, "note" to it.note, "in_list" to it.inList,
                    "quantity" to it.quantity, "catalog_source_id" to it.sourceId, "catalog_source_kind" to it.sourceKind, "catalog_source_category" to it.sourceCategory),
                )
            }
            all.filter { it.id.startsWith("local_") && syncMeta.pendingCreates.add(it.id) }
        }
        if (offline.isEmpty()) return
        try {
            if (!isActiveConnection(recordId, origin, connection)) return
            if (offline.size > 1) {
                val bodies = offline.map { createBody(recordId, it.name, it.category, it.checked, it.note, it.inList, it.id, it.quantity, it.sourceId, it.sourceKind, it.sourceCategory) }
                val results = runCatching { pb.batchCreateItems(bodies) }.getOrNull()
                if (!isActiveConnection(recordId, origin, connection)) return
                if (results != null && results.size == offline.size) {
                    results.forEachIndexed { i, rec -> swapTempId(offline[i].id, rec) }
                } else {
                    offline.forEach { item ->
                        if (!isActiveConnection(recordId, origin, connection)) return
                        runCatching {
                            val rec = pb.createItem(createBody(recordId, item.name, item.category, item.checked, item.note, item.inList, item.id, item.quantity, item.sourceId, item.sourceKind, item.sourceCategory))
                            if (isActiveConnection(recordId, origin, connection)) swapTempId(item.id, rec)
                        }
                    }
                }
            } else {
                val item = offline[0]
                runCatching {
                    val rec = pb.createItem(createBody(recordId, item.name, item.category, item.checked, item.note, item.inList, item.id, item.quantity, item.sourceId, item.sourceKind, item.sourceCategory))
                    if (isActiveConnection(recordId, origin, connection)) swapTempId(item.id, rec)
                }
            }
        } finally {
            offline.forEach { syncMeta.pendingCreates.remove(it.id) }
        }
    }

    private suspend fun loadListCustomData(recordId: String) {
        val origin = pb.baseUrl
        val connection = activeConnection
        runCatching {
            val cats = pb.getListCategories(recordId)
            val its = pb.getListItems(recordId)
            listLock.withLock {
                if (!isActiveConnection(recordId, origin, connection)) return@withLock
                categoryDao.replaceAll(cats.map { CustomCategoryEntity(it.key, it.icon, it.name, it.id) }, its.map { CustomItemEntity(categoryKey = it.categoryKey, name = it.name, sourceId = it.id) })
                restorePendingCatalogLocked()
            }
        }
        if (isActiveConnection(recordId, origin, connection)) loadListDisabled(recordId)
    }

    // ---- Realtime handling (ported from useListSync.ts) ----

    private suspend fun handleRealtime(recordId: String, e: RealtimeEvent) {
      listLock.withLock {
        if (_sync.value.recordId != recordId || _isGuest.value) return
        when (e.collection) {
            "shopping_items" -> handleItemEvent(recordId, e)
            "list_categories" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.CategoryRecord.serializer(), e.record)
                if (rec.list != recordId) return
                when (e.action) {
                    "create", "update" -> categoryDao.upsertCategory(CustomCategoryEntity(rec.key, rec.icon, rec.name, rec.id))
                    "delete" -> categoryDao.deleteCategory(rec.key)
                }
            }
            "list_items" -> {
                val rec = pb.json.decodeFromJsonElement(com.bor_devs.shoplist.data.remote.ListItemRecord.serializer(), e.record)
                if (rec.list != recordId) return
                when (e.action) {
                    "create", "update" -> addCustomItemLocal(rec.categoryKey, rec.name, rec.id)
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
        if (e.collection != "shopping_items") restorePendingCatalogLocked()
      }
    }

    private suspend fun handleItemEvent(recordId: String, e: RealtimeEvent) {
        val rec = pb.json.decodeFromJsonElement(ItemRecord.serializer(), e.record)
        if (rec.list != recordId) return
        if (e.action != "delete" && rec.id in itemDao.pendingDeleteIds(recordId)) return
        when (e.action) {
            "create" -> {
                val ext = rec.externalId
                if (ext in syncMeta.pendingCreates) return // create response reconciles later local edits
                if (ext.isNotBlank() && itemDao.getById(ext) != null) {
                    swapTempId(ext, rec)
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
                val prev = items.value
                val updated = itemDao.updateById(rec.id) { current ->
                    if (current.dirty || syncMeta.shouldSkipRemoteUpdate(rec.id, rec.updated, current.serverUpdated)) current
                    else rec.toEntity(current)
                } ?: return
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
        val origin = pb.baseUrl
        val members = runCatching { pb.getMyListMemberships(uid) }.getOrNull() ?: return
        if (members.isEmpty()) return
        listLock.withLock {
        if (sessionUserId != uid || pb.baseUrl != origin) return
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
    }

    suspend fun refreshInvites() {
        _invites.value = runCatching { pb.listInvites() }.getOrDefault(emptyList())
    }

    fun acceptInvite(id: String) = scope.launch {
        if (runCatching { pb.acceptInvite(id) }.isFailure) { setMsg("Error", MsgType.ERROR); return@launch }
        _invites.update { list -> list.filterNot { it.id == id } }
        reconcileAccountLists()
    }

    fun declineInvite(id: String) = scope.launch {
        if (runCatching { pb.declineInvite(id) }.isFailure) { setMsg("Error", MsgType.ERROR); return@launch }
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
      listLock.withLock {
        itemDao.clear()
        categoryDao.getCategories().forEach { categoryDao.deleteCategory(it.key) }
        _listName.value = null; prefs.setListName(null)
        disconnectLocked()
      }
    }

    suspend fun exportJson(): String {
        val its = itemDao.getAll().map { it.toDomain() }
        return pb.json.encodeToString(
            BackupData.serializer(),
            BackupData(
                listName = _listName.value,
                items = its.map { BackupItem(it.id, it.name, it.checked, it.note, it.category, it.inList, it.quantity) },
            ),
        )
    }

    suspend fun importJson(text: String): Boolean = listLock.withLock { runCatching {
        val backup = pb.json.decodeFromString(BackupData.serializer(), text)
        _listName.value = backup.listName; prefs.setListName(backup.listName)
        itemDao.replaceAll(backup.items.map {
            ItemEntity(
                // Backups carry content, not ids owned by a different list/server.
                id = "local_" + UUID.randomUUID(),
                name = it.name, checked = it.checked, note = it.note,
                category = it.category, inList = it.inList, serverUpdated = 0, updatedAt = now(), dirty = false, quantity = it.quantity,
            )
        })
        true
    }.getOrDefault(false) }

    // ---- Server configuration ----

    suspend fun testServer(url: String): Boolean = pb.health(url)

    suspend fun applyServer(url: String) {
      listLock.withLock {
        val clean = url.trim().trimEnd('/')
        authLock.withLock {
            if (clean != pb.baseUrl && pb.baseUrl.isNotBlank()) detachServer()
            pb.setBaseUrl(clean)
            serverCatalog.value = prefs.snapshot().catalogSnapshots[clean].orEmpty()
            if (clean.isNotBlank()) {
                val state = prefs.snapshot()
                state.lists.forEach { list ->
                    catalogMutationDao.forList("", list.id).filter { it.remoteListId.isBlank() }.forEach { row ->
                        catalogMutationDao.upsert(row.copy(origin = clean, principalId = ""))
                        catalogMutationDao.delete("", list.id, row.entityId)
                    }
                }
            }
            prefs.setServerUrl(clean)
            prefs.setWizardDone(true)
        }
        if (clean.isNotBlank()) {
            ensureGuestSession()
            loadCatalog()
            syncActiveListToServer()
        }
      }
    }

    suspend fun useLocalMode() {
      listLock.withLock {
        authLock.withLock {
            detachServer()
            prefs.setServerUrl("")
            pb.setBaseUrl("")
            prefs.setWizardDone(true)
        }
      }
    }

    /** Preserve the lists as local copies without sending another host's ids or token. */
    private suspend fun detachServer() {
        goLocal()
        itemQueue.clear()
        pendingDeleteDao.clear()
        pb.setToken(null)
        sessionUserId = null
        prefs.clearAuth()
        prefs.setSync(null, null)
        prefs.setSyncHistory(emptyList())
        _sync.update { it.copy(syncHistory = emptyList()) }
        val s = prefs.snapshot()
        itemDao.replaceAll(itemDao.getAll().map {
            it.copy(id = "local_" + UUID.randomUUID(), serverUpdated = 0, dirty = false, sourceId = "", sourceKind = "", sourceCategory = "")
        })
        prefs.setListCaches(s.listCaches.mapValues { (_, items) -> items.map {
            it.copy(id = "local_" + UUID.randomUUID(), serverUpdated = 0, dirty = false, sourceId = "", sourceKind = "", sourceCategory = "")
        } })
        prefs.setLists(s.lists.map { it.copy(code = null, recordId = null, isLocal = true, role = "owner") })
        categoryDao.replaceAll(categoryDao.getCategories().map { it.copy(sourceId = "") }, categoryDao.getItems().map { it.copy(sourceId = "") })
        prefs.setListExtras(s.listExtras.mapValues { (_, extras) -> extras.copy(categories = extras.categories.map { it.copy(sourceId = "") }, items = extras.items.map { it.copy(sourceId = "") }) })
        quantitySupported.value = true
        serverCatalog.value = emptyList()
        _invites.value = emptyList()
        _avatarUrl.value = null
        _avatarColor.value = null
    }

    // ---- Helpers ----

    private suspend fun markDirty(id: String) {
        itemDao.updateById(id) { it.copy(dirty = true) }
    }

    private suspend fun pushFieldUpdate(item: ItemEntity, body: Map<String, Any?>) {
        if (item.id.startsWith("local_")) return
        markDirty(item.id)
        if (!canSyncQuantity(item.quantity, quantitySupported.value)) { catalogSyncError.value = "QUANTITY_UNSUPPORTED"; return }
        if (_sync.value.connected) itemQueue.enqueueUpdate("shopping_items", item.id, body)
    }

    private suspend fun swapTempId(tempId: String, record: ItemRecord) {
        var acknowledged: ItemEntity? = null
        var deleteRemote = false
        itemDao.mergeAll(record.list) { all, _ ->
            if (_sync.value.recordId != record.list || _isGuest.value) return@mergeAll all
            val temp = all.firstOrNull { it.id == tempId }
            val realExists = all.any { it.id == record.id }
            when {
                temp == null -> { deleteRemote = !realExists; all }
                realExists -> all.filterNot { it.id == tempId }
                else -> {
                    val reconciled = reconcileCreatedItem(temp, record)
                    acknowledged = reconciled
                    all.filterNot { it.id == tempId } + reconciled
                }
            }
        }
        if (deleteRemote) {
            pendingDeleteDao.upsert(PendingItemDeleteEntity(record.id, record.list))
            itemQueue.enqueueDelete("shopping_items", record.id)
        }
        acknowledged?.takeIf { it.dirty }?.let { item ->
            pushFieldUpdate(item, mapOf(
                "name" to item.name, "category" to item.category,
                "checked" to item.checked, "note" to item.note, "in_list" to item.inList,
                "quantity" to item.quantity, "catalog_source_id" to item.sourceId, "catalog_source_kind" to item.sourceKind, "catalog_source_category" to item.sourceCategory,
            ))
        }
    }

    private suspend fun addCustomItemLocal(categoryKey: String, name: String, sourceId: String = "") {
        val existing = categoryDao.getItems().firstOrNull { (sourceId.isNotBlank() && it.sourceId == sourceId) || it.categoryKey == categoryKey && it.name == name }
        if (existing == null) categoryDao.insertItem(CustomItemEntity(categoryKey = categoryKey, name = name, sourceId = sourceId))
        else if (sourceId.isNotBlank()) categoryDao.insertItem(existing.copy(categoryKey = categoryKey, name = name, sourceId = sourceId))
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

    private fun isActiveConnection(recordId: String, origin: String, connection: Any): Boolean =
        activeConnection === connection && _sync.value.recordId == recordId && !_isGuest.value && pb.baseUrl == origin

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

    private fun ItemEntity.toCached() = CachedItem(id, name, checked, note, category, inList, serverUpdated, updatedAt, dirty, addedBy, checkedBy, quantity, sourceId, sourceKind, sourceCategory)
    private fun CachedItem.toEntity() = ItemEntity(id, name, checked, note, category, inList, serverUpdated, updatedAt, dirty, addedBy, checkedBy, quantity, sourceId, sourceKind, sourceCategory)

    private fun ItemRecord.toEntity(local: ItemEntity?): ItemEntity = ItemEntity(
        id = id, name = name, checked = checked, note = note,
        category = category.ifBlank { "other" }, inList = inList,
        serverUpdated = SyncMeta.parsePbDate(updated), updatedAt = local?.updatedAt ?: now(), dirty = false,
        addedBy = addedBy, checkedBy = checkedBy, quantity = quantity ?: local?.quantity.orEmpty(),
        sourceId = sourceId ?: local?.sourceId.orEmpty(), sourceKind = sourceKind ?: local?.sourceKind.orEmpty(), sourceCategory = sourceCategory ?: local?.sourceCategory.orEmpty(),
    )

    /** This user's display name for public-link attribution ("" → server uses "External"). */
    private fun myName(): String = settingsCache?.auth?.username?.takeIf { it.isNotBlank() } ?: ""

    private fun createBody(recordId: String, name: String, category: String, checked: Boolean, note: String, inList: Boolean, externalId: String, quantity: String = "", sourceId: String = "", sourceKind: String = "", sourceCategory: String = ""): JsonObject =
        buildJsonObject {
            put("list", recordId); put("name", name); put("category", category)
            put("checked", checked); put("note", note); put("in_list", inList); put("external_id", externalId)
            if (quantitySupported.value) put("quantity", quantity); put("catalog_source_id", sourceId); put("catalog_source_kind", sourceKind); put("catalog_source_category", sourceCategory)
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
        base.forEach { category ->
            map[category.key] = category.copy(items = category.items.map { item ->
                item.copy(sourceId = item.sourceId.ifBlank { builtinSourceId(category.key, item) }, sourceCategory = category.key)
            })
        }
        customCats.forEach { cc -> if (!map.containsKey(cc.key)) map[cc.key] = Category(cc.key, cc.icon, emptyList(), displayName = cc.displayName.ifBlank { null }) }
        customItems.forEach { ci ->
            map[ci.categoryKey]?.let { cat ->
                map[ci.categoryKey] = cat.copy(items = cat.items + LocalizedItem(ci.name, ci.name, ci.name, ci.sourceId, "custom", ci.categoryKey))
            }
        }
        return map
    }

    data class JoinInfo(
        val recordId: String, val name: String, val code: String, val hasLocalItems: Boolean,
        val sourceListId: String, val serverUrl: String,
    )

    @kotlinx.serialization.Serializable
    private data class BackupData(val listName: String?, val items: List<BackupItem>)

    @kotlinx.serialization.Serializable
    private data class BackupItem(
        val id: String, val name: String, val checked: Boolean,
        val note: String, val category: String, val inList: Boolean, val quantity: String = "",
    )

    companion object { private const val TAG = "ShopRepository" }
}
