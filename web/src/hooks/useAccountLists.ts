import { useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { useShopStore } from '../store/shopStore';

// Keep the local multi-list set in sync with the account's server memberships,
// automatically — so the same account always shows the same lists on every
// device with no manual "recover". Additive and non-destructive: it only ADDS
// lists the account is a member of (never removes), and switches away from the
// pristine empty default to a real list so a fresh login lands on real data.
// Runs on mount, on auth change, and when the window/tab regains focus.
export function useAccountLists() {
    useEffect(() => {
        let running = false;
        const run = async () => {
            if (running || !navigator.onLine) return;
            const rec = pb.authStore.record as any;
            if (!rec || rec.account_type !== 'account') return;
            running = true;
            try {
                const members = await pb.collection('list_members').getFullList({
                    filter: pb.filter('user = {:id}', { id: rec.id }),
                    expand: 'list',
                });
                const server = members
                    .map((m: any) => ({ recordId: m.expand?.list?.id as string, name: (m.expand?.list?.data?.listName ?? m.expand?.list?.name ?? null) as string | null, emoji: (m.expand?.list?.data?.emoji ?? '🛒') as string }))
                    .filter((l) => !!l.recordId);
                if (!server.length) return;

                const st = useShopStore.getState();
                const known = new Set(st.lists.filter((l) => l.recordId).map((l) => l.recordId as string));
                const additions = server
                    .filter((l) => !known.has(l.recordId))
                    .map((l) => ({ id: `list_${l.recordId}`, name: l.name, emoji: l.emoji, code: null, recordId: l.recordId, isLocal: false }));
                if (additions.length) useShopStore.setState({ lists: [...st.lists, ...additions] });

                // If sitting on the pristine empty default, jump to a real list.
                const active = useShopStore.getState().lists.find((l) => l.id === st.activeListId);
                const activeTrivial = active && !active.recordId && st.items.length === 0 && !st.listName;
                if (activeTrivial) {
                    const target = useShopStore.getState().lists.find((l) => l.recordId);
                    if (target) useShopStore.getState().switchList(target.id);
                }
            } catch {
                /* offline or rules — leave local lists as-is */
            } finally {
                running = false;
            }
        };

        run();
        const onFocus = () => run();
        window.addEventListener('focus', onFocus);
        const unsub = pb.authStore.onChange(() => run());
        return () => { window.removeEventListener('focus', onFocus); unsub(); };
    }, []);
}
