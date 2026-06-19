import PocketBase from 'pocketbase';

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

const url = getServerUrl();
export let pb = new PocketBase(url || 'http://localhost:8090');
pb.autoCancellation(false);

// Tracks whether the current token has been validated against the server this
// load, so we only pay the authRefresh round-trip once.
let sessionValidated = false;

// Function to reinitialize PocketBase with a new URL (for native apps)
export const reinitializePocketBase = (newUrl: string) => {
    pb = new PocketBase(newUrl);
    pb.autoCancellation(false);
    sessionValidated = false; // new server -> must re-validate/re-create
    return pb;
};

// Ensures there is a valid (at least guest) session against the CURRENT server.
// A token can look valid locally (not expired) while the user no longer exists
// on the server — e.g. after the 90-day guest purge or a server reset — which
// would make every request fail with 401. We validate once per load with
// authRefresh and, on failure, transparently create a fresh guest session.
export const ensureGuestSession = async (): Promise<boolean> => {
    if (pb.authStore.isValid) {
        if (sessionValidated) return true;
        try {
            await pb.collection(pb.authStore.record?.collectionName || 'users').authRefresh();
            sessionValidated = true;
            return true;
        } catch {
            pb.authStore.clear();
        }
    }
    try {
        const auth = await pb.send<{ token: string; record: Record<string, unknown> }>('/api/shoplist/guests', { method: 'POST' });
        pb.authStore.save(auth.token, auth.record as any);
        sessionValidated = true;
        return true;
    } catch (error) {
        console.error('Failed to create a guest session:', error);
        return false;
    }
};

// Export helper for components
export { isNativePlatform };
