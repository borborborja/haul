import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { pb, ensureGuestSession } from '../lib/pocketbase';
import { useShopStore } from '../store/shopStore';

// "Server ⇒ everything synced." When a server is available and the active list
// is still purely local (no code/recordId), promote it to a shared list
// automatically. The local items (local_ ids) are then pushed by useListSync's
// connect effect. Local-only mode remains for native builds with no serverUrl.
export function useAutoSync() {
    const connected = useShopStore((s) => s.sync.connected);
    const recordId = useShopStore((s) => s.sync.recordId);
    const code = useShopStore((s) => s.sync.code);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!navigator.onLine) return;
            // Web is always served by its origin; native needs an explicit server.
            const serverAvailable = Capacitor.getPlatform() === 'web' || !!useShopStore.getState().serverUrl;
            if (!serverAvailable) return;
            // Leave admin and explicit join-by-URL flows alone.
            if (window.location.hash.startsWith('#/admin') || window.location.pathname.startsWith('/admin')) return;
            const params = new URLSearchParams(window.location.search);
            if (params.get('c') || params.get('code')) return;

            // Real accounts already own lists on the server — they recover them
            // on login instead of auto-creating an empty one (which would shadow
            // the account's existing lists). Auto-create only for guest sessions.
            if ((pb.authStore.record as any)?.account_type === 'account') return;

            const s = useShopStore.getState();
            if (s.sync.connected || s.sync.recordId || s.sync.code) return;

            try {
                if (!pb.authStore.isValid) await ensureGuestSession();
                if (cancelled) return;
                const { listName } = useShopStore.getState();
                const rec = await pb.send<{ id: string; inviteCode: string }>('/api/shoplist/lists', {
                    method: 'POST',
                    body: { name: listName || 'Shopping list' },
                });
                if (cancelled) return;
                const st = useShopStore.getState();
                // A real connect may have landed while we were creating; don't double up.
                if (st.sync.connected || st.sync.recordId) return;
                st.setSyncState({ connected: true, code: rec.inviteCode, recordId: rec.id, msg: '', msgType: 'success' });
                st.registerActiveListSync({ code: rec.inviteCode, recordId: rec.id });
                st.addToSyncHistory(rec.inviteCode);
                localStorage.setItem('shopListSyncCode', rec.inviteCode);
                st.loadListCustomData();
            } catch {
                /* stays local; retried on next mount/state change */
            }
        };
        run();
        return () => { cancelled = true; };
    }, [connected, recordId, code]);
}
