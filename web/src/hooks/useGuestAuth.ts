import { useCallback, useEffect } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb, ensureGuestSession } from '../lib/pocketbase';
import { isAccountSession } from '../utils/auth';

export function useGuestAuth() {
    const setAuth = useShopStore((state) => state.setAuth);
    const serverUrl = useShopStore((state) => state.serverUrl);

    const syncAuthState = useCallback(() => {
        const model = pb.authStore.record;
        setAuth({
            isLoggedIn: isAccountSession(pb.authStore),
            email: model?.email ?? null,
            userId: model?.id ?? null,
            username: model?.display_name ?? null,
            avatarUrl: model?.avatar ? pb.files.getURL(model, model.avatar) : null,
            avatarColor: model?.avatar_color ?? null
        });
    }, [setAuth]);

    const ensureGuestAuth = useCallback(async () => {
        await ensureGuestSession();
        syncAuthState();
    }, [syncAuthState]);

    useEffect(() => {
        const unsubscribe = pb.authStore.onChange(syncAuthState);
        void ensureGuestAuth();
        return unsubscribe;
    }, [ensureGuestAuth, syncAuthState, serverUrl]);

    return { ensureGuestAuth };
}
