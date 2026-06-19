import { useCallback, useEffect } from 'react';
import { useShopStore } from '../store/shopStore';
import { pb, ensureGuestSession } from '../lib/pocketbase';

export function useGuestAuth() {
    const setAuth = useShopStore((state) => state.setAuth);

    const syncAuthState = useCallback(() => {
        const model = pb.authStore.record;
        setAuth({
            isLoggedIn: pb.authStore.isValid,
            email: model?.email ?? null,
            userId: model?.id ?? null,
            username: model?.display_name ?? null
        });
    }, [setAuth]);

    const ensureGuestAuth = useCallback(async () => {
        await ensureGuestSession();
        syncAuthState();
    }, [syncAuthState]);

    useEffect(() => {
        void ensureGuestAuth();
    }, [ensureGuestAuth]);

    return { ensureGuestAuth };
}
