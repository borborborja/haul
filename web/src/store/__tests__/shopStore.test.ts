import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopItem } from '../../types';
import { pendingCreates } from '../../lib/syncMeta';

const mocks = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn(), create: vi.fn(), clear: vi.fn() }));
vi.mock('../../lib/itemWriteQueue', () => ({ enqueueItemUpdate: mocks.update, enqueueItemDelete: mocks.remove, itemQueue: { clear: mocks.clear } }));
vi.mock('../../lib/pocketbase', () => ({ pb: { baseURL: 'https://a.example', collection: () => ({ create: mocks.create }) }, normalizeServerUrl: (url: string) => url.replace(/\/+$/, '') }));
let useShopStore: typeof import('../shopStore').useShopStore;
const item: ShopItem = { id: 'remote_one', name: 'Milk', category: 'dairy', checked: false, note: '', inList: true };
const record = { id: 'remote_one', name: 'Milk', category: 'dairy', checked: false, note: '', in_list: true };

beforeAll(async () => {
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), localStorage: storage });
    vi.stubGlobal('localStorage', storage);
    ({ useShopStore } = await import('../shopStore'));
});
beforeEach(() => {
    useShopStore.setState(useShopStore.getInitialState(), true);
    pendingCreates.clear();
    vi.clearAllMocks();
});

describe('offline and multi-list item writes', () => {
    it('queues updates to existing server items while disconnected and marks them dirty', () => {
        useShopStore.setState({ items: [item], sync: { ...useShopStore.getState().sync, recordId: 'list_one' } });
        useShopStore.getState().toggleCheck(item.id);
        expect(mocks.update).toHaveBeenCalledWith(item.id, { checked: true });
        expect(useShopStore.getState().items[0]).toMatchObject({ checked: true, dirty: true });
    });
    it('persists deletion intent instead of resurrecting an offline deletion on refresh', () => {
        useShopStore.setState({ items: [item], sync: { ...useShopStore.getState().sync, recordId: 'list_one' } });
        useShopStore.getState().deleteItem(item.id);
        expect(useShopStore.getState().deletedItemIds).toEqual([item.id]);
        expect(mocks.remove).toHaveBeenCalledWith(item.id);
    });
    it('reconciles a create into the original cached list after switching lists', () => {
        useShopStore.setState({ items: [{ ...item, id: 'local_one', note: 'Keep edit' }] });
        const original = useShopStore.getState().activeListId;
        useShopStore.getState().createList('Other');
        useShopStore.getState().confirmItemCreated('local_one', record);
        expect(useShopStore.getState().items).toEqual([]);
        expect(useShopStore.getState().listCaches[original].items[0]).toMatchObject({ id: record.id, note: 'Keep edit' });
        expect(mocks.update).toHaveBeenCalledWith(record.id, expect.objectContaining({ note: 'Keep edit' }));
    });
    it('keeps a deleted temp item deleted even when its realtime create arrives first', () => {
        pendingCreates.add('local_one');
        useShopStore.setState({ items: [{ ...item, id: 'local_one' }] });
        useShopStore.getState().deleteItem('local_one');
        useShopStore.getState().confirmItemCreated('local_one', record);
        expect(useShopStore.getState().items).toEqual([]);
        expect(useShopStore.getState().deletedItemIds).toEqual([record.id]);
        expect(mocks.remove).toHaveBeenCalledWith(record.id);
    });
    it('isolates custom categories, disabled products and deleted items between local lists', () => {
        const original = useShopStore.getState().activeListId;
        useShopStore.setState({ disabledProducts: ['Milk'], disabledCategories: ['dairy'], deletedItemIds: ['gone'], categories: { custom: { icon: 'A', items: [] } } });
        useShopStore.getState().createList('Other');
        expect(useShopStore.getState().disabledProducts).toEqual([]);
        expect(useShopStore.getState().categories.custom).toBeUndefined();
        useShopStore.getState().switchList(original);
        expect(useShopStore.getState().disabledProducts).toEqual(['Milk']);
        expect(useShopStore.getState().disabledCategories).toEqual(['dairy']);
        expect(useShopStore.getState().deletedItemIds).toEqual(['gone']);
        expect(useShopStore.getState().categories.custom).toBeDefined();
    });
    it('isolates server workspaces and restores items and metadata when returning', () => {
        useShopStore.setState({ items: [item], listName: 'Server A', disabledProducts: ['milk'], sync: { ...useShopStore.getState().sync, code: 'A123', recordId: 'list_a', connected: true } });
        useShopStore.getState().setServerUrl('https://b.example');
        expect(useShopStore.getState().items).toEqual([]);
        expect(useShopStore.getState().sync).toMatchObject({ recordId: null, code: null, connected: false });
        useShopStore.setState({ items: [{ ...item, id: 'local_b', name: 'Bread' }], listName: 'Server B' });
        useShopStore.getState().setServerUrl('https://a.example/');
        expect(useShopStore.getState().items).toEqual([item]);
        expect(useShopStore.getState().listName).toBe('Server A');
        expect(useShopStore.getState().disabledProducts).toEqual(['milk']);
        expect(useShopStore.getState().sync).toMatchObject({ recordId: 'list_a', code: 'A123', connected: false });
        expect(useShopStore.getState().serverWorkspaces['https://b.example'].listName).toBe('Server B');
        expect(mocks.clear).toHaveBeenCalledTimes(2);
    });
    it('auto-clears only expired purchases using the configured duration', async () => {
        useShopStore.setState({ autoClearMinutes: 5, items: [
            { ...item, id: 'old', checked: true, updatedAt: Date.now() - 6 * 60000 },
            { ...item, id: 'recent', checked: true, updatedAt: Date.now() - 60000 },
        ] });
        await useShopStore.getState().checkAndAutoClear();
        expect(useShopStore.getState().items[0]).toMatchObject({ checked: false, inList: false });
        expect(useShopStore.getState().items[1]).toMatchObject({ checked: true, inList: true });
    });
});
