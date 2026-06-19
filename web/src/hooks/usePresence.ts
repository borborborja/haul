import { useEffect } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb } from '../lib/pocketbase';
import type { PresenceUser } from '../types';

export function usePresence(ensureGuestAuth: () => Promise<void>) {
    const { sync, auth, setActiveUsers, logout } = useShopStore();

    useEffect(() => {
        let heartbeatInterval: any;

        const updatePresence = async () => {
            if (sync.connected && auth.username) {
                try {
                    if (pb.authStore.model?.id) {
                        await pb.collection('users').update(pb.authStore.model.id, {
                            display_name: auth.username,
                            current_list: sync.code,
                            last_active_at: new Date().toISOString()
                        });
                    }
                } catch (e: any) {
                    console.error('Failed to update presence:', e);
                    // Self-healing: If user is 404 (deleted) or 401 (unauthorized)
                    if (e.status === 404 || e.status === 401) {
                        console.warn('User record missing or invalid, resetting auth...');
                        pb.authStore.clear();
                        localStorage.removeItem('shopList_guest');
                        logout();
                        // Trigger immediate re-check/re-login which will now use the preserved name
                        ensureGuestAuth();
                    }
                }
            }
        };

        const fetchActiveUsers = async () => {
            if (sync.connected && sync.recordId) {
                try {
                    // Server route: the users collection rules only allow listing
                    // yourself, so other members' presence must come from here.
                    const active = await pb.send<PresenceUser[]>(
                        `/api/shoplist/lists/${sync.recordId}/presence`,
                        { method: 'GET' }
                    );
                    setActiveUsers((active || []).map(u => ({
                        id: u.id,
                        username: u.username || 'Usuario',
                        lastActiveAt: u.lastActiveAt
                    })));
                } catch (e) {
                    console.error('Failed to fetch active users:', e);
                }
            } else {
                setActiveUsers([]);
            }
        };

        const refreshNow = () => {
            updatePresence();
            fetchActiveUsers();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') refreshNow();
        };

        if (sync.connected) {
            refreshNow();
            heartbeatInterval = setInterval(refreshNow, 20000); // Every 20s
            document.addEventListener('visibilitychange', handleVisibility);
        } else {
            setActiveUsers([]);
        }

        return () => {
            clearInterval(heartbeatInterval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [sync.connected, sync.code, sync.recordId, auth.username]);
}
