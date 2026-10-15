import type { ShopState } from './shopStore';
import type { ProductDraft, ProductSaveResult, LocalizedItem, ShopItem, Categories } from '../types';
import { pb, normalizeServerUrl } from '../lib/pocketbase';
import { enqueueItemUpdate } from '../lib/itemWriteQueue';
import { canonicalKey } from '../utils/helpers';
import {
    type CatalogEntry, type CatalogCollection, catalogId, catalogRetryable,
    matchesProduct, normalizeProductName, pendingCatalogEntries, projectCatalog, sendCatalogEntry, catalogVisibilityKey, sameCatalogEntry,
} from '../lib/catalogSync';

type Setter = (patch: Partial<ShopState> | ((state: ShopState) => Partial<ShopState>)) => void;
type Getter = () => ShopState;
type SnapshotRow = { id: string; collection: CatalogCollection; data: Record<string, string> };

export interface ProductActions {
    catalogEntries: CatalogEntry[];
    catalogInitializedScopes: string[];
    catalogSyncStatus: 'saved' | 'pending' | 'error';
    catalogSyncError: string | null;
    quantitySupported: boolean | null;
    quantityCapabilities: Record<string, boolean>;
    createProduct: (draft: ProductDraft) => Promise<ProductSaveResult>;
    editProduct: (id: string, draft: ProductDraft & { updateCatalog?: boolean }) => Promise<ProductSaveResult>;
    createCatalogCategory: (name: string, icon: string) => Promise<ProductSaveResult>;
    getCatalogSource: (name: string, category: string) => 'custom' | 'global' | 'none';
    retryCatalogChanges: () => Promise<void>;
    flushCatalogChanges: () => Promise<void>;
    checkServerCapabilities: () => Promise<void>;
    initializeCatalogEntries: () => void;
    refreshCatalogProjection: () => void;
    mergeCatalogSnapshot: (rows: SnapshotRow[], startedAt: number) => void;
    bindLocalCatalog: (remoteListId: string) => void;
    setProductVisibility: (item: LocalizedItem | string, hidden: boolean) => Promise<void>;
    setCategoryVisibility: (key: string, hidden: boolean) => void;
    deleteCatalogItem: (category: string, item: LocalizedItem | string) => Promise<void>;
    deleteCatalogCategory: (key: string) => Promise<void>;
}

export const catalogOrigin = (state: Pick<ShopState, 'serverUrl'>) => normalizeServerUrl(state.serverUrl || pb.baseURL);
const scopeKey = (state: ShopState) => `${catalogOrigin(state)}\n${state.activeListId}\n${state.sync.recordId || ''}`;
const inScope = (entry: CatalogEntry, state: ShopState) => entry.origin === catalogOrigin(state) && entry.listId === state.activeListId && entry.remoteListId === state.sync.recordId;
const entriesFor = (state: ShopState) => state.catalogEntries.filter(entry => inScope(entry, state));
// A newer read supersedes every older read in the same server/list binding.
const latestCatalogSnapshotRequests = new Map<string, number>();
let catalogSnapshotSequence = 0;
export function beginCatalogSnapshotRequest(state: ShopState): number {
    const generation = ++catalogSnapshotSequence;
    latestCatalogSnapshotRequests.set(scopeKey(state), generation);
    return generation;
}
export const isCatalogSnapshotRequestCurrent = (state: ShopState, generation: number) =>
    latestCatalogSnapshotRequests.get(scopeKey(state)) === generation;

const sameEntity = (entry: CatalogEntry, collection: CatalogCollection, data: Record<string, string>) => {
    if (entry.collection !== collection) return false;
    if (collection === 'list_categories' || collection === 'list_disabled_categories') return entry.data.key === data.key;
    if (collection === 'list_items') return entry.data.category_key === data.category_key && normalizeProductName(entry.data.name) === normalizeProductName(data.name);
    return entry.data.name === data.name;
};

