import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShopItem, Categories, Lang, AppMode, ViewMode, LocalizedItem, AuthState, PresenceUser } from '../types';
import { defaultCategories } from '../data/constants';
import { pb, normalizeServerUrl } from '../lib/pocketbase';
import { isConfigEnabled } from '../utils/config';
import { enqueueItemUpdate, enqueueItemDelete, itemQueue } from '../lib/itemWriteQueue';
import { canonicalKey } from '../utils/helpers';
import { pendingCreates, resetSyncMeta } from '../lib/syncMeta';
import { reconcileCreatedItem, type ItemRecord } from '../lib/itemSync';
import { createProductActions, beginCatalogSnapshotRequest, isCatalogSnapshotRequestCurrent, type ProductActions } from './productActions';

interface SyncHistoryItem {
    code: string;
    title?: string;
    lastUsed: number;
}

interface SyncState {
    connected: boolean;
    code: string | null;
    recordId: string | null;
    msg: string;
    msgType: 'info' | 'success' | 'error';
    syncHistory: SyncHistoryItem[];
    lastSync: number | null;
    syncVersion: number;
    lastLocalInteraction: number;
}

// ===== v2 multi-list ("Les meves llistes") =====
// Each saved list is local-only until it gets a sync code/recordId.
// The shared base catalog is combined with each list's custom suggestions,
// visibility choices, purchases and sync linkage.
export interface SavedList {
    id: string;
    name: string | null;
    emoji: string;
    code: string | null;       // sync code, null => local list
    recordId: string | null;   // PocketBase record id when synced
    isLocal: boolean;
    autoSync?: boolean;       // false after an explicit disconnect
}

interface ListCache {
    items: ShopItem[];
    categories?: Categories;
    deletedItemIds?: string[];
    disabledProducts?: string[];
    disabledCategories?: string[];
    listName: string | null;
    code: string | null;
    recordId: string | null;
}

interface ServerWorkspace {
    items: ShopItem[];
    deletedItemIds: string[];
    categories: Categories;
    catalogCategories: Categories;
    disabledProducts: string[];
    disabledCategories: string[];
    listName: string | null;
    lists: SavedList[];
    activeListId: string;
    listCaches: Record<string, ListCache>;
    sync: SyncState;
}

export const DEFAULT_LIST_ID = 'default';

export interface ShopState extends ProductActions {
    // Data
    items: ShopItem[];
    deletedItemIds: string[];
    categories: Categories;
    catalogCategories: Categories;
    // Canonical keys of products deactivated for the active list (synced per list).
    disabledProducts: string[];
    disabledCategories: string[];
    listName: string | null;

    // Multi-list
    lists: SavedList[];
    activeListId: string;
    listCaches: Record<string, ListCache>;

    // UI State
    lang: Lang;
    langManual: boolean; // true once the user picks a language → stop auto-detecting from the browser locale
    appMode: AppMode;
    viewMode: ViewMode;
    theme: 'light' | 'dark' | 'amoled' | 'auto';
    isDark: boolean;
    isAmoled: boolean;
    notifyOnAdd: boolean;
    notifyOnCheck: boolean;
    serverName: string;
    activeUsers: PresenceUser[];
    sortOrder: 'category' | 'alpha';
    showCompletedInline: boolean;

    // Auto-clear state
    autoClearScheduled: number | null;  // timestamp when scheduled
    autoClearMinutes: number;           // minutes to wait (default 60)
    autoClearEnabled: boolean;

    // Sync & Auth
    sync: SyncState;
    auth: AuthState;
    enableUsernames: boolean;
    requireAccount: boolean;
    registrationOpen: boolean;
    serverUrl: string; // For native apps to configure remote server
    serverWorkspaces: Record<string, ServerWorkspace>;

    // Actions
    setLang: (lang: Lang) => void;
    setLangManual: (manual: boolean) => void;
    setServerName: (name: string) => void;
    setEnableUsernames: (val: boolean) => void;
    setServerUrl: (url: string) => void;
    setAppMode: (mode: AppMode) => void;
    setViewMode: (mode: ViewMode) => void;
    setTheme: (theme: 'light' | 'dark' | 'amoled' | 'auto') => void;
    updateSystemTheme: (isSystemDark: boolean) => void;
    toggleTheme: () => void;
    toggleAmoled: () => void;
    setNotifyOnAdd: (val: boolean) => void;
    setNotifyOnCheck: (val: boolean) => void;
    setSortOrder: (order: 'category' | 'alpha') => void;
    setShowCompletedInline: (val: boolean) => void;

