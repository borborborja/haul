import { useEffect, useRef } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb, ensureGuestSession } from '../lib/pocketbase';
import { triggerHaptic } from '../utils/haptics';
import { hasPendingWrite, pendingCreates, parsePbDate, shouldSkipRemoteUpdate } from '../lib/syncMeta';
import { enqueueItemUpdate, enqueueItemDelete } from '../lib/itemWriteQueue';
import { itemWriteBody, mergeRemoteItems, type ItemRecord } from '../lib/itemSync';
import type { ShopItem } from '../types';

// How often refreshList may trigger a full refetch while connected. Focus,
// visibility and online events all funnel into it, often back to back.
const RESYNC_THROTTLE_MS = 5000;

const mapItemRecord = (r: any, local?: ShopItem): ShopItem => ({
    id: r.id,
    name: r.name,
    checked: r.checked,
    note: r.note,
    quantity: r.quantity ?? local?.quantity ?? '',
    catalogSourceId: r.catalog_source_id || local?.catalogSourceId || '',
    catalogSourceKind: r.catalog_source_kind || local?.catalogSourceKind || '',
    catalogSourceCategory: r.catalog_source_category || local?.catalogSourceCategory || '',
    category: r.category,
    inList: r.in_list,
    addedBy: r.added_by,
    checkedBy: r.checked_by,
    serverUpdated: parsePbDate(r.updated),
    updatedAt: parsePbDate(r.updated) || local?.updatedAt || Date.now()
});

