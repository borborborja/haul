import type { RecordModel } from 'pocketbase';
import { pb } from '../../lib/pocketbase';
import { parsePbDate } from '../../lib/syncMeta';
import { hasPendingWrite } from '../../lib/syncMeta';
import { useShopStore } from '../../store/shopStore';
import type { Categories, ShopItem } from '../../types';

export interface ConnectionData {
    items: ShopItem[];
    categories?: Categories;
    listName: string | null;
}

export interface ConnectionScope {
    listId: string;
    recordId: string | null;
    client: typeof pb;
}

export const captureConnectionScope = (): ConnectionScope => ({
    listId: useShopStore.getState().activeListId,
    recordId: useShopStore.getState().sync.recordId,
    client: pb,
});

export const isConnectionCurrent = (scope: ConnectionScope): boolean => {
    const state = useShopStore.getState();
    return state.activeListId === scope.listId && state.sync.recordId === scope.recordId && pb === scope.client;
};

export function disconnectList(): void {
    const state = useShopStore.getState();
    useShopStore.setState({ lists: state.lists.map(l => l.id === state.activeListId ? { ...l, autoSync: false } : l) });
    state.setSyncState({ connected: false, code: null, recordId: null, msg: '' });
    state.registerActiveListSync({ code: null, recordId: null });
    localStorage.removeItem('shopListSyncCode');
}

// Items are stored in shopping_items. The old data.items snapshot can be stale
// and must never be written back when someone joins an existing list.
export async function fetchListData(recordId: string, client = pb): Promise<ConnectionData> {
    const [list, records] = await Promise.all([
        client.collection('shopping_lists').getOne(recordId),
        client.collection('shopping_items').getFullList({
            filter: client.filter('list = {:id}', { id: recordId }),
            sort: '-created',
        }),
    ]);
    return {
        listName: list.data?.listName ?? list.name ?? null,
        items: records.map((r: RecordModel) => ({
            id: r.id, name: r.name, category: r.category, checked: r.checked,
            note: r.note || '', inList: r.in_list !== false,
            addedBy: r.added_by, checkedBy: r.checked_by,
            serverUpdated: parsePbDate(r.updated), updatedAt: parsePbDate(r.updated),
        })),
    };
}

export function mergeConnectionItems(local: ShopItem[], remote: ShopItem[], preserveLocalIds = true): ShopItem[] {
    const remoteIds = new Set(remote.map(i => i.id));
    const localById = new Map(local.map(i => [i.id, i]));
    return [
        ...local.filter(i => !remoteIds.has(i.id)).map(i => ({
            ...i,
            // A record from a different list cannot be updated in place. Give
            // the copy a local id so the normal queue creates it in its new list.
            id: preserveLocalIds && i.id.startsWith('local_') ? i.id : `local_${crypto.randomUUID()}`,
            serverUpdated: undefined,
            dirty: false,
        })),
        ...remote.map(i => localById.get(i.id)?.dirty ? localById.get(i.id)! : i),
    ];
}

// Refuse late responses after the user switched lists. Keep a previously shared
// list in the switcher instead of rebinding it to a different server record.
export function finishListConnection(
    recordId: string, code: string | null, data: ConnectionData,
    scope: ConnectionScope, mergeLocal = false,
): boolean {
    const source = useShopStore.getState();
    if (!isConnectionCurrent(scope)) return false;
    const existing = source.lists.find(l => l.recordId === recordId);
    const copying = (existing && existing.id !== scope.listId) || (source.sync.recordId && source.sync.recordId !== recordId);
    if (existing) source.switchList(existing.id);
    else if (source.sync.recordId && source.sync.recordId !== recordId) {
        source.createList(data.listName);
    }
    const state = useShopStore.getState();
    const sameDestination = existing || source.sync.recordId === recordId;
    const deleted = new Set(sameDestination ? state.deletedItemIds : []);
    const cached = sameDestination ? state.items : [];
    const cachedById = new Map(cached.map(i => [i.id, i]));
    const remote = data.items.filter(i => !deleted.has(i.id)).map(i => {
        const local = cachedById.get(i.id);
        return local && (local.dirty || hasPendingWrite(i.id)) ? local : i;
    });
    let items = [...cached.filter(i => i.id.startsWith('local_') && !deleted.has(i.id)), ...remote];
    if (mergeLocal) items = mergeConnectionItems(source.items.filter(i => !source.deletedItemIds.includes(i.id)), items, !copying);
    if (!sameDestination) useShopStore.setState({ deletedItemIds: [], disabledProducts: [], disabledCategories: [] });
    state.syncFromRemote({ ...data, categories: data.categories ?? state.categories, items });
    state.setListName(data.listName);
    state.setSyncState({ connected: true, code, recordId, msg: 'Connected', msgType: 'success' });
    state.registerActiveListSync({ code, recordId });
    useShopStore.setState(current => ({ lists: current.lists.map(l => l.id === current.activeListId ? { ...l, autoSync: true } : l) }));
    if (code) {
        state.addToSyncHistory(code);
        localStorage.setItem('shopListSyncCode', code);
    } else localStorage.removeItem('shopListSyncCode');
    return true;
}