    addItem: (name: string, cat?: string) => void;
    confirmItemCreated: (tempId: string, record: ItemRecord) => void;
    toggleCheck: (id: string) => void;
    deleteItem: (id: string) => void;
    updateItemNote: (id: string, note: string) => void;
    clearCompleted: () => void;
    removeFromList: (id: string) => void;
    addBackToList: (id: string) => void;
    clearPreviouslyUsed: () => void;
    scheduleAutoClear: () => void;
    cancelAutoClear: () => void;
    setAutoClearEnabled: (val: boolean) => void;
    checkAndAutoClear: () => Promise<void>;

    addCategoryItem: (catKey: string, name: LocalizedItem) => Promise<void>;
    removeCategoryItem: (catKey: string, idx: number) => Promise<void>;
    setListName: (name: string | null) => void;

    // Multi-list actions
    createList: (name: string | null, emoji?: string) => string; // returns new list id, switches to it
    switchList: (id: string) => void;
    deleteList: (id: string) => void;
    setActiveListEmoji: (emoji: string) => void;
    registerActiveListSync: (meta: { code: string | null; recordId: string | null }) => void;

    // Category Management
    addCategory: (key: string, icon: string) => Promise<void>;
    removeCategory: (key: string) => Promise<void>;

    // Sync Actions
    setSyncState: (s: Partial<SyncState>) => void;
    syncFromRemote: (data: { items: ShopItem[], categories?: Categories, listName?: string | null }) => void;
    resetDefaults: () => void;
    resetLocalList: () => void;
    importData: (items: ShopItem[], categories: Categories, listName?: string | null) => void;
    addToSyncHistory: (code: string) => void;
    removeFromSyncHistory: (code: string) => void;
    loadCatalog: () => Promise<void>;
    loadListCustomData: () => Promise<void>;

    // Per-list catalog visibility; purchases and history are preserved.
    deactivateProduct: (item: LocalizedItem | string) => Promise<void>;
    reactivateProduct: (item: LocalizedItem | string) => Promise<void>;
    deactivateCategory: (key: string) => void;
    reactivateCategory: (key: string) => void;

    // Auth Actions
    setAuth: (auth: Partial<AuthState>) => void;
    setUsername: (name: string) => void;
    setActiveUsers: (users: PresenceUser[]) => void;
    logout: () => void;
}