export function useListSync() {
    const { sync, listName, lang, setSyncState, addToSyncHistory, items, activeListId, quantitySupported } = useShopStore();

    useEffect(() => { useShopStore.getState().refreshCatalogProjection(); }, [items, activeListId, sync.recordId, quantitySupported]);

    // undefined = remote list name not fetched yet this session (don't push)
    const lastRemoteListNameRef = useRef<string | null | undefined>(undefined);
    // Last known server-side `data` blob. We only own data.listName; the rest
    // (legacy data.categories, etc.) is preserved on writes so older clients
    // that still read the blob keep working.
    const listDataRef = useRef<Record<string, any>>({});
    const lastResyncRef = useRef(0);

    // Full refetch of items + list metadata, merged into the store without
    // clobbering local state the server hasn't accepted yet (offline creates,
    // dirty items, writes in flight). Used on connect and on resume.
    const fetchAndMerge = async (currentRecordId: string) => {
        const ownerListId = useShopStore.getState().activeListId;
        const client = pb;
        const isCurrent = () => {
            const state = useShopStore.getState();
            return pb === client && state.activeListId === ownerListId && state.sync.recordId === currentRecordId && state.sync.connected;
        };
        if (!isCurrent()) return;
        lastResyncRef.current = Date.now();
        const snapshotIds = new Set(useShopStore.getState().items.map(item => item.id));

        const records = await client.collection('shopping_items').getFullList({
            filter: `list = "${currentRecordId}"`,
            sort: '-created'
        });
        const listRecord = await client.collection('shopping_lists').getOne(currentRecordId);
        if (!isCurrent()) return;
        listDataRef.current = listRecord.data || {};

        const { items: localItems, deletedItemIds } = useShopStore.getState();
        const localById = new Map(localItems.map(i => [i.id, i] as const));
        for (const record of records) {
            if (record.external_id && (localById.has(record.external_id) || deletedItemIds.includes(record.external_id))) {
                useShopStore.getState().confirmItemCreated(record.external_id, record as unknown as ItemRecord);
            }
        }
        const reconciled = useShopStore.getState().items;
        const mergedItems = mergeRemoteItems(reconciled, records as unknown as ItemRecord[], useShopStore.getState().deletedItemIds, hasPendingWrite, snapshotIds);

        const remoteListName = listRecord.data?.listName;
        lastRemoteListNameRef.current = remoteListName ?? null;

        useShopStore.setState({
            items: mergedItems,
            ...(remoteListName !== undefined ? { listName: remoteListName ?? null } : {})
        });

        // Reflect the server-stored emoji on this device's saved list.
        const remoteEmoji = listRecord.data?.emoji;
        if (remoteEmoji) {
            useShopStore.setState((s) => ({
                lists: s.lists.map((l) => l.recordId === currentRecordId && l.emoji !== remoteEmoji ? { ...l, emoji: remoteEmoji } : l),
            }));
        }

        // Custom categories/items live in per-row collections (merge-safe).
        await useShopStore.getState().loadListCustomData();
    };

    // Push items the server doesn't have yet: offline creates (local_ ids)
    // and dirty items whose last write was rejected.
    const pushPendingItems = async (currentRecordId: string) => {
        const client = pb;
        const ownerListId = useShopStore.getState().activeListId;
        if (useShopStore.getState().quantitySupported === null && useShopStore.getState().items.some(item => item.quantity)) {
            await useShopStore.getState().checkServerCapabilities();
        }
        const { items, deletedItemIds, sync: currentSync, quantitySupported: supportsQuantity } = useShopStore.getState();
        if (pb !== client || useShopStore.getState().activeListId !== ownerListId) return;
        if (!currentSync.connected || currentSync.recordId !== currentRecordId) return;
        // An older PocketBase schema silently ignores unknown fields. Keep the
        // whole local edit pending until quantity can be safely acknowledged.
        const canWrite = (item: ShopItem) => !item.quantity || supportsQuantity === true;
        deletedItemIds.filter(id => !id.startsWith('local_')).forEach(id => enqueueItemDelete(id));
        for (const item of items) {
            if (item.dirty && !item.id.startsWith('local_') && canWrite(item)) {
                enqueueItemUpdate(item.id, itemWriteBody(item));
            }
        }

        const offline = items.filter(i => i.id.startsWith('local_') && !pendingCreates.has(i.id) && canWrite(i));
        if (offline.length === 0) return;
        offline.forEach(i => pendingCreates.add(i.id));

        const createBody = (item: ShopItem) => ({
            list: currentRecordId,
            name: item.name,
            category: item.category,
            checked: item.checked,
            note: item.note,
            quantity: item.quantity || '',
            catalog_source_id: item.catalogSourceId || '',
            catalog_source_kind: item.catalogSourceKind || '',
            catalog_source_category: item.catalogSourceCategory || '',
            in_list: item.inList !== false,
            external_id: item.id
        });

        const swapTempId = (tempId: string, record: ItemRecord) => {
            if (pb === client) useShopStore.getState().confirmItemCreated(tempId, record);
        };

        try {
            if (offline.length > 1) {
                const batch = pb.createBatch();
                offline.forEach(i => batch.collection('shopping_items').create(createBody(i)));
                const results = await batch.send();
                results.forEach((res: any, idx: number) => {
                    if (res?.body?.id) swapTempId(offline[idx].id, res.body);
                });
            } else {
                const record = await pb.collection('shopping_items').create(createBody(offline[0]));
                swapTempId(offline[0].id, record as unknown as ItemRecord);
            }
        } catch (e) {
            // Batch may be unavailable (older server) or fail wholesale; fall
            // back to sequential creates so one bad item can't block the rest.
            console.error("Batch offline push failed, falling back to sequential", e);
            for (const item of offline) {
                if (pb !== client) break;
                try {
                    const record = await pb.collection('shopping_items').create(createBody(item));
                    swapTempId(item.id, record as unknown as ItemRecord);
                } catch (err) {
                    console.error("Failed to sync offline item:", item.name, err);
                }
            }
        } finally {
            offline.forEach(i => pendingCreates.delete(i.id));
        }
    };

    // 1. Auto-reconnect and URL parameter sync
    useEffect(() => {
        let cancelled = false;
        const ownerListId = useShopStore.getState().activeListId;
        const isCurrent = () => !cancelled && useShopStore.getState().activeListId === ownerListId;
        const handleSyncParam = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlCode = (params.get('c') || params.get('code'))?.trim().toUpperCase();

            // Case A: URL has a sync code
            if (urlCode) {
                // If already connected correctly, just clear URL and stop
                if (sync.connected && sync.code === urlCode) {
                    const newUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                    return;
                }

                if (!navigator.onLine) return;

                try {
                    if (!await ensureGuestSession() || !isCurrent()) return;
                    // Validate code
                    const record = await pb.send<{ id: string; name: string; inviteCode: string }>('/api/shoplist/lists/join', {
                        method: 'POST',
                        body: { code: urlCode }
                    });

                    if (!isCurrent()) return;
                    // Confirm if needed
                    const { items: currentItems } = useShopStore.getState();
                    const hasSignificantData = currentItems.length > 0 || (sync.connected && sync.code !== urlCode);

                    if (hasSignificantData) {
                        const msg = lang === 'ca'
                            ? `Vols connectar-te a la llista compartida "${urlCode}"? Es descartarà la teva llista actual.`
                            : `¿Quieres conectarte a la lista compartida "${urlCode}"? Se descartará tu lista actual.`;

                        if (!confirm(msg)) {
                            const newUrl = window.location.origin + window.location.pathname;
                            window.history.replaceState({}, document.title, newUrl);
                            return;
                        }
                    }

                    // Connect
                    useShopStore.setState({ items: [], categories: useShopStore.getState().catalogCategories, deletedItemIds: [], disabledProducts: [], disabledCategories: [] });
                    setSyncState({ msg: 'Connecting...', msgType: 'info' });
                    // Initial sync might be empty for items if using atomic, but we need metadata
                    // We will let the atomic sync hook handle the items fetch.
                    setSyncState({ connected: true, code: urlCode, recordId: record.id, msg: 'Connected!', msgType: 'success' });
                    addToSyncHistory(urlCode);
                    localStorage.setItem('shopListSyncCode', urlCode);
                } catch (e) {
                    if (!isCurrent()) return;
                    console.error('URL Sync failed:', e);
                    setSyncState({ msg: 'Invalid or missing code', msgType: 'error' });
                }

                // Always clear URL
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                return;
            }

            // Case B: Auto-reconnect
            if (!sync.connected && navigator.onLine) {
                if (!await ensureGuestSession() || !isCurrent()) return;
                if (sync.code) {
                    // Prefer the code path: it (re)ensures membership for the current identity.
                    try {
                        const record = await pb.send<{ id: string }>('/api/shoplist/lists/join', {
                            method: 'POST',
                            body: { code: sync.code }
                        });
                        if (!isCurrent()) return;
                        setSyncState({ connected: true, recordId: record.id, msg: 'Reconnected', msgType: 'success' });
                        // We don't need to syncFromRemote here because the Atomic Effect will do it.
                    } catch (e) {
                        console.error('Auto-reconnect failed:', e);
                    }
                } else if (sync.recordId) {
                    // No code (e.g. list recovered after account login): membership already
                    // grants access, so connect directly by recordId. The Atomic Effect fetches items.
                    setSyncState({ connected: true, recordId: sync.recordId, msg: 'Reconnected', msgType: 'success' });
                }
            }
        };
        void handleSyncParam();
        return () => { cancelled = true; };
    }, [sync.code, sync.connected, sync.recordId, lang, setSyncState, addToSyncHistory]);

    // 2. Initial Fetch & Subscribe (items + list metadata + custom categories)
    useEffect(() => {
        if (!sync.connected || !sync.recordId) return;
        const currentRecordId = sync.recordId;
        const ownerListId = useShopStore.getState().activeListId;
        const client = pb;
        lastRemoteListNameRef.current = undefined;
        listDataRef.current = {};
        lastResyncRef.current = 0;
        let cancelled = false;
        const isCurrent = () => {
            const state = useShopStore.getState();
            return !cancelled && pb === client && state.activeListId === ownerListId && state.sync.recordId === currentRecordId && state.sync.connected;
        };
        const unsubscribers: (() => void)[] = [];

        const subscribeAll = async () => {
            // ITEMS
            const unsubItems = await client.collection('shopping_items').subscribe('*', (e) => {
                if (!isCurrent() || e.record.list !== currentRecordId) return;

                const { items } = useShopStore.getState();

                if (e.action === 'create') {
                    // Our own optimistic/offline create coming back: swap the temp id
                    // instead of inserting a duplicate.
                    const externalId = e.record.external_id;
                    if (externalId && (items.find(i => i.id === externalId) || useShopStore.getState().deletedItemIds.includes(externalId))) {
                        useShopStore.getState().confirmItemCreated(externalId, e.record as unknown as ItemRecord);
                        return;
                    }
                    if (useShopStore.getState().deletedItemIds.includes(e.record.id)) return;
                    if (!items.find(i => i.id === e.record.id)) {
                        const newItem = mapItemRecord(e.record);
                        useShopStore.setState({ items: [newItem, ...items] });
                        const { notifyOnAdd, notifyOnCheck, lang: currentLang } = useShopStore.getState();
                        handleNotifications(items, [newItem], notifyOnAdd, notifyOnCheck, currentLang);
                    }
                } else if (e.action === 'update') {
                    const current = items.find(i => i.id === e.record.id);
                    if (!current) return;
                    // Don't let echoes or stale events clobber newer local state.
                    if (current.dirty || shouldSkipRemoteUpdate(e.record.id, e.record.updated, current.serverUpdated)) return;
                    const updated = mapItemRecord(e.record, current);
                    useShopStore.setState({
                        items: items.map(i => i.id === e.record.id ? updated : i)
                    });
                    // Notify on remote check/uncheck too (shopping mode): updates,
                    // not just creates, carry someone else completing an item.
                    const { notifyOnAdd, notifyOnCheck, lang: currentLang } = useShopStore.getState();
                    handleNotifications(items, [updated], notifyOnAdd, notifyOnCheck, currentLang);
                } else if (e.action === 'delete') {
                    useShopStore.setState({
                        items: items.filter(i => i.id !== e.record.id)
                    });
                }
            }, { filter: `list = "${currentRecordId}"` });
            if (cancelled) { unsubItems(); return; }
            unsubscribers.push(unsubItems);

            // LIST (metadata: we only own data.listName)
            const unsubList = await client.collection('shopping_lists').subscribe(currentRecordId, (e) => {
                if (!isCurrent() || e.action !== 'update') return;
                const data = e.record.data;
                if (!data) return;
                listDataRef.current = data;
                if (data.listName !== undefined) {
                    lastRemoteListNameRef.current = data.listName ?? null;
                    useShopStore.setState({ listName: data.listName ?? null });
                }
            });
            if (cancelled) { unsubList(); return; }
            unsubscribers.push(unsubList);

            // Identity-bearing snapshots plus the durable local overlay handle
            // creates, edits and deletes without clobbering newer local intent.
            for (const collection of ['list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories']) {
                const unsubscribe = await client.collection(collection).subscribe('*', event => {
                    if (isCurrent() && event.record.list === currentRecordId) void useShopStore.getState().loadListCustomData();
                }, { filter: `list = "${currentRecordId}"` });
                if (cancelled) { unsubscribe(); return; }
                unsubscribers.push(unsubscribe);
            }

        };

        const init = async () => {
            try {
                await subscribeAll();
                if (!isCurrent()) return;
                await fetchAndMerge(currentRecordId);
                if (!isCurrent()) return;
                await useShopStore.getState().flushCatalogChanges();
                if (!isCurrent()) return;
                await pushPendingItems(currentRecordId);
            } catch (e) {
                if (!isCurrent()) return;
                console.error("Sync init failed", e);
                setSyncState({ msg: 'Sync Error', msgType: 'error' });
            }
        };

        init();

        return () => {
            cancelled = true;
            unsubscribers.forEach(u => { try { u(); } catch { /* already closed */ } });
        };
    }, [sync.connected, sync.recordId]);

    // Process new product commands without rebuilding the subscriptions.
    useEffect(() => {
        const state = useShopStore.getState();
        if (!state.sync.connected || !state.sync.recordId) return;
        const currentRecordId = state.sync.recordId;
        const ownerListId = state.activeListId;
        let cancelled = false;
        void (async () => {
            await state.flushCatalogChanges();
            if (cancelled || useShopStore.getState().activeListId !== ownerListId || useShopStore.getState().sync.recordId !== currentRecordId) return;
            await pushPendingItems(currentRecordId);
        })();
        return () => { cancelled = true; };
    }, [sync.syncVersion, sync.connected, sync.recordId]);

    // 3. Sync local LIST NAME changes to remote (categories sync row-level
    // through list_categories/list_items, so the blob no longer carries them)
    useEffect(() => {
        if (!sync.connected || !sync.recordId) return;
        const currentRecordId = sync.recordId;

        const t = setTimeout(async () => {
            const state = useShopStore.getState();
            if (!state.sync.connected || state.sync.recordId !== currentRecordId) return;
            // Don't push before the first fetch resolved the remote value
            if (lastRemoteListNameRef.current === undefined) return;
            if ((state.listName ?? null) === lastRemoteListNameRef.current) return;

            try {
                const data = { ...listDataRef.current, listName: state.listName };
                await pb.collection('shopping_lists').update(currentRecordId, { data });
                if (useShopStore.getState().sync.recordId !== currentRecordId) return;
                listDataRef.current = data;
                lastRemoteListNameRef.current = state.listName ?? null;
            } catch (e) { console.error("List name sync failed", e); }
        }, 400);
        return () => clearTimeout(t);
    }, [listName, sync.connected, sync.recordId]);

    return {
        refreshList: async () => {
            const state = useShopStore.getState();
            if (!navigator.onLine) return;

            if (state.sync.connected && state.sync.recordId) {
                // The SSE socket can die silently (e.g. app backgrounded on
                // mobile); refetch so changes made meanwhile show up right away.
                if (Date.now() - lastResyncRef.current < RESYNC_THROTTLE_MS) return;
                try {
                    await fetchAndMerge(state.sync.recordId);
                    await pushPendingItems(state.sync.recordId);
                } catch (e) {
                    console.error('Background resync failed:', e);
                }
                return;
            }

            // If we have a code, reconnect by code (re-ensures membership)
            if (state.sync.code) {
                console.log("Auto-reconnecting via refreshList...");
                try {
                    const record = await pb.send<{ id: string }>('/api/shoplist/lists/join', {
                        method: 'POST',
                        body: { code: state.sync.code }
                    });
                    if (useShopStore.getState().activeListId !== state.activeListId || useShopStore.getState().sync.code !== state.sync.code) return;
                    setSyncState({ connected: true, recordId: record.id, msg: 'Reconnected', msgType: 'success' });
                    // Effect 2 will handle the rest (atomic sync)
                } catch (e) {
                    console.error('Auto-reconnect failed (refreshList):', e);
                }
            } else if (state.sync.recordId) {
                // Recovered list (no code): membership grants access, connect by id.
                setSyncState({ connected: true, recordId: state.sync.recordId, msg: 'Reconnected', msgType: 'success' });
            }
        }
    };
}