function newEntry(state: ShopState, collection: CatalogCollection, data: Record<string, string>): CatalogEntry {
    return { id: catalogId(), origin: catalogOrigin(state), listId: state.activeListId, remoteListId: state.sync.recordId,
        collection, data, deleted: false, revision: 1, acknowledged: 0, modifiedAt: Date.now(), attempts: 0 };
}

function upsert(entries: CatalogEntry[], state: ShopState, collection: CatalogCollection, data: Record<string, string>, deleted = false, id?: string) {
    const existing = entries.find(entry => inScope(entry, state) && entry.collection === collection && (id ? entry.id === id || entry.remoteId === id : sameEntity(entry, collection, data)));
    const updated = existing ? { ...existing, data, deleted, revision: existing.revision + 1, modifiedAt: Date.now(), attempts: 0, error: undefined, blocked: false, retryAt: undefined }
        : { ...newEntry(state, collection, data), deleted };
    return { entries: existing ? entries.map(entry => sameCatalogEntry(entry, existing) ? updated : entry) : [...entries, updated], entry: updated };
}

function projection(state: ShopState, entries = state.catalogEntries) {
    const scoped = entries.filter(entry => inScope(entry, state));
    const pending = pendingCatalogEntries(scoped);
    const failed = pending.find(entry => entry.blocked);
    const quantityBlocked = Boolean(state.sync.recordId && state.quantitySupported === false && state.items.some(item => (item.id.startsWith('local_') || item.dirty) && item.quantity));
    return { ...projectCatalog(state.catalogCategories, scoped),
        catalogSyncStatus: (quantityBlocked || failed ? 'error' : (pending.length || state.items.some(item => item.id.startsWith('local_') || item.dirty)) && state.sync.recordId ? 'pending' : 'saved') as ProductActions['catalogSyncStatus'],
        catalogSyncError: quantityBlocked ? 'quantity_unsupported' : failed?.error || null };
}

