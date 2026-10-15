import { pb } from './pocketbase';
import { createWriteQueue, type WriteOp } from './writeQueue';
import { beginWrite, endWrite, parsePbDate } from './syncMeta';
import { useShopStore } from '../store/shopStore';

const statusOf = (error: unknown): number => (error as { status?: number })?.status ?? 0;

// Shared queue for shopping_items writes. Transient failures retry with
// backoff; a write that is permanently rejected flags the item dirty so the
// next (re)connect pushes it again instead of silently losing the edit.
export const itemQueue = createWriteQueue({
    execute: async (op: WriteOp) => {
        const token = beginWrite(op.recordId);
        try {
            if (op.kind === 'update') {
                return await pb.collection(op.collection).update(op.recordId, op.body || {});
            }
            await pb.collection(op.collection).delete(op.recordId);
            return null;
        } catch (error) {
            // Deleting something already gone is a success.
            if (op.kind === 'delete' && statusOf(error) === 404) return null;
            throw error;
        } finally {
            endWrite(op.recordId, token);
        }
    },
    // Client errors (validation, permissions, record gone) won't fix
    // themselves by retrying; only retry network/server errors.
    shouldRetry: (error) => {
        const status = statusOf(error);
        return status === 0 || status >= 500;
    },
    onApplied: (op, result) => {
        if (op.collection !== 'shopping_items') return;
        if (op.kind === 'delete') {
            useShopStore.setState(state => ({
                deletedItemIds: state.deletedItemIds.filter(id => id !== op.recordId),
                listCaches: Object.fromEntries(Object.entries(state.listCaches).map(([id, cache]) =>
                    [id, { ...cache, deletedItemIds: cache.deletedItemIds?.filter(itemId => itemId !== op.recordId) }])),
            }));
            return;
        }
        if (!result) return;
        const record = result as { id: string; updated?: string };
        const acknowledge = (items: import('../types').ShopItem[]) => items.map(i => i.id === record.id
            ? { ...i, serverUpdated: parsePbDate(record.updated), dirty: itemQueue.has(op.collection, op.recordId) }
            : i);
        useShopStore.setState(state => ({
            items: acknowledge(state.items),
            listCaches: Object.fromEntries(Object.entries(state.listCaches).map(([id, cache]) =>
                [id, { ...cache, items: acknowledge(cache.items) }])),
        }));
    },
    onGaveUp: (op, error) => {
        if (op.collection !== 'shopping_items') return;
        const { items, listCaches } = useShopStore.getState();
        if (statusOf(error) === 404) {
            // The record was deleted remotely; drop it locally too.
            useShopStore.setState({ items: items.filter(i => i.id !== op.recordId), listCaches: Object.fromEntries(Object.entries(listCaches).map(([id, cache]) => [id, { ...cache, items: cache.items.filter(i => i.id !== op.recordId) }])) });
            return;
        }
        if (op.kind === 'update') {
            console.error('Item write gave up, marking dirty for resync', op.recordId, error);
            useShopStore.setState({
                items: items.map(i => i.id === op.recordId ? { ...i, dirty: true } : i),
                listCaches: Object.fromEntries(Object.entries(listCaches).map(([id, cache]) => [id, { ...cache, items: cache.items.map(i => i.id === op.recordId ? { ...i, dirty: true } : i) }]))
            });
        }
    }
});

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => itemQueue.flush());
}

export const enqueueItemUpdate = (id: string, body: Record<string, unknown>) =>
    itemQueue.enqueueUpdate('shopping_items', id, body);

export const enqueueItemDelete = (id: string) =>
    itemQueue.enqueueDelete('shopping_items', id);