export const useShopStore = create<ShopState>()(
    persist(
        (set, get) => ({
            ...createProductActions(set, get),
            items: [],
            deletedItemIds: [],
            categories: defaultCategories,
            catalogCategories: defaultCategories,
            disabledProducts: [],
            disabledCategories: [],
            listName: null,
            lists: [{ id: DEFAULT_LIST_ID, name: null, emoji: '🛒', code: null, recordId: null, isLocal: true }],
            activeListId: DEFAULT_LIST_ID,
            listCaches: {},
            lang: 'ca',
            langManual: false,
            appMode: 'planning',
            viewMode: 'list',
            theme: 'auto',
            isDark: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
            isAmoled: false,
            notifyOnAdd: true,
            notifyOnCheck: true,
            serverName: 'ShoppingList',
            requireAccount: false,
            registrationOpen: true,
            activeUsers: [],
            sync: { connected: false, code: null, recordId: null, msg: '', msgType: 'info', syncHistory: [], lastSync: null, syncVersion: 0, lastLocalInteraction: 0 },
            auth: { isLoggedIn: false, email: null, userId: null, username: null, avatarUrl: null, avatarColor: null },
            enableUsernames: false,
            serverUrl: '',
            serverWorkspaces: {},
            sortOrder: 'category',
            showCompletedInline: false,
            autoClearScheduled: null,
            autoClearMinutes: 60,
            autoClearEnabled: true,

            setLang: (lang) => set({ lang }),
            setLangManual: (langManual) => set({ langManual }),
            setServerName: (serverName) => set({ serverName }),
            setEnableUsernames: (enableUsernames) => set({ enableUsernames }),
            setServerUrl: (serverUrl) => {
                const state = get();
                const previousUrl = normalizeServerUrl(state.serverUrl || pb.baseURL);
                const nextUrl = normalizeServerUrl(serverUrl);
                if (previousUrl === nextUrl) { set({ serverUrl }); return; }
                const previous: ServerWorkspace = {
                    items: state.items,
                    deletedItemIds: state.deletedItemIds,
                    categories: state.categories,
                    catalogCategories: state.catalogCategories,
                    disabledProducts: state.disabledProducts,
                    disabledCategories: state.disabledCategories,
                    listName: state.listName,
                    lists: state.lists,
                    activeListId: state.activeListId,
                    listCaches: state.listCaches,
                    sync: { ...state.sync, connected: false },
                };
                const next = state.serverWorkspaces[nextUrl];
                itemQueue.clear();
                resetSyncMeta();
                set({
                    serverUrl,
                    serverWorkspaces: { ...state.serverWorkspaces, [previousUrl]: previous },
                    ...(next ?? {
                        items: [], deletedItemIds: [], categories: defaultCategories, catalogCategories: defaultCategories,
                        disabledProducts: [], disabledCategories: [], listName: null,
                        lists: [{ id: DEFAULT_LIST_ID, name: null, emoji: '🛒', code: null, recordId: null, isLocal: true }],
                        activeListId: DEFAULT_LIST_ID, listCaches: {},
                        sync: { ...state.sync, connected: false, code: null, recordId: null, syncHistory: [], lastSync: null },
                    }),
                    sync: {
                        ...(next?.sync ?? state.sync), connected: false,
                        code: next?.sync.code ?? null, recordId: next?.sync.recordId ?? null,
                        syncHistory: next?.sync.syncHistory ?? [], lastSync: next?.sync.lastSync ?? null,
                        msg: '', msgType: 'info', syncVersion: 0, lastLocalInteraction: 0,
                    },
                    auth: { isLoggedIn: false, email: null, userId: null, username: null, avatarUrl: null, avatarColor: null },
                    activeUsers: [], quantitySupported: null, catalogSyncStatus: 'saved', catalogSyncError: null, serverName: 'ShoppingList', requireAccount: false,
                    registrationOpen: true, enableUsernames: false,
                });
            },
            setAppMode: (appMode) => set((state) => {
                if (appMode === 'planning' && state.viewMode === 'grid') {
                    return { appMode, viewMode: 'compact' };
                }
                return { appMode };
            }),
            setViewMode: (viewMode) => set({ viewMode }),
            setTheme: (theme) => set(() => {
                const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                return {
                    theme,
                    isDark: theme === 'auto' ? isSystemDark : theme !== 'light',
                    isAmoled: theme === 'amoled'
                };
            }),
            updateSystemTheme: (isSystemDark) => set((state) => {
                if (state.theme === 'auto') {
                    return { isDark: isSystemDark, isAmoled: false };
                }
                return {};
            }),
            toggleTheme: () => set((state) => {
                // Cycle: light -> dark -> auto -> light
                const order: ('light' | 'dark' | 'auto')[] = ['light', 'dark', 'auto'];
                const currentIdx = order.indexOf(state.theme === 'amoled' ? 'dark' : state.theme as any);
                const nextTheme = order[(currentIdx + 1) % order.length];

                const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

                return {
                    theme: nextTheme,
                    isDark: nextTheme === 'auto' ? isSystemDark : nextTheme !== 'light',
                    isAmoled: false
                };
            }),
            toggleAmoled: () => set((state) => {
                const newTheme = state.theme === 'amoled' ? 'dark' : 'amoled';
                return {
                    theme: newTheme,
                    isDark: true,
                    isAmoled: newTheme === 'amoled'
                };
            }),
            setNotifyOnAdd: (notifyOnAdd) => set({ notifyOnAdd }),
            setNotifyOnCheck: (notifyOnCheck) => set({ notifyOnCheck }),
            setSortOrder: (sortOrder) => set({ sortOrder }),
            setShowCompletedInline: (showCompletedInline) => set({ showCompletedInline }),

            addItem: async (name, cat = 'other') => {
                const { sync, items, activeListId } = get();
                const client = pb;

                // Check for existing item with same name (case insensitive)
                const existing = items.find(i => i.name.toLowerCase() === name.toLowerCase());
                if (existing) {
                    // If already active and in list, just skip or maybe update category if it was "other"
                    if (existing.inList && !existing.checked) return;

                    // Reuse existing item
                    set({
                        items: items.map(i => i.id === existing.id ? { ...i, inList: true, checked: false, category: cat, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') } : i),
                        sync: { ...sync, lastLocalInteraction: Date.now() }
                    });

                    if (sync.recordId && !existing.id.startsWith('local_')) {
                        enqueueItemUpdate(existing.id, { in_list: true, checked: false, category: cat });
                    }
                    return;
                }

                const tempId = `local_${crypto.randomUUID()}`;
                // ... (rest of addItem code remains same)
                // 1. Optimistic Update
                set({
                    items: [{
                        id: tempId,
                        name,
                        checked: false,
                        note: '',
                        category: cat,
                        inList: true,
                        // updatedAt is now server managed, but we keep it for local sorting/logic if needed
                        updatedAt: Date.now()
                    }, ...items],
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network Call (if connected)
                if (sync.connected && sync.recordId) {
                    // external_id lets the realtime create event be matched back to
                    // this temp item, so a subscription racing us can't duplicate it.
                    pendingCreates.add(tempId);
                    try {
                        const record = await pb.collection('shopping_items').create({
                            list: sync.recordId,
                            name,
                            category: cat,
                            checked: false,
                            note: '',
                            in_list: true,
                            external_id: tempId
                        });

                        if (pb === client) get().confirmItemCreated(tempId, record as unknown as ItemRecord);
                    } catch (e) {
                        // Keep the item local; the reconnect push will retry the create.
                        console.error("Failed to add atomic item", e);
                        if (pb === client && get().activeListId === activeListId) set((state) => ({ sync: { ...state.sync, msg: 'Error syncing item', msgType: 'error' } }));
                    } finally {
                        pendingCreates.delete(tempId);
                    }
                }
            },
            confirmItemCreated: (tempId, record) => {
                const state = get();
                // The user may have switched lists while the create was pending.
                const cacheEntry = Object.entries(state.listCaches).find(([id, cache]) =>
                    id !== state.activeListId && (cache.items.some(i => i.id === tempId || i.id === record.id) || cache.deletedItemIds?.includes(tempId)));
                const current = state.items.some(i => i.id === tempId || i.id === record.id) || state.deletedItemIds.includes(tempId);
                const result = reconcileCreatedItem(current ? state.items : cacheEntry?.[1].items ?? [], tempId, record);
                if (current) set({ items: result.items });
                else if (cacheEntry) set({ listCaches: { ...state.listCaches, [cacheEntry[0]]: { ...cacheEntry[1], items: result.items } } });
                const deletedIds = current ? state.deletedItemIds : cacheEntry?.[1].deletedItemIds ?? [];
                if (result.deleted || deletedIds.includes(tempId)) {
                    const ids = [...new Set([...deletedIds.filter(id => id !== tempId), record.id])];
                    if (current) set({ items: result.items.filter(i => i.id !== record.id), deletedItemIds: ids });
                    else if (cacheEntry) set((latest) => ({ listCaches: { ...latest.listCaches, [cacheEntry[0]]: { ...latest.listCaches[cacheEntry[0]], items: result.items.filter(i => i.id !== record.id), deletedItemIds: ids } } }));
                    enqueueItemDelete(record.id);
                }
                else if (result.update) enqueueItemUpdate(record.id, result.update);
            },
            toggleCheck: async (id) => {
                const { sync, items } = get();
                const item = items.find(i => i.id === id);
                if (!item) return;

                // 1. Optimistic
                set({
                    items: items.map(i => i.id === id ? { ...i, checked: !i.checked, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network (queued: retries with backoff instead of reverting on
                // transient errors, which used to lose edits and clobber remote state)
                if (sync.recordId && !id.startsWith('local_')) {
                    enqueueItemUpdate(id, { checked: !item.checked });
                }
            },
            deleteItem: async (id) => {
                const { sync, items, deletedItemIds } = get();

                // 1. Optimistic
                set({
                    deletedItemIds: (!id.startsWith('local_') || pendingCreates.has(id)) ? [...new Set([...deletedItemIds, id])] : deletedItemIds,
                    items: items.filter(i => i.id !== id),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network (queued with retries)
                if (sync.recordId && !id.startsWith('local_')) {
                    enqueueItemDelete(id);
                }
            },
            updateItemNote: async (id, note) => {
                const { sync, items } = get();

                // 1. Optimistic
                set({
                    items: items.map(i => i.id === id ? { ...i, note, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network (queued with retries)
                if (sync.recordId && !id.startsWith('local_')) {
                    enqueueItemUpdate(id, { note });
                }
            },
            clearCompleted: async () => {
                const { sync, items } = get();
                const completed = items.filter(i => i.checked && i.inList !== false);

                // 1. Optimistic: Mark as not in list (moved to recently used)
                set({
                    items: items.map(i => i.checked ? { ...i, checked: false, inList: false, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                if (sync.recordId) {
                    completed.filter(i => !i.id.startsWith('local_')).forEach(i =>
                        enqueueItemUpdate(i.id, { in_list: false, checked: false }));
                }
            },

            // Planner mode: remove from active list (move to "previously used")
            removeFromList: async (id) => {
                const { sync, items } = get();

                // 1. Optimistic: mark as not in list
                set({
                    items: items.map(i => i.id === id ? { ...i, inList: false, checked: false, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network: update inList field (queued with retries)
                if (sync.recordId && !id.startsWith('local_')) {
                    enqueueItemUpdate(id, { in_list: false, checked: false });
                }
            },

            // Planner mode: add back to active list from "previously used"
            addBackToList: async (id) => {
                const { sync, items } = get();

                // 1. Optimistic
                set({
                    items: items.map(i => i.id === id ? { ...i, inList: true, checked: false, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') } : i),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                // 2. Network (queued with retries)
                if (sync.recordId && !id.startsWith('local_')) {
                    enqueueItemUpdate(id, { in_list: true, checked: false });
                }
            },

            // Clear previously used items (permanent delete)
            clearPreviouslyUsed: async () => {
                const { sync, items, appMode } = get();
                const previouslyUsed = items.filter(i =>
                    i.inList === false || (appMode === 'planning' && i.checked)
                );

                // 1. Optimistic
                set({
                    items: items.filter(i => i.inList !== false && (appMode !== 'planning' || !i.checked)),
                    sync: { ...sync, lastLocalInteraction: Date.now() }
                });

                const remote = previouslyUsed.filter(i => !i.id.startsWith('local_'));
                set((state) => ({ deletedItemIds: [...new Set([...state.deletedItemIds, ...previouslyUsed.filter(i => !i.id.startsWith('local_') || pendingCreates.has(i.id)).map(i => i.id)])] }));
                if (sync.recordId) remote.forEach(i => enqueueItemDelete(i.id));
            },

            // Schedule auto-clear of completed items (shopping mode)
            scheduleAutoClear: () => set({ autoClearScheduled: Date.now() }),

            // Cancel auto-clear
            cancelAutoClear: () => set({ autoClearScheduled: null }),

            setAutoClearEnabled: (autoClearEnabled) => set({ autoClearEnabled }),

            checkAndAutoClear: async () => {
                const { items, autoClearEnabled, autoClearMinutes, sync } = get();
                if (!autoClearEnabled) return;
                const cutoff = Date.now() - autoClearMinutes * 60 * 1000;
                const stale = new Set(items.filter(i => i.checked && i.inList !== false &&
                    i.updatedAt !== undefined && i.updatedAt <= cutoff).map(i => i.id));
                if (!stale.size) return;
                set({ items: items.map(i => stale.has(i.id)
                    ? { ...i, checked: false, inList: false, updatedAt: Date.now(), dirty: !i.id.startsWith('local_') }
                    : i) });
                if (sync.recordId) stale.forEach(id => {
                    if (!id.startsWith('local_')) enqueueItemUpdate(id, { in_list: false, checked: false });
                });
            },


            setListName: (listName) => set((state) => ({
                listName,
                lists: state.lists.map(l => l.id === state.activeListId ? { ...l, name: listName } : l),
                sync: { ...state.sync, lastLocalInteraction: Date.now() }
            })),

            // ===== Multi-list =====
            createList: (name, emoji = '🛒') => {
                const id = `list_${crypto.randomUUID()}`;
                const { lists, activeListId, items, categories, catalogCategories, deletedItemIds, disabledProducts, disabledCategories, listName, sync, listCaches } = get();
                // Snapshot the current active list before switching away
                const newCaches = {
                    ...listCaches,
                    [activeListId]: { items, categories, deletedItemIds, disabledProducts, disabledCategories, listName, code: sync.code, recordId: sync.recordId },
                };
                set({
                    lists: [...lists, { id, name: name || null, emoji, code: null, recordId: null, isLocal: true }],
                    listCaches: newCaches,
                    activeListId: id,
                    items: [],
                    categories: catalogCategories,
                    deletedItemIds: [],
                    disabledProducts: [],
                    disabledCategories: [],
                    activeUsers: [],
                    listName: name || null,
                    sync: { ...sync, connected: false, code: null, recordId: null, msg: '', msgType: 'info' as const },
                });
                get().refreshCatalogProjection();
                return id;
            },

            switchList: (id) => {
                const { activeListId, items, categories, catalogCategories, deletedItemIds, disabledProducts, disabledCategories, listName, sync, listCaches, lists } = get();
                if (id === activeListId) return;
                const target = lists.find(l => l.id === id);
                if (!target) return;
                // Save current active list's slice
                const newCaches = {
                    ...listCaches,
                    [activeListId]: { items, categories, deletedItemIds, disabledProducts, disabledCategories, listName, code: sync.code, recordId: sync.recordId },
                };
                const cached = newCaches[id];
                set({
                    activeListId: id,
                    listCaches: newCaches,
                    items: cached?.items ?? [],
                    categories: cached?.categories ?? catalogCategories,
                    listName: cached?.listName ?? target.name,
                    // Reset per-list disabled set; loadListCustomData repopulates for synced lists
                    deletedItemIds: cached?.deletedItemIds ?? [],
                    disabledProducts: cached?.disabledProducts ?? [],
                    disabledCategories: cached?.disabledCategories ?? [],
                    activeUsers: [],
                    // Re-point sync at the target list; hooks (useListSync) reconnect for synced lists
                    sync: {
                        ...sync,
                        connected: false,
                        code: target.code,
                        recordId: target.recordId,
                        msg: '',
                        msgType: 'info' as const,
                        syncVersion: 0,
                        lastLocalInteraction: 0,
                    },
                });
                get().refreshCatalogProjection();
            },

            deleteList: (id) => {
                const { lists, activeListId, listCaches } = get();
                if (lists.length <= 1) return; // never delete the last list
                const remaining = lists.filter(l => l.id !== id);
                const newCaches = { ...listCaches };
                delete newCaches[id];
                if (id === activeListId) {
                    // Switch to the first remaining list, loading its cache
                    const next = remaining[0];
                    const cached = newCaches[next.id];
                    set((state) => ({
                        lists: remaining,
                        listCaches: newCaches,
                        activeListId: next.id,
                        items: cached?.items ?? [],
                        categories: cached?.categories ?? state.catalogCategories,
                        deletedItemIds: cached?.deletedItemIds ?? [],
                        disabledProducts: cached?.disabledProducts ?? [],
                        disabledCategories: cached?.disabledCategories ?? [],
                        activeUsers: [],
                        listName: cached?.listName ?? next.name,
                        sync: {
                            ...state.sync,
                            connected: false,
                            code: next.code,
                            recordId: next.recordId,
                            msg: '',
                            msgType: 'info' as const,
                            syncVersion: 0,
                            lastLocalInteraction: 0,
                        },
                    }));
                } else {
                    set({ lists: remaining, listCaches: newCaches });
                }
            },

            setActiveListEmoji: (emoji) => {
                set((state) => ({
                    lists: state.lists.map(l => l.id === state.activeListId ? { ...l, emoji } : l),
                }));
                // Persist the emoji on the server so it shows on every device.
                const { sync } = get();
                const client = pb;
                if (sync.connected && sync.recordId) {
                    const rid = sync.recordId;
                    client.collection('shopping_lists').getOne(rid)
                        .then((rec: any) => client.collection('shopping_lists').update(rid, { data: { ...(rec.data || {}), emoji } }))
                        .catch(() => { /* best effort */ });
                }
            },

            // Called when the active list becomes synced (create/join) or disconnects.
            registerActiveListSync: ({ code, recordId }) => set((state) => ({
                lists: state.lists.map(l => l.id === state.activeListId
                    ? { ...l, code, recordId, isLocal: !recordId }
                    : l),
            })),

            addCategoryItem: async (category, item) => {
                const state = get();
                await state.createProduct({ name: item[state.lang] || item.en || item.es || item.ca, category, addToList: false });
            },
            removeCategoryItem: async (category, index) => {
                const item = get().categories[category]?.items[index];
                if (item) await get().deleteCatalogItem(category, item);
            },
            addCategory: async (name, icon) => { await get().createCatalogCategory(name, icon); },
            removeCategory: async (key) => { await get().deleteCatalogCategory(key); },

            setSyncState: (s) => set((state) => {
                const sync = { ...state.sync, ...s };
                // Keep the active list's sync linkage mirrored whenever code/recordId change
                let lists = state.lists;
                if ('code' in s || 'recordId' in s) {
                    lists = state.lists.map(l => l.id === state.activeListId
                        ? { ...l, code: sync.code, recordId: sync.recordId, isLocal: !sync.recordId }
                        : l);
                }
                return { sync, lists };
            }),
            syncFromRemote: (data) => set({ items: data.items, categories: data.categories || defaultCategories, listName: data.listName || null }),

            resetDefaults: () => set({ items: [], categories: defaultCategories, listName: null }),
            // Clear the device-local list and disconnect from any shared list.
            // Used on logout when the user chooses not to keep the local list.
            resetLocalList: () => set((state) => ({
                items: [],
                deletedItemIds: [],
                disabledProducts: [],
                disabledCategories: [],
                lists: state.lists.map(l => l.id === state.activeListId ? { ...l, name: null, code: null, recordId: null, isLocal: true } : l),
                categories: defaultCategories,
                listName: null,
                sync: { ...state.sync, connected: false, code: null, recordId: null, msg: '', msgType: 'info' as const },
            })),
            importData: (items, categories, listName) => {
                const state = get();
                const origin = normalizeServerUrl(state.serverUrl || pb.baseURL);
                set({ items: items.map(item => ({ ...item, quantity: item.quantity || '' })), categories, listName: listName || null,
                    catalogEntries: state.catalogEntries.filter(entry => entry.origin !== origin || entry.listId !== state.activeListId || entry.remoteListId !== state.sync.recordId),
                    catalogInitializedScopes: state.catalogInitializedScopes.filter(key => key !== `${origin}\n${state.activeListId}\n${state.sync.recordId || ''}`) });
                get().initializeCatalogEntries();
                void get().flushCatalogChanges();
            },

            // Auth Actions
            setAuth: (auth) => set((state) => ({ auth: { ...state.auth, ...auth } })),
            setUsername: (username) => set((state) => ({ auth: { ...state.auth, username } })),
            setActiveUsers: (activeUsers) => set({ activeUsers }),
            logout: () => set({ auth: { isLoggedIn: false, email: null, userId: null, username: null, avatarUrl: null, avatarColor: null } }),
            addToSyncHistory: (code: string) => set((state) => {
                const title = state.listName || undefined;
                // Remove existing entry for this code if present
                const filtered = state.sync.syncHistory.filter(h => typeof h === 'string' ? h !== code : h.code !== code);

                // Add new entry at top
                const newEntry = { code, title, lastUsed: Date.now() };
                const history = [newEntry, ...filtered].slice(0, 5);

                return { sync: { ...state.sync, syncHistory: history } };
            }),
            removeFromSyncHistory: (code: string) => set((state) => {
                const history = state.sync.syncHistory.filter(h => typeof h === 'string' ? h !== code : h.code !== code);
                return { sync: { ...state.sync, syncHistory: history } };
            }),

            loadCatalog: async () => {
                get().initializeCatalogEntries();
                void get().checkServerCapabilities();
                const client = pb;
                try {
                    const cats = await client.collection('catalog_categories').getFullList({ sort: 'order', filter: 'hidden = false' });
                    const items = await client.collection('catalog_items').getFullList({ expand: 'category', filter: 'hidden = false' });

                    if (pb !== client) return;
                    if (cats.length === 0) return; // Keep defaults if DB empty or all hidden

                    const newCats: Categories = {};
                    cats.forEach((c: any) => {
                        newCats[c.key] = {
                            icon: c.icon,
                            items: [],
                            color: c.color,
                            // server label in all languages (i18n overrides es/ca/en)
                            names: { es: c.name_es || '', ca: c.name_ca || c.name_es || '', en: c.name_en || c.name_es || '', ...(c.i18n || {}) },
                        };
                    });

                    items.forEach((i: any) => {
                        const catKey = i.expand?.category?.key;
                        const catHidden = i.expand?.category?.hidden;

                        // Only add if category is also not hidden (extra safety)
                        if (catKey && newCats[catKey] && !catHidden) {
                            newCats[catKey].items.push({
                                _catalogId: String(i.id),
                                _catalogKind: 'global',
                                es: i.name_es || '',
                                ca: i.name_ca || i.name_es || '',
                                en: i.name_en || i.name_es || '',
                                // 15-language translations (additive; falls back to es/ca/en/en)
                                ...(i.i18n || {}),
                            });
                        }
                    });

                    const previous = get();
                    const viewCats = { ...newCats };
                    // Loading a fresh shared catalog must preserve local custom
                    // products/categories for the active list.
                    Object.entries(previous.categories).forEach(([key, category]) => {
                        const oldBase = previous.catalogCategories[key];
                        if (!oldBase) {
                            viewCats[key] = category;
                        } else if (viewCats[key]) {
                            const baseKeys = new Set(oldBase.items.map(canonicalKey));
                            const custom = category.items.filter(item => !baseKeys.has(canonicalKey(item)));
                            if (custom.length) viewCats[key] = { ...viewCats[key], items: [...viewCats[key].items, ...custom] };
                        }
                    });
                    set({ categories: viewCats, catalogCategories: newCats });
                    get().refreshCatalogProjection();

                    // Load server config
                    try {
                        const config = await client.collection('app_config').getFullList();

                        if (pb !== client) return;
                        const srvNameRecord = config.find(c => c.key === 'server_name');
                        if (srvNameRecord) set({ serverName: srvNameRecord.value });

                        const enableUsernamesRecord = config.find(c => c.key === 'enable_usernames');
                        if (enableUsernamesRecord) set({ enableUsernames: isConfigEnabled(enableUsernamesRecord.value) });

                        const requireAccountRecord = config.find(c => c.key === 'require_account');
                        set({ requireAccount: requireAccountRecord ? isConfigEnabled(requireAccountRecord.value, false) : false });
                        const registrationOpenRecord = config.find(c => c.key === 'registration_open');
                        set({ registrationOpen: registrationOpenRecord ? isConfigEnabled(registrationOpenRecord.value, true) : true });

                    } catch (e) {
                        console.error("Failed to load server config", e);
                    }
                } catch (e) {
                    console.error("Failed to load catalog", e);
                }
            },

            loadListCustomData: async () => {
                get().initializeCatalogEntries();
                const client = pb;
                const { sync, activeListId } = get();
                if (!sync.connected || !sync.recordId) return;
                const startedAt = Date.now();
                const generation = beginCatalogSnapshotRequest(get());
                try {
                    const collections = ['list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories'] as const;
                    const results = await Promise.all(collections.map(collection => client.collection(collection).getFullList({
                        filter: client.filter('list = {:list}', { list: sync.recordId }), requestKey: null,
                    })));
                    if (pb !== client || !get().sync.connected || get().activeListId !== activeListId || get().sync.recordId !== sync.recordId || !isCatalogSnapshotRequestCurrent(get(), generation)) return;
                    const rows = results.flatMap((records, index) => records.map(record => ({
                        id: record.id, collection: collections[index],
                        data: (collections[index] === 'list_categories' ? { key: String(record.key), name: String(record.name || record.key), icon: String(record.icon || '📦') }
                            : collections[index] === 'list_items' ? { category_key: String(record.category_key), name: String(record.name) }
                            : collections[index] === 'list_disabled_products' ? { name: String(record.name) } : { key: String(record.key) }) as Record<string, string>,
                    })));
                    get().mergeCatalogSnapshot(rows, startedAt);
                    void get().flushCatalogChanges();
                } catch (error) { console.error('Failed to load list custom data', error); }
            },
            deactivateProduct: async (item) => { await get().setProductVisibility(item, true); },
            reactivateProduct: async (item) => { await get().setProductVisibility(item, false); },
            deactivateCategory: (key) => { get().setCategoryVisibility(key, true); },
            reactivateCategory: (key) => { get().setCategoryVisibility(key, false); },

        }),
        {
            name: 'shoplist-storage',
            version: 2,
            migrate: (persisted: any) => {
                // Seed multi-list state for users upgrading from the single-list v1 store
                if (persisted && !persisted.lists) {
                    const sync = persisted.sync || {};
                    persisted.lists = [{
                        id: DEFAULT_LIST_ID,
                        name: persisted.listName ?? null,
                        emoji: '🛒',
                        code: sync.code ?? null,
                        recordId: sync.recordId ?? null,
                        isLocal: !(sync.code),
                    }];
                    persisted.activeListId = DEFAULT_LIST_ID;
                    persisted.listCaches = {};
                }
                if (persisted) {
                    persisted.catalogEntries ??= [];
                    persisted.catalogInitializedScopes ??= [];
                    persisted.quantityCapabilities ??= {};
                    const normalizeItems = (items: ShopItem[] = []) => items.map(item => ({ ...item, quantity: item.quantity || '' }));
                    persisted.items = normalizeItems(persisted.items);
                    for (const cache of Object.values(persisted.listCaches || {}) as ListCache[]) cache.items = normalizeItems(cache.items);
                    for (const workspace of Object.values(persisted.serverWorkspaces || {}) as ServerWorkspace[]) {
                        workspace.items = normalizeItems(workspace.items);
                        for (const cache of Object.values(workspace.listCaches || {})) cache.items = normalizeItems(cache.items);
                    }
                }
                return persisted;
            },
            partialize: (state) => ({
                catalogEntries: state.catalogEntries,
                catalogInitializedScopes: state.catalogInitializedScopes,
                quantityCapabilities: state.quantityCapabilities,
                items: state.items,
                deletedItemIds: state.deletedItemIds,
                disabledProducts: state.disabledProducts,
                disabledCategories: state.disabledCategories,
                categories: state.categories,
                catalogCategories: state.catalogCategories,
                listName: state.listName,
                lists: state.lists,
                activeListId: state.activeListId,
                listCaches: state.listCaches,
                lang: state.lang,
                langManual: state.langManual,
                appMode: state.appMode,
                viewMode: state.viewMode,
                theme: state.theme,
                isDark: state.isDark,
                isAmoled: state.isAmoled,
                notifyOnAdd: state.notifyOnAdd,
                notifyOnCheck: state.notifyOnCheck,
                serverName: state.serverName,
                // Persist serverUrl for native apps custom server config
                serverUrl: state.serverUrl,
                serverWorkspaces: state.serverWorkspaces,
                enableUsernames: false,
                sortOrder: state.sortOrder,
                showCompletedInline: state.showCompletedInline,
                autoClearEnabled: state.autoClearEnabled,
                // Keep code/recordId for reconnection, but reset connection status
                sync: {
                    connected: false,
                    code: state.sync.code,
                    recordId: state.sync.recordId,
                    msg: '',
                    msgType: 'info' as const,
                    syncHistory: state.sync.syncHistory.map(h => typeof h === 'string' ? { code: h, lastUsed: Date.now() } : h),
                    lastSync: state.sync.lastSync,
                    syncVersion: 0,
                    lastLocalInteraction: 0
                },
                auth: state.auth
            })
        }
    )
);
