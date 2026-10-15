// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShopStore } from '../../../store/shopStore';
import { useAccountSync } from '../useAccountSync';

const mocks = vi.hoisted(() => ({ send: vi.fn(), finish: vi.fn(), bind: vi.fn() }));
vi.mock('../../../lib/pocketbase', () => ({ pb: { baseURL: 'https://a.example', authStore: { isValid: true }, send: mocks.send, collection: () => ({}) }, ensureGuestSession: vi.fn(), normalizeServerUrl: (url: string) => url.replace(/\/+$/, '') }));
vi.mock('../../../lib/itemWriteQueue', () => ({ enqueueItemUpdate: vi.fn(), enqueueItemDelete: vi.fn(), itemQueue: { clear: vi.fn() } }));
vi.mock('../listConnection', async (original) => ({ ...await original<typeof import('../listConnection')>(), finishListConnection: mocks.finish }));
beforeEach(() => {
    vi.clearAllMocks();
    useShopStore.setState(useShopStore.getInitialState(), true);
    useShopStore.setState({ bindLocalCatalog: mocks.bind, sync: { ...useShopStore.getState().sync, recordId: null, connected: false } });
    mocks.send.mockResolvedValue({ id: 'new_remote', inviteCode: 'INVITE' });
});
afterEach(cleanup);
describe('promoting a local list to a shared list', () => {
    it('binds local customizations before finishing the newly created connection', async () => {
        const { result } = renderHook(useAccountSync);
        await act(() => result.current.createShared());
        expect(mocks.bind).toHaveBeenCalledWith('new_remote');
        expect(mocks.finish).toHaveBeenCalled();
        expect(mocks.bind.mock.invocationCallOrder[0]).toBeLessThan(mocks.finish.mock.invocationCallOrder[0]);
    });
    it('does not move a previous remote list customizations into a new shared list', async () => {
        useShopStore.setState({ sync: { ...useShopStore.getState().sync, recordId: 'previous_remote' } });
        const { result } = renderHook(useAccountSync);
        await act(() => result.current.createShared());
        expect(mocks.bind).not.toHaveBeenCalled();
        expect(mocks.finish).toHaveBeenCalled();
    });
    it('ignores a delayed create response after changing the active list', async () => {
        let resolve!: (record: { id: string; inviteCode: string }) => void;
        mocks.send.mockReturnValue(new Promise((accept) => { resolve = accept; }));
        const { result } = renderHook(useAccountSync);
        let pending!: Promise<void>;
        act(() => { pending = result.current.createShared(); });
        act(() => { useShopStore.setState({ activeListId: 'other_list' }); });
        await act(async () => { resolve({ id: 'new_remote', inviteCode: 'INVITE' }); await pending; });
        expect(mocks.bind).not.toHaveBeenCalled();
        expect(mocks.finish).not.toHaveBeenCalled();
    });
});