function handleNotifications(localItems: any[], remoteItems: any[], notifyOnAdd: boolean, notifyOnCheck: boolean, lang: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const getDisplayName = (i: any) => {
        if (!i.name) return '???';
        if (typeof i.name === 'string') return i.name;
        return i.name[lang] || i.name.es || i.name.ca || i.name.en || '???';
    };

    let body = '';

    // Added/Unchecked
    if (notifyOnAdd) {
        const newOrUnchecked = remoteItems.filter((ri: any) => {
            const local = localItems.find(li => li.id === ri.id);
            return (!local && !ri.checked) || (local && local.checked && !ri.checked);
        });
        if (newOrUnchecked.length > 0) {
            body += `+ ${newOrUnchecked.map(getDisplayName).join(', ')}\n`;
        }
    }

    // Checked
    if (notifyOnCheck) {
        const checked = remoteItems.filter((ri: any) => {
            const local = localItems.find(li => li.id === ri.id);
            return local && !local.checked && ri.checked;
        });
        if (checked.length > 0) {
            body += `✓ ${checked.map(getDisplayName).join(', ')}\n`;
        }
    }

    if (body) {
        new Notification('ShoppingList', {
            body: body.trim(),
            icon: '/icon-192-maskable.png',
            badge: '/icon-192-maskable.png',
            tag: 'shoplist-update', // Prevent spamming duplicate notifications
            renotify: true
        } as any);

        if ('vibrate' in navigator) {
            triggerHaptic(100);
        }
    }
}
