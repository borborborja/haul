import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const mocks = vi.hoisted(() => ({ sharedToken: '', clients: [] as Array<{
    authStore: { token: string; isValid: boolean; record: { collectionName: string }; clear: ReturnType<typeof vi.fn>; save: Mock<(token: string, record?: unknown) => void> };
    baseURL: string;
    realtime: { unsubscribe: ReturnType<typeof vi.fn> };
    autoCancellation: ReturnType<typeof vi.fn>;
    collection: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
}> }));
vi.mock('pocketbase', () => ({
    BaseAuthStore: class {
        token = '';
        record = null;
        isValid = false;
        clear = vi.fn(() => { this.token = ''; });
        save = vi.fn((token: string) => { this.token = token; });
    },
    default: class {
        authStore = {
            isValid: false, record: { collectionName: 'users' },
            get token() { return mocks.sharedToken; },
            clear: vi.fn(() => { mocks.sharedToken = ''; }),
            save: vi.fn((token: string) => { mocks.sharedToken = token; }),
        };
        baseURL: string;
        realtime = { unsubscribe: vi.fn().mockResolvedValue(undefined) };
        autoCancellation = vi.fn();
        refresh = vi.fn();
        collection = vi.fn(() => ({ authRefresh: this.refresh }));
        send = vi.fn();
        constructor(url: string) { this.baseURL = url; mocks.clients.push(this); }
    },
}));

let pocketbaseModule: typeof import('../pocketbase');

beforeEach(async () => {
    vi.resetModules();
    mocks.clients.length = 0;
    mocks.sharedToken = '';
    vi.stubGlobal('window', { location: { origin: 'https://haul.example' } });
    // Finish the cold module import before a timed request test starts.
    pocketbaseModule = await import('../pocketbase');
});

describe('ensureGuestSession', () => {
    it('preserves the existing account when session validation fails offline', async () => {
        const { ensureGuestSession } = pocketbaseModule;
        const client = mocks.clients[0];
        client.authStore.isValid = true;
        client.refresh.mockRejectedValue({ status: 0 });
        expect(await ensureGuestSession()).toBe(false);
        expect(client.authStore.clear).not.toHaveBeenCalled();
        expect(client.send).not.toHaveBeenCalled();
    });
    it('coalesces concurrent guest requests into one identity', async () => {
        const { ensureGuestSession } = pocketbaseModule;
        const client = mocks.clients[0];
        let resolve!: (value: unknown) => void;
        client.send.mockImplementation(() => new Promise(done => { resolve = done; }));
        const one = ensureGuestSession();
        const two = ensureGuestSession();
        expect(client.send).toHaveBeenCalledTimes(1);
        resolve({ token: 'test-token', record: { id: 'guest' } });
        expect(await Promise.all([one, two])).toEqual([true, true]);
        expect(client.authStore.save).toHaveBeenCalledTimes(1);
    });
    it('keeps the same client and session when the configured URL is unchanged', async () => {
        const { pb, reinitializePocketBase } = pocketbaseModule;
        expect(reinitializePocketBase(`${pb.baseURL}/`)).toBe(pb);
        expect(mocks.clients).toHaveLength(1);
        expect(mocks.clients[0].authStore.clear).not.toHaveBeenCalled();
    });
    it('clears credentials and the old realtime connection before changing hosts', async () => {
        const { reinitializePocketBase } = pocketbaseModule;
        const previousAuth = mocks.clients[0].authStore;
        reinitializePocketBase('https://other.example');
        expect(mocks.clients[0].realtime.unsubscribe).toHaveBeenCalledTimes(1);
        expect(previousAuth.clear).toHaveBeenCalledTimes(1);
        expect(mocks.clients[1].authStore.clear).toHaveBeenCalledTimes(1);
    });
    it('does not apply a previous server response after changing servers', async () => {
        const { ensureGuestSession, reinitializePocketBase } = pocketbaseModule;
        const client = mocks.clients[0];
        let resolve!: (value: unknown) => void;
        client.send.mockImplementation(() => new Promise(done => { resolve = done; }));
        const request = ensureGuestSession();
        reinitializePocketBase('https://other.example');
        resolve({ token: 'old-server-token', record: { id: 'guest' } });
        expect(await request).toBe(false);
        expect(client.authStore.save).not.toHaveBeenCalled();
        expect(mocks.clients[1].authStore.save).not.toHaveBeenCalled();
    });
    it('isolates an SDK auth refresh that saves after the server was changed', async () => {
        const { ensureGuestSession, reinitializePocketBase } = pocketbaseModule;
        const previous = mocks.clients[0];
        previous.authStore.isValid = true;
        let finish!: () => void;
        previous.refresh.mockImplementation(async () => {
            await new Promise<void>(resolve => { finish = resolve; });
            // The real SDK performs this save before its authRefresh resolves.
            previous.authStore.save('old-server-response', { collectionName: 'users' });
        });
        const pending = ensureGuestSession();
        reinitializePocketBase('https://other.example');
        const current = mocks.clients[1];
        current.authStore.save('new-server-session', { collectionName: 'users' });
        finish();
        expect(await pending).toBe(false);
        expect(current.authStore.token).toBe('new-server-session');
        expect(mocks.sharedToken).toBe('new-server-session');
    });
    it('replaces a rejected expired identity with a guest', async () => {
        const { ensureGuestSession } = pocketbaseModule;
        const client = mocks.clients[0];
        client.authStore.isValid = true;
        client.refresh.mockRejectedValue({ status: 401 });
        client.send.mockResolvedValue({ token: 'test-token', record: { id: 'guest' } });
        expect(await ensureGuestSession()).toBe(true);
        expect(client.authStore.clear).toHaveBeenCalledTimes(1);
        expect(client.authStore.save).toHaveBeenCalledTimes(1);
    });
});
