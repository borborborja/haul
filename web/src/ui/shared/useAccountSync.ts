// Focused account + list-sync actions for the mobile Settings screen.
// Adapted from SettingsModal so the new full-screen settings can create/join
// shared lists and claim/login accounts without depending on that modal.
import { useState } from 'react';
import { pb, ensureGuestSession } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';

export function useAccountSync() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lang = useShopStore((s) => s.lang);

    const fileBase = () => (pb as any).baseURL || (pb as any).baseUrl || window.location.origin;
    const userAvatarUrl = (rec: any) => (rec?.avatar ? `${fileBase()}/api/files/users/${rec.id}/${rec.avatar}` : null);

    const syncAccountState = () => {
        const rec = pb.authStore.record as any;
        useShopStore.getState().setAuth({
            isLoggedIn: pb.authStore.isValid,
            email: rec?.email ?? null,
            userId: rec?.id ?? null,
            username: rec?.display_name ?? null,
            avatarUrl: userAvatarUrl(rec),
            avatarColor: rec?.avatar_color ?? null,
        });
    };

    const saveUserAvatar = async (file: File) => {
        const id = pb.authStore.record?.id;
        if (!id) return;
        const fd = new FormData();
        fd.append('avatar', file);
        try {
            const rec = await pb.collection('users').update(id, fd);
            useShopStore.getState().setAuth({ avatarUrl: userAvatarUrl(rec) });
        } catch { /* upload failed */ }
    };

    const saveUserColor = async (color: string) => {
        const id = pb.authStore.record?.id;
        useShopStore.getState().setAuth({ avatarColor: color });
        if (id && pb.authStore.isValid) {
            try { await pb.collection('users').update(id, { avatar_color: color }); } catch { /* best effort */ }
        }
    };

    const finishConnection = (recordId: string, code: string | null, data: { items: any[]; categories: any; listName?: string | null }) => {
        const s = useShopStore.getState();
        s.syncFromRemote({ items: data.items || [], categories: data.categories || undefined, listName: data.listName });
        s.setSyncState({ connected: true, code, recordId, msg: 'Connected', msgType: 'success' });
        if (code) s.addToSyncHistory(code);
        if (code) localStorage.setItem('shopListSyncCode', code);
        pb.collection('shopping_lists').update(recordId, { data: { items: data.items, categories: data.categories, listName: data.listName } }).catch(() => {});
        s.loadListCustomData();
    };

    // Join a shared list by invite code. On local+remote items, merge by id.
    const join = async (codeInput: string) => {
        const code = codeInput.trim().toUpperCase();
        if (!code) return;
        if (!navigator.onLine) { setError(lang === 'ca' ? 'Sense connexió' : 'Sin conexión'); return; }
        setBusy(true); setError('');
        try {
            const { items, categories, listName } = useShopStore.getState();
            const rec = await pb.send<{ id: string; name: string; inviteCode: string }>('/api/shoplist/lists/join', { method: 'POST', body: { code } });
            const listRecord = await pb.collection('shopping_lists').getOne(rec.id);
            const remote = listRecord.data || { items: [], categories: undefined };
            const remoteItems = remote.items || [];
            const localIds = new Set(items.map((i: any) => i.id));
            const mergedItems = [...items, ...remoteItems.filter((i: any) => !localIds.has(i.id))];
            finishConnection(rec.id, code, { items: mergedItems, categories: remote.categories || categories, listName: remote.listName || listName });
        } catch (e: any) {
            setError(e?.status === 404 ? (lang === 'ca' ? 'Codi no trobat' : 'Código no encontrado') : (lang === 'ca' ? 'Error de connexió' : 'Error de conexión'));
        } finally { setBusy(false); }
    };

    // Create a new shared list (gets an invite code).
    const createShared = async () => {
        if (!navigator.onLine) { setError(lang === 'ca' ? 'Sense connexió' : 'Sin conexión'); return; }
        setBusy(true); setError('');
        try {
            if (!pb.authStore.isValid) { await ensureGuestSession(); syncAccountState(); }
            const { items, categories, listName } = useShopStore.getState();
            const rec = await pb.send<{ id: string; name: string; inviteCode: string }>('/api/shoplist/lists', { method: 'POST', body: { name: listName || 'Shopping list' } });
            finishConnection(rec.id, rec.inviteCode, { items, categories, listName });
        } catch (e: any) {
            setError(e?.response?.message || e?.message || (lang === 'ca' ? 'No s’ha pogut crear la llista' : 'No se pudo crear la lista'));
        } finally { setBusy(false); }
    };

    const disconnect = () => {
        pb.collection('shopping_lists').unsubscribe('*').catch(() => {});
        useShopStore.getState().setSyncState({ connected: false, code: null, recordId: null, msg: '' });
        localStorage.removeItem('shopListSyncCode');
    };

    const claim = async (email: string, password: string) => {
        setBusy(true); setError('');
        try {
            if (!pb.authStore.isValid) await ensureGuestSession();
            const res = await pb.send<{ token: string; record: any }>('/api/shoplist/account/claim', { method: 'POST', body: { email, password } });
            pb.authStore.save(res.token, res.record);
            syncAccountState();
        } catch (e: any) {
            setError(e?.status === 409
                ? (lang === 'ca' ? 'Aquest correu ja té compte. Inicia sessió.' : 'Ese email ya tiene cuenta. Inicia sesión.')
                : (e?.response?.message || e?.message || (lang === 'ca' ? 'No s’ha pogut crear el compte' : 'No se pudo crear la cuenta')));
        } finally { setBusy(false); }
    };

    // Pull EVERY list this account is a member of into the local multi-list set,
    // so the same account shows the same lists on any device. Non-destructive:
    // merges by recordId, keeps existing local lists, then connects to one.
    const recoverLists = async (): Promise<number> => {
        const uid = pb.authStore.record?.id;
        if (!uid) return 0;
        const members = await pb.collection('list_members').getFullList({ filter: pb.filter('user = {:id}', { id: uid }), expand: 'list' });
        const server = members
            .map((m: any) => ({ recordId: m.expand?.list?.id as string, name: (m.expand?.list?.data?.listName ?? m.expand?.list?.name ?? null) as string | null }))
            .filter((l) => !!l.recordId);
        if (!server.length) return 0;

        const st = useShopStore.getState();
        const known = new Map(st.lists.filter((l) => l.recordId).map((l) => [l.recordId as string, l.id] as const));
        const additions = server
            .filter((l) => !known.has(l.recordId))
            .map((l) => ({ id: `list_${l.recordId}`, name: l.name, emoji: '🛒', code: null, recordId: l.recordId, isLocal: false }));
        if (additions.length) useShopStore.setState({ lists: [...st.lists, ...additions] });

        // Switch to a recovered list so it connects (unless already on one of them).
        const activeRecord = st.lists.find((l) => l.id === st.activeListId)?.recordId;
        if (!activeRecord || !server.some((l) => l.recordId === activeRecord)) {
            const firstId = known.get(server[0].recordId) ?? `list_${server[0].recordId}`;
            useShopStore.getState().switchList(firstId);
        }
        return server.length;
    };

    const login = async (email: string, password: string) => {
        if (!navigator.onLine) { setError(lang === 'ca' ? 'Sense connexió' : 'Sin conexión'); return; }
        setBusy(true); setError('');
        try {
            await pb.collection('users').authWithPassword(email, password);
            syncAccountState();
            // Bring in all of the account's lists (same account → same lists everywhere).
            await recoverLists();
        } catch (e: any) {
            setError(e?.response?.message || e?.message || (lang === 'ca' ? 'No s’ha pogut iniciar sessió' : 'No se pudo iniciar sesión'));
        } finally { setBusy(false); }
    };

    const logout = async () => {
        pb.authStore.clear();
        disconnect();
        await ensureGuestSession();
        syncAccountState();
        useShopStore.getState().logout();
    };

    const saveUsername = async (name: string) => {
        const id = pb.authStore.record?.id;
        useShopStore.getState().setUsername(name);
        if (id && pb.authStore.isValid) {
            try { await pb.collection('users').update(id, { display_name: name }); } catch { /* best effort */ }
        }
    };

    return { busy, error, setError, join, createShared, disconnect, claim, login, logout, saveUsername, saveUserAvatar, saveUserColor, recoverLists };
}
