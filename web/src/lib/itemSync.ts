import type { ShopItem } from '../types';
import { parsePbDate } from './syncMeta';

export interface ItemRecord {
    id: string;
    name: string;
    category: string;
    checked: boolean;
    note?: string;
    in_list?: boolean;
    updated?: string;
    added_by?: string;
    checked_by?: string;
}

export const itemWriteBody = (item: ShopItem) => ({
    name: item.name,
    category: item.category,
    checked: item.checked,
    note: item.note,
    in_list: item.inList !== false,
});

// A create response can arrive after an optimistic item was edited or removed.
// Preserve that newer intent instead of silently accepting the original body.
export function reconcileCreatedItem(items: ShopItem[], tempId: string, record: ItemRecord) {
    const local = items.find(i => i.id === tempId);
    const real = items.find(i => i.id === record.id);
    if (!local) return { items, deleted: !real, update: undefined };
    const body = itemWriteBody(local);
    const changed = body.name !== record.name || body.category !== record.category ||
        body.checked !== record.checked || body.note !== (record.note ?? '') ||
        body.in_list !== (record.in_list !== false);
    return {
        items: items.filter(i => i.id !== record.id).map(i => i.id === tempId
            ? { ...i, id: record.id, serverUpdated: parsePbDate(record.updated), dirty: changed }
            : i),
        deleted: false,
        update: changed ? body : undefined,
    };
}

export function mergeRemoteItems(
    localItems: ShopItem[],
    records: ItemRecord[],
    deletedItemIds: string[],
    isPending: (id: string) => boolean = () => false,
    snapshotIds?: ReadonlySet<string>,
): ShopItem[] {
    const localById = new Map(localItems.map(item => [item.id, item]));
    const deleted = new Set(deletedItemIds);
    const remote = records.filter(record => !deleted.has(record.id)).map(record => {
        const local = localById.get(record.id);
        if (local && (local.dirty || isPending(record.id) || (local.serverUpdated ?? 0) > parsePbDate(record.updated))) return local;
        return {
            id: record.id,
            name: record.name,
            checked: record.checked,
            note: record.note ?? '',
            category: record.category,
            addedBy: record.added_by,
            checkedBy: record.checked_by,
            inList: record.in_list,
            serverUpdated: parsePbDate(record.updated),
            updatedAt: parsePbDate(record.updated) || local?.updatedAt || Date.now(),
        } satisfies ShopItem;
    });
    const remoteIds = new Set(records.map(record => record.id));
    // New realtime items and acknowledged creates that arrived after the fetch
    // began aren't in its older snapshot; keep them until the next refresh.
    const pending = localItems.filter(item => !deleted.has(item.id) &&
        (item.id.startsWith('local_') || (snapshotIds && !snapshotIds.has(item.id) && !remoteIds.has(item.id))));
    return [...pending, ...remote];
}
