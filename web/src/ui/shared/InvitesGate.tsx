import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { pb } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';
import { tt } from '../../data/i18n';
import { useAccountSync } from './useAccountSync';

interface Invite { id: string; listId: string; listName: string; inviter: string; role: string }

const MINT = '#10B981';
const INK = '#06231A';

// Shows pending list invitations (added as admin by email) one at a time, with
// the list name + who invited you, and Accept/Decline. Accepting joins the list.
export default function InvitesGate() {
    const lang = useShopStore((s) => s.lang);
    const t = tt(lang);
    const acc = useAccountSync();
    const [invites, setInvites] = useState<Invite[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = () => {
            const rec = pb.authStore.record as any;
            if (!rec || rec.account_type !== 'account') { setInvites([]); return; }
            pb.send<Invite[]>('/api/shoplist/invites', { method: 'GET' })
                .then((r) => { if (!cancelled) setInvites(r || []); })
                .catch(() => { });
        };
        load();
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        const unsub = pb.authStore.onChange(load);
        return () => { cancelled = true; window.removeEventListener('focus', onFocus); unsub(); };
    }, []);

    if (!invites.length) return null;
    const inv = invites[0];

    const respond = async (accept: boolean) => {
        setBusy(true);
        try {
            await pb.send(`/api/shoplist/invites/${inv.id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
            setInvites((prev) => prev.filter((x) => x.id !== inv.id));
            if (accept) await acc.recoverLists();
        } catch { /* will reappear on next load */ } finally { setBusy(false); }
    };

    return createPortal(
        <div style={overlay}>
            <div style={sheet}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: MINT, fontWeight: 600, marginBottom: 6 }}>{t.inviteTitle}</div>
                <div style={{ fontSize: 15.5, color: INK, fontWeight: 500, marginBottom: 20, lineHeight: 1.4 }}>
                    {t.inviteBody.replace('{who}', inv.inviter || '—').replace('{list}', inv.listName || t.myList)}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button disabled={busy} onClick={() => respond(true)} style={{ flex: 1, border: 'none', background: MINT, color: '#fff', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>{t.inviteAccept}</button>
                    <button disabled={busy} onClick={() => respond(false)} style={{ flex: 1, border: '1px solid rgba(6,35,26,0.16)', background: '#fff', color: INK, borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>{t.inviteDecline}</button>
                </div>
            </div>
        </div>, document.body);
}

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(6,35,26,0.45)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16,
};
const sheet: React.CSSProperties = {
    width: '100%', maxWidth: 380, background: '#FBFAF6', borderRadius: 20, padding: 22,
    boxShadow: '0 20px 60px rgba(6,35,26,0.3)', fontFamily: 'DM Sans, system-ui, sans-serif',
};