const activeFlushes = new Map<string, Promise<void>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function createProductActions(set: Setter, get: Getter): ProductActions {
    const resultStatus = (): ProductSaveResult['status'] => get().sync.recordId ? 'pending' : 'saved';
    const saveEntries = (entries: CatalogEntry[], other: Partial<ShopState> = {}) => {
        const state = get();
        set({ catalogEntries: entries, ...other, ...projection({ ...state, ...other }, entries) });
    };
    const findCustom = (state: ShopState, name: string, category: string, sourceId?: string) => entriesFor(state).find(entry => entry.collection === 'list_items' && !entry.deleted &&
        (sourceId ? entry.id === sourceId || entry.remoteId === sourceId : entry.data.category_key === category && normalizeProductName(entry.data.name) === normalizeProductName(name)));

    return {
        catalogEntries: [], catalogInitializedScopes: [], catalogSyncStatus: 'saved', catalogSyncError: null,
        quantitySupported: null, quantityCapabilities: {},

        initializeCatalogEntries: () => {
            const state = get();
            const key = scopeKey(state);
            if (state.catalogInitializedScopes.includes(key)) return;
            let entries = state.catalogEntries;
            const addLegacy = (collection: CatalogCollection, data: Record<string, string>) => {
                if (!entries.some(entry => inScope(entry, state) && sameEntity(entry, collection, data))) entries = [...entries, newEntry(state, collection, data)];
            };
            for (const [category, value] of Object.entries(state.categories)) {
                const base = state.catalogCategories[category];
                if (!base) addLegacy('list_categories', { key: category, icon: value.icon, name: value.names?.[state.lang] || value.names?.en || category });
                for (const item of value.items) {
                    const name = typeof item === 'string' ? item : item[state.lang] || item.en || item.ca || item.es;
                    if (!base?.items.some(existing => matchesProduct(existing, name))) addLegacy('list_items', { category_key: category, name });
                }
            }
            state.disabledProducts.forEach(name => addLegacy('list_disabled_products', { name }));
            state.disabledCategories.forEach(category => addLegacy('list_disabled_categories', { key: category }));
            set({ catalogEntries: entries, catalogInitializedScopes: [...state.catalogInitializedScopes, key], ...projection(state, entries) });
        },

        refreshCatalogProjection: () => {
            get().initializeCatalogEntries();
            const state = get();
            const origin = catalogOrigin(state);
            const quantitySupported = state.quantityCapabilities[origin] ?? null;
            set({ ...projection({ ...state, quantitySupported }), quantitySupported });
        },

        bindLocalCatalog: (remoteListId) => {
            get().initializeCatalogEntries();
            const state = get();
            const origin = catalogOrigin(state);
            set({ catalogEntries: state.catalogEntries.map(entry => entry.origin === origin && entry.listId === state.activeListId && !entry.remoteListId ? { ...entry, remoteListId } : entry),
                catalogInitializedScopes: [...new Set([...state.catalogInitializedScopes, `${origin}\n${state.activeListId}\n${remoteListId}`])] });
        },

        mergeCatalogSnapshot: (rows, startedAt) => {
            const state = get();
            const remoteIds = new Set(rows.map(row => row.id));
            // Keep edits and requests acknowledged after this snapshot began.
            let entries = state.catalogEntries.filter(entry => !inScope(entry, state) || entry.revision > entry.acknowledged || entry.modifiedAt >= startedAt || (entry.remoteId && remoteIds.has(entry.remoteId)));
            for (const row of rows) {
                const existing = entries.find(entry => inScope(entry, state) && entry.collection === row.collection && (entry.remoteId === row.id || entry.id === row.id || sameEntity(entry, row.collection, row.data)));
                if (existing && (existing.revision > existing.acknowledged || existing.modifiedAt >= startedAt)) {
                    entries = entries.map(entry => sameCatalogEntry(entry, existing) ? { ...entry, remoteId: row.id } : entry);
                    continue;
                }
                const value: CatalogEntry = existing ? { ...existing, data: row.data, deleted: false, remoteId: row.id }
                    : { ...newEntry(state, row.collection, row.data), id: row.id, remoteId: row.id, acknowledged: 1 };
                entries = existing ? entries.map(entry => sameCatalogEntry(entry, existing) ? value : entry) : [...entries, value];
            }
            saveEntries(entries);
        },

        getCatalogSource: (name, category) => {
            const state = get();
            if (findCustom(state, name, category)) return 'custom';
            return state.catalogCategories[category]?.items.some(item => matchesProduct(item, name)) ? 'global' : 'none';
        },

        createCatalogCategory: async (inputName, inputIcon) => {
            try {
                get().initializeCatalogEntries();
                const state = get();
                const name = inputName.trim().replace(/\s+/g, ' ');
                if (!name || name.length > 200) return { status: 'error', error: 'invalid_name' };
                const existing = Object.entries(state.categories).find(([key, category]) => normalizeProductName(category.names?.[state.lang] || category.names?.en || key) === normalizeProductName(name));
                if (existing) return { status: 'exists', categoryKey: existing[0] };
                const key = `cat_${catalogId()}`;
                const { entries } = upsert(state.catalogEntries, state, 'list_categories', { key, name, icon: inputIcon.trim() || '📦' });
                saveEntries(entries);
                void get().flushCatalogChanges();
                return { status: resultStatus(), categoryKey: key };
            } catch { return { status: 'error', error: 'storage_failed' }; }
        },

        createProduct: async (draft) => {
            try {
                get().initializeCatalogEntries();
                const state = get();
                const name = draft.name.trim().replace(/\s+/g, ' ');
                let quantity = draft.quantity?.trim() || '';
                let note = draft.note?.trim() || '';
                if (!name || name.length > 200 || note.length > 1000 || quantity.length > 80 || !state.categories[draft.category]) return { status: 'error', error: 'invalid_product' };
                if (quantity && state.sync.recordId && state.quantitySupported !== true) return { status: 'error', error: 'quantity_unsupported' };
                const known = state.categories[draft.category].items.find(item => matchesProduct(item, name));
                let entries = state.catalogEntries;
                let source = findCustom(state, name, draft.category);
                if (!known) {
                    const update = upsert(entries, state, 'list_items', { name, category_key: draft.category });
                    entries = update.entries; source = update.entry;
                }
                // An explicit add can make a previously hidden suggestion visible again.
                for (const hiddenKey of new Set([catalogVisibilityKey(known || name), canonicalKey(known || name)])) {
                    if (state.disabledProducts.includes(hiddenKey)) entries = upsert(entries, state, 'list_disabled_products', { name: hiddenKey }, true).entries;
                }
                let items = state.items;
                const existing = items.find(item => normalizeProductName(item.name) === normalizeProductName(name));
                if (draft.quantity === undefined) quantity = existing?.quantity || '';
                if (draft.note === undefined) note = existing?.note || '';
                const alreadyActive = existing && existing.inList !== false && !existing.checked;
                let itemId = existing?.id;
                const shouldAdd = draft.addToList !== false;
                if (shouldAdd && !alreadyActive) {
                    itemId = existing?.id || `local_${crypto.randomUUID()}`;
                    const item: ShopItem = { ...existing, id: itemId, name, category: draft.category, quantity, note,
                        inList: true, checked: false, updatedAt: Date.now(), dirty: !itemId.startsWith('local_'),
                        catalogSourceKind: source ? 'custom' : 'global', catalogSourceId: source?.remoteId || source?.id || (known && typeof known !== 'string' ? known._catalogId : '') || '', catalogSourceCategory: draft.category };
                    items = existing ? items.map(value => value.id === existing.id ? item : value) : [item, ...items];
                }
                // Persist catalog, buy entry and outbox together before publishing success.
                saveEntries(entries, { items, sync: { ...state.sync, lastLocalInteraction: Date.now(), syncVersion: state.sync.syncVersion + 1 } });
                if (shouldAdd && existing && !alreadyActive && !existing.id.startsWith('local_') && state.sync.recordId && (!quantity || state.quantitySupported === true)) {
                    const item = items.find(value => value.id === existing.id)!;
                    enqueueItemUpdate(existing.id, { in_list: true, checked: false, name, category: draft.category, quantity, note,
                        catalog_source_id: item.catalogSourceId, catalog_source_kind: item.catalogSourceKind, catalog_source_category: item.catalogSourceCategory });
                }
                void get().flushCatalogChanges();
                return { status: known && (!shouldAdd || alreadyActive) ? 'exists' : resultStatus(), itemId: shouldAdd ? itemId : undefined, catalogId: source?.remoteId || source?.id };
            } catch { return { status: 'error', error: 'storage_failed' }; }
        },

        editProduct: async (id, draft) => {
            try {
                get().initializeCatalogEntries();
                const state = get();
                const previous = state.items.find(item => item.id === id);
                const name = draft.name.trim().replace(/\s+/g, ' ');
                const quantity = draft.quantity?.trim() || '';
                const note = draft.note?.trim() || '';
                if (!previous || !name || name.length > 200 || note.length > 1000 || quantity.length > 80 || !state.categories[draft.category]) return { status: 'error', error: 'invalid_product' };
                if (quantity !== (previous.quantity || '') && quantity && state.sync.recordId && state.quantitySupported !== true) return { status: 'error', error: 'quantity_unsupported' };
                if (state.items.some(item => item.id !== id && item.inList !== false && !item.checked && normalizeProductName(item.name) === normalizeProductName(name))) return { status: 'error', error: 'duplicate_product' };
                let entries = state.catalogEntries;
                let source = findCustom(state, previous.name, previous.category, previous.catalogSourceId) || findCustom(state, previous.name, previous.category);
                if (draft.updateCatalog) {
                    const duplicate = findCustom(state, name, draft.category);
                    if (duplicate && source && duplicate.id !== source.id) return { status: 'error', error: 'duplicate_product' };
                    const update = upsert(entries, state, 'list_items', { name, category_key: draft.category }, false, source?.id);
                    entries = update.entries; source = update.entry;
                }
                const updated: ShopItem = { ...previous, name, category: draft.category, quantity, note, updatedAt: Date.now(), dirty: !id.startsWith('local_'),
                    ...(draft.updateCatalog && source ? { catalogSourceId: source.remoteId || source.id, catalogSourceKind: 'custom' as const, catalogSourceCategory: draft.category } : {}) };
                saveEntries(entries, { items: state.items.map(item => item.id === id ? updated : item), sync: { ...state.sync, lastLocalInteraction: Date.now(), syncVersion: state.sync.syncVersion + 1 } });
                if (state.sync.recordId && !id.startsWith('local_') && (!quantity || state.quantitySupported === true)) enqueueItemUpdate(id, { name, category: draft.category, quantity, note,
                    catalog_source_id: updated.catalogSourceId || '', catalog_source_kind: updated.catalogSourceKind || '', catalog_source_category: updated.catalogSourceCategory || '' });
                void get().flushCatalogChanges();
                return { status: resultStatus(), itemId: id, catalogId: source?.remoteId || source?.id };
            } catch { return { status: 'error', error: 'storage_failed' }; }
        },

        setProductVisibility: async (item, hidden) => {
            get().initializeCatalogEntries();
            const state = get();
            const name = catalogVisibilityKey(item);
            if (!name) return;
            let entries = state.catalogEntries;
            for (const key of new Set(hidden ? [name] : [name, canonicalKey(item)])) {
                entries = upsert(entries, state, 'list_disabled_products', { name: key }, !hidden).entries;
            }
            saveEntries(entries);
            void get().flushCatalogChanges();
        },

        setCategoryVisibility: (key, hidden) => {
            get().initializeCatalogEntries();
            const state = get();
            const { entries } = upsert(state.catalogEntries, state, 'list_disabled_categories', { key }, !hidden);
            saveEntries(entries);
            void get().flushCatalogChanges();
        },

        deleteCatalogItem: async (category, item) => {
            get().initializeCatalogEntries();
            const state = get();
            const name = typeof item === 'string' ? item : item[state.lang] || item.en;
            const source = findCustom(state, name, category);
            if (source) saveEntries(upsert(state.catalogEntries, state, 'list_items', source.data, true, source.id).entries);
            void get().flushCatalogChanges();
        },

        deleteCatalogCategory: async (key) => {
            get().initializeCatalogEntries();
            const state = get();
            let entries = state.catalogEntries;
            for (const entry of entriesFor(state).filter(value => !value.deleted && (value.collection === 'list_categories' && value.data.key === key || value.collection === 'list_items' && value.data.category_key === key))) {
                entries = upsert(entries, state, entry.collection, entry.data, true, entry.id).entries;
            }
            saveEntries(entries);
            void get().flushCatalogChanges();
        },

        checkServerCapabilities: async () => {
            const client = pb;
            const origin = catalogOrigin(get());
            try {
                const health = await client.send<{ supports_quantity?: boolean }>('/api/shoplist/health', { method: 'GET', requestKey: null });
                if (pb !== client || origin !== catalogOrigin(get())) return;
                const supported = health.supports_quantity === true;
                set(state => ({ quantitySupported: supported, quantityCapabilities: { ...state.quantityCapabilities, [origin]: supported } }));
            } catch { /* Preserve a previously verified capability while offline. */ }
        },

        retryCatalogChanges: async () => {
            const owner = scopeKey(get());
            await get().checkServerCapabilities();
            if (scopeKey(get()) !== owner) return;
            const state = get();
            const entries = state.catalogEntries.map(entry => inScope(entry, state) && entry.revision > entry.acknowledged
                ? { ...entry, blocked: false, error: undefined, retryAt: undefined, attempts: 0 } : entry);
            saveEntries(entries, { sync: { ...state.sync, syncVersion: state.sync.syncVersion + 1 } });
            await get().flushCatalogChanges();
        },

        flushCatalogChanges: () => {
            get().initializeCatalogEntries();
            const state = get();
            const key = scopeKey(state);
            const running = activeFlushes.get(key);
            if (running) return running;
            const timer = retryTimers.get(key);
            if (timer) clearTimeout(timer);
            const client = pb;
            const listId = state.activeListId;
            const recordId = state.sync.recordId;
            const origin = catalogOrigin(state);
            const principal = client.authStore?.record?.id || '';
            if (!recordId || !state.sync.connected || typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve();
            const isCurrent = () => pb === client && (client.authStore?.record?.id || '') === principal && get().activeListId === listId && get().sync.recordId === recordId && catalogOrigin(get()) === origin && get().sync.connected;
            const run = async () => {
                let rounds = 0;
                while (isCurrent() && rounds++ < 100) {
                    const scoped = entriesFor(get());
                    const entry = pendingCatalogEntries(scoped).filter(value => !value.blocked && (!value.retryAt || value.retryAt <= Date.now()) &&
                        (value.collection !== 'list_items' || !scoped.some(category => category.collection === 'list_categories' && category.data.key === value.data.category_key && category.revision > category.acknowledged && !category.deleted)))
                        .sort((a, b) => (a.collection === 'list_categories' ? -1 : 1) - (b.collection === 'list_categories' ? -1 : 1))[0];
                    if (!entry) break;
                    try {
                        const remoteId = await sendCatalogEntry(entry, recordId, client);
                        const current = get();
                        // Update only the captured entity, even if another list is now active.
                        let entries = current.catalogEntries.map(value => sameCatalogEntry(value, entry)
                            ? { ...value, remoteId: remoteId || value.remoteId, acknowledged: Math.max(value.acknowledged, entry.revision), attempts: 0, retryAt: undefined, error: undefined, blocked: false, modifiedAt: Date.now() } : value);
                        const aliases = new Set([entry.id, entry.remoteId].filter((id): id is string => Boolean(id) && id !== remoteId));
                        const hasAlias = entry.collection === 'list_items' && Boolean(remoteId) && aliases.size > 0;
                        const aliasKeys = new Set([...aliases].map(id => `source:custom:${id}`));
                        const targetKey = `source:custom:${remoteId}`;
                        const ownerScope = { ...current, serverUrl: origin, activeListId: listId, sync: { ...current.sync, recordId } };
                        if (hasAlias) {
                            // Retire an already-sent old key instead of just renaming
                            // its local row; otherwise a remote hide is orphaned.
                            const oldVisibility = entries.filter(value => inScope(value, ownerScope) && value.collection === 'list_disabled_products' && aliasKeys.has(value.data.name));
                            const target = entries.find(value => inScope(value, ownerScope) && value.collection === 'list_disabled_products' && value.data.name === targetKey);
                            // Completed alias tombstones are historical cleanup,
                            // not a fresh request to show the adopted product.
                            if (remoteId !== (entry.remoteId || entry.id) || oldVisibility.some(value => !value.deleted)) {
                                const desired = [...oldVisibility, ...(target ? [target] : [])].sort((a, b) => b.modifiedAt - a.modifiedAt)[0];
                                for (const old of oldVisibility) entries = upsert(entries, ownerScope, old.collection, old.data, true, old.id).entries;
                                if (desired) entries = upsert(entries, ownerScope, 'list_disabled_products', { name: targetKey }, desired.deleted).entries;
                            }
                        }
                        const remapItems = (items: ShopItem[]) => !hasAlias ? items : items.map(item => item.catalogSourceKind === 'custom' && aliases.has(item.catalogSourceId || '')
                            ? { ...item, catalogSourceId: remoteId!, dirty: !item.id.startsWith('local_') } : item);
                        const remapVisibility = (keys: string[] | undefined) => !hasAlias || !keys ? keys : [...new Set(keys.map(value => aliasKeys.has(value) ? targetKey : value))];
                        const remapCategories = (categories: Categories | undefined): Categories | undefined => !hasAlias || !categories ? categories : Object.fromEntries(Object.entries(categories).map(([key, category]) => [key, {
                            ...category, items: category.items.map(item => typeof item !== 'string' && item._catalogKind === 'custom' && aliases.has(item._catalogId || '') ? { ...item, _catalogId: remoteId! } : item),
                        }]));
                        const remapCache = (cache: ShopState['listCaches'][string]) => cache.recordId !== recordId ? cache : {
                            ...cache, items: remapItems(cache.items), categories: remapCategories(cache.categories), disabledProducts: remapVisibility(cache.disabledProducts),
                        };
                        const activeOwner = current.activeListId === listId && current.sync.recordId === recordId && catalogOrigin(current) === origin;
                        const cachedOwner = current.listCaches[listId];
                        const workspace = current.serverWorkspaces[origin];
                        let serverWorkspaces = current.serverWorkspaces;
                        if (hasAlias && workspace) {
                            const activeWorkspaceOwner = workspace.activeListId === listId && workspace.sync.recordId === recordId;
                            const cached = workspace.listCaches[listId];
                            serverWorkspaces = { ...serverWorkspaces, [origin]: { ...workspace,
                                ...(activeWorkspaceOwner ? { items: remapItems(workspace.items), categories: remapCategories(workspace.categories)!, disabledProducts: remapVisibility(workspace.disabledProducts)! } : {}),
                                ...(cached ? { listCaches: { ...workspace.listCaches, [listId]: remapCache(cached) } } : {}),
                            } };
                        }
                        set({ catalogEntries: entries,
                            ...(activeOwner ? { items: remapItems(current.items) } : {}),
                            ...(catalogOrigin(current) === origin && cachedOwner ? { listCaches: { ...current.listCaches, [listId]: remapCache(cachedOwner) } } : {}),
                            ...(hasAlias ? { serverWorkspaces } : {}),
                            ...(isCurrent() ? projection({ ...current, items: activeOwner ? remapItems(current.items) : current.items }, entries) : {}) });
                    } catch (error) {
                        const transient = catalogRetryable(error);
                        const attempts = entry.attempts + 1;
                        const delay = Math.min(60000, 1000 * 2 ** Math.min(attempts - 1, 6));
                        const status = (error as { status?: number }).status;
                        const message = status === 401 || status === 403 ? 'permission_denied' : transient ? 'sync_pending' : 'catalog_rejected';
                        const current = get();
                        const entries = current.catalogEntries.map(value => sameCatalogEntry(value, entry) && value.revision === entry.revision
                            ? { ...value, attempts, retryAt: transient ? Date.now() + delay : undefined, error: message, blocked: !transient } : value);
                        set({ catalogEntries: entries, ...(isCurrent() ? projection(current, entries) : {}) });
                        if (transient && isCurrent()) retryTimers.set(key, setTimeout(() => { retryTimers.delete(key); void get().flushCatalogChanges(); }, delay));
                    }
                }
            };
            const promise = run().finally(() => {
                activeFlushes.delete(key);
                if (!isCurrent()) return;
                const scoped = entriesFor(get());
                const waiting = pendingCatalogEntries(scoped).filter(value => !value.blocked &&
                    (value.collection !== 'list_items' || !scoped.some(category => category.collection === 'list_categories' && category.data.key === value.data.category_key && category.revision > category.acknowledged && !category.deleted)));
                if (!waiting.length) return;
                // A refresh can interrupt a backoff timer, and a large batch can
                // exceed one drain pass. Both must continue without user input.
                const delay = Math.max(0, Math.min(...waiting.map(value => value.retryAt || 0)) - Date.now());
                const prior = retryTimers.get(key);
                if (prior) clearTimeout(prior);
                retryTimers.set(key, setTimeout(() => { retryTimers.delete(key); void get().flushCatalogChanges(); }, delay));
            });
            activeFlushes.set(key, promise);
            return promise;
        },
    };
}
