import PocketBase, { BaseAuthStore } from 'pocketbase';

// Helper to detect if running in Capacitor native app
const isNativePlatform = () => {
    return typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();
};

// Get the server URL based on context
const getServerUrl = (): string => {
    // For native apps, use configured server URL from localStorage (persisted by Zustand)
    if (isNativePlatform()) {
        try {
            const stored = localStorage.getItem('shoplist-storage');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.state?.serverUrl) {
                    return parsed.state.serverUrl;
                }
            }
        } catch (e) {
            console.warn('Error reading serverUrl from storage:', e);
        }
        // Default fallback for native - user must configure
        return '';
    }

    // For web: production uses same origin, dev uses local backend
    return import.meta.env.PROD
        ? window.location.origin
        : 'http://127.0.0.1:8090';
};

export const normalizeServerUrl = (serverUrl: string) => new URL(serverUrl, window.location.origin).href.replace(/\/+$/, '');

const url = getServerUrl();
export let pb = new PocketBase(url || 'http://localhost:8090');
pb.autoCancellation(false);

// Tracks whether the current token has been validated against the server this
// load, so we only pay the authRefresh round-trip once.
let sessionValidated = false;
let sessionRequest: { client: PocketBase; promise: Promise<boolean> } | undefined;

// Function to reinitialize PocketBase with a new URL (for native apps)
export const reinitializePocketBase = (newUrl: string) => {
    if (normalizeServerUrl(newUrl) === normalizeServerUrl(pb.baseURL)) return pb;
    void pb.realtime.unsubscribe();
    // The default auth store is shared across SDK instances. Clear it before
    // constructing the new client so a different host never receives its token.
    pb.authStore.clear();
    // SDK authRefresh/authWithPassword save their result before resolving. A
    // late old-server response must write only to this detached memory store.
    pb.authStore = new BaseAuthStore();
    pb = new PocketBase(newUrl);
    pb.authStore.clear();
    pb.autoCancellation(false);
    sessionValidated = false; // new server -> must re-validate/re-create
    return pb;
};

// Ensures there is a valid (at least guest) session against the CURRENT server.
// A token can look valid locally (not expired) while the user no longer exists
// on the server — e.g. after the 90-day guest purge or a server reset — which
// would make every request fail with 401. We validate once per load with
// authRefresh and, on failure, transparently create a fresh guest session.
export const ensureGuestSession = (): Promise<boolean> => {
    const client = pb;
    if (sessionRequest?.client === client) return sessionRequest.promise;
    const promise = (async () => {
        if (client.authStore.isValid) {
            if (sessionValidated) return true;
            try {
                await client.collection(client.authStore.record?.collectionName || 'users').authRefresh();
                if (pb !== client) return false;
                sessionValidated = true;
                return true;
            } catch (error) {
                if (pb !== client) return false;
                const status = (error as { status?: number }).status ?? 0;
                // A temporary network/server failure must not log an account out
                // or replace its identity and memberships with a guest.
                if (![401, 403, 404].includes(status)) return false;
                client.authStore.clear();
            }
        }
        try {
            const auth = await client.send<{ token: string; record: Record<string, unknown> }>('/api/shoplist/guests', { method: 'POST' });
            if (pb !== client) return false;
            client.authStore.save(auth.token, auth.record as any);
            sessionValidated = true;
            return true;
        } catch (error) {
            console.error('Failed to create a guest session:', error);
            return false;
        }
    })();
    sessionRequest = { client, promise };
    void promise.finally(() => {
        if (sessionRequest?.promise === promise) sessionRequest = undefined;
    });
    return promise;
};

// Export helper for components
export { isNativePlatform };
