import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopItem } from '../../../types';
import type { useShopStore } from '../../../store/shopStore';

type State = ReturnType<typeof useShopStore.getState>;
const mocks = vi.hoisted(() => ({ state: {} as State, collection: vi.fn() }));
vi.mock('../../../store/shopStore', () => ({ useShopStore: {
    getState: () => mocks.state,
    setState: (update: Partial<State> | ((state: State) => Partial<State>)) => {
        mocks.state = { ...mocks.state, ...(typeof update === 'function' ? update(mocks.state) : update) };
    },
} }));
vi.mock('../../../lib/pocketbase', () => ({ pb: { collection: mocks.collection, filter: vi.fn(() => 'list filter') } }));

import { captureConnectionScope, disconnectList, fetchListData, finishListConnection, mergeConnectionItems } from '../listConnection';

const item = (id: string, name = 'Milk'): ShopItem => ({ id, name, checked: false, note: '', category: 'dairy', inList: true });

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn() });
    mocks.state = {
        deletedItemIds: [], activeListId: 'source', items: [item('local_draft')], categories: {},
        lists: [{ id: 'source', name: 'Source', emoji: '🛒', recordId: null, code: null, isLocal: true }],
        sync: { recordId: null },
        switchList: vi.fn((id: string) => { mocks.state.activeListId = id; }),
        createList: vi.fn(() => { mocks.state.activeListId = 'new'; return 'new'; }),
        syncFromRemote: vi.fn(), setListName: vi.fn(), setSyncState: vi.fn(),
        registerActiveListSync: vi.fn(), addToSyncHistory: vi.fn(),
    } as unknown as State;
});

describe('joining an atomic shared list', () => {
    it('reads current item rows instead of the obsolete JSON snapshot', async () => {
        const getOne = vi.fn().mockResolvedValue({ name: 'Groceries', data: { items: [item('stale')] } });
        const getFullList = vi.fn().mockResolvedValue([{ ...item('current'), in_list: true, updated: '2026-10-15 10:00:00.000Z' }]);
        mocks.collection.mockImplementation(name => name === 'shopping_lists' ? { getOne } : { getFullList });
        const data = await fetchListData('remote');
        expect(data.listName).toBe('Groceries');
        expect(data.items.map(i => i.id)).toEqual(['current']);
        expect(data.items[0].updatedAt).toBe(Date.parse('2026-10-15T10:00:00.000Z'));
        expect(mocks.collection.mock.calls.map(call => call[0])).toEqual(['shopping_lists', 'shopping_items']);
    });

    it('turns copied server records into pending creates for their destination', () => {
        const [copy, remote] = mergeConnectionItems([item('other_list_row')], [item('remote_row')]);
        expect(copy.id).toMatch(/^local_/);
        expect(remote.id).toBe('remote_row');
    });

    it('preserves pending local identities and takes the authoritative copy of matching remote rows', () => {
        const result = mergeConnectionItems([item('local_draft'), item('same', 'Old')], [item('same', 'Current')]);
        expect(result.map(i => [i.id, i.name])).toEqual([['local_draft', 'Milk'], ['same', 'Current']]);
    });

    it('gives copies fresh temporary ids when both lists remain saved', () => {
        const [copy] = mergeConnectionItems([item('local_original')], [], false);
        expect(copy.id).toMatch(/^local_/);
        expect(copy.id).not.toBe('local_original');
    });

    it('preserves an unacknowledged edit when rejoining the same list', () => {
        const local = { ...item('same', 'New edit'), dirty: true };
        expect(mergeConnectionItems([local], [item('same', 'Old')])).toEqual([local]);
    });

    it('ignores a connection response after the active list changes', () => {
        const scope = captureConnectionScope();
        mocks.state.activeListId = 'different';
        expect(finishListConnection('remote', 'CODE', { items: [], listName: 'Remote' }, scope)).toBe(false);
        expect(mocks.state.syncFromRemote).not.toHaveBeenCalled();
        expect(mocks.state.setSyncState).not.toHaveBeenCalled();
    });

    it('registers a connection in the multi-list switcher without rewriting server metadata', () => {
        finishListConnection('remote', 'CODE', { items: [item('remote_row')], listName: 'Remote' }, captureConnectionScope(), true);
        expect(mocks.state.registerActiveListSync).toHaveBeenCalledWith({ code: 'CODE', recordId: 'remote' });
        expect(mocks.state.syncFromRemote).toHaveBeenCalledWith(expect.objectContaining({
            items: [expect.objectContaining(item('local_draft')), item('remote_row')],
        }));
        expect(mocks.collection).not.toHaveBeenCalled();
    });

    it('keeps the previously shared list instead of overwriting its connection', () => {
        mocks.state.sync.recordId = 'old_remote';
        finishListConnection('new_remote', 'NEW', { items: [], listName: 'New' }, captureConnectionScope());
        expect(mocks.state.createList).toHaveBeenCalledWith('New');
        expect(mocks.state.activeListId).toBe('new');
    });

    it('reuses a known list instead of adding a duplicate', () => {
        mocks.state.lists.push({ id: 'known', name: 'Known', emoji: '🛒', recordId: 'remote', code: null, isLocal: false });
        finishListConnection('remote', null, { items: [], listName: 'Known' }, captureConnectionScope());
        expect(mocks.state.switchList).toHaveBeenCalledWith('known');
        expect(mocks.state.createList).not.toHaveBeenCalled();
        expect(localStorage.removeItem).toHaveBeenCalledWith('shopListSyncCode');
    });

    it('keeps pending edits and deletions in a saved destination when joining it again', () => {
        const scope = captureConnectionScope();
        mocks.state.lists.push({ id: 'known', name: 'Known', emoji: '🛒', recordId: 'remote', code: null, isLocal: false });
        const dirty = { ...item('edited', 'Unsynced edit'), dirty: true };
        mocks.state.switchList = vi.fn(() => {
            mocks.state = { ...mocks.state, activeListId: 'known', items: [item('local_destination'), dirty], deletedItemIds: ['deleted'] };
        });
        finishListConnection('remote', null, { items: [item('edited', 'Old'), item('deleted')], listName: 'Known' }, scope);
        expect(mocks.state.syncFromRemote).toHaveBeenCalledWith(expect.objectContaining({ items: [item('local_destination'), dirty] }));
    });

    it('rejects responses from the previous server even when the local list id matches', () => {
        const scope = { ...captureConnectionScope(), client: {} as ReturnType<typeof captureConnectionScope>['client'] };
        expect(finishListConnection('remote', null, { items: [], listName: null }, scope)).toBe(false);
        expect(mocks.state.syncFromRemote).not.toHaveBeenCalled();
    });

    it('rejects a stale join after the source entry has been connected elsewhere', () => {
        const scope = captureConnectionScope();
        mocks.state.sync.recordId = 'different';
        expect(finishListConnection('remote', null, { items: [], listName: null }, scope)).toBe(false);
    });

    it('keeps an explicit disconnection local until the user connects again', () => {
        disconnectList();
        expect(mocks.state.lists[0].autoSync).toBe(false);
        expect(mocks.state.registerActiveListSync).toHaveBeenCalledWith({ code: null, recordId: null });
        finishListConnection('remote', 'CODE', { items: [], listName: null }, captureConnectionScope());
        expect(mocks.state.lists[0].autoSync).toBe(true);
    });
});
