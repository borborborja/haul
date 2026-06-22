import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Copy, X } from 'lucide-react';
import { listMembers, addAdmin, fetchAdminLink, removeMember, avatarSrc, type Member } from './membersApi';
import { shareUrl } from '../share/shareApi';
import type { UIDict } from '../../data/i18n';

interface Props {
    recordId: string | null;
    t: UIDict;
    trigger: (open: () => void) => ReactNode;
}

const MINT = '#10B981';
const INK = '#06231A';
const PALETTE = ['#10B981', '#0EA5E9', '#6366F1', '#EC4899', '#F59E0B', '#EF4444', '#14B8A6', '#8B5CF6'];

function Avatar({ m, size = 36 }: { m: Member; size?: number }) {
    const src = avatarSrc(m.avatarUrl);
    const bg = m.color || PALETTE[(m.name?.charCodeAt(0) || 0) % PALETTE.length];
    if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0 }}>
            {(m.name || '?').charAt(0).toUpperCase()}
        </div>
    );
}

// Short, locale-agnostic relative time for "last active".
function ago(iso: string, neverLabel: string) {
    if (!iso) return neverLabel;
    const t = Date.parse(iso.replace(' ', 'T'));
    if (Number.isNaN(t)) return neverLabel;
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 90) return '·';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

export default function MembersButton({ recordId, t, trigger }: Props) {
    const [open, setOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [adminUrl, setAdminUrl] = useState('');
    const [busy, setBusy] = useState(false);

    const load = () => { if (recordId) listMembers(recordId).then(setMembers).catch(() => setMembers([])); };
    useEffect(() => { if (open) { load(); setMsg(''); setAdminUrl(''); } }, [open, recordId]);

    const invite = async () => {
        if (!recordId || !email.trim()) return;
        setBusy(true); setMsg('');
        try {
            const res = await addAdmin(recordId, email.trim());
            if (res.noAccount) setMsg(t.emailNoAccount);
            else { setMsg(t.adminAdded); setEmail(''); load(); }
        } catch { setMsg(t.emailNoAccount); } finally { setBusy(false); }
    };

    const copyAdminLink = async () => {
        if (!recordId) return;
        try {
            const { token } = await fetchAdminLink(recordId);
            const url = shareUrl(token);
            setAdminUrl(url);
            await navigator.clipboard.writeText(url).catch(() => {});
        } catch { /* not allowed */ }
    };

    const kick = async (userId: string) => {
        if (!recordId) return;
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        try { await removeMember(recordId, userId); } catch { load(); }
    };

    const roleLabel = (r: Member['role']) => r === 'owner' ? t.roleOwner : r === 'admin' ? t.roleAdmin : t.roleGuest;

    const modal = open ? createPortal(
        <div onClick={() => setOpen(false)} style={overlay}>
            <div onClick={(e) => e.stopPropagation()} style={sheet}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                    <h2 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 21, margin: 0, color: INK }}>{t.members}</h2>
                    <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(6,35,26,0.4)' }}><X size={20} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                    {members.map((m) => (
                        <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <Avatar m={m} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || '—'}</div>
                                <div style={{ fontSize: 12, color: 'rgba(6,35,26,0.5)' }}>{roleLabel(m.role)} · {ago(m.lastActiveAt, t.neverActive)}</div>
                            </div>
                            {m.role !== 'owner' && (
                                <button onClick={() => kick(m.userId)} style={{ border: 'none', background: 'transparent', color: 'rgba(180,35,24,0.7)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>{t.remove}</button>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(6,35,26,0.5)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={13} />{t.addAdmin}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} type="email" style={{ flex: 1, border: '1px solid rgba(6,35,26,0.15)', borderRadius: 11, padding: '10px 12px', fontSize: 14, outline: 'none', background: '#fff', color: INK }} />
                    <button disabled={busy} onClick={invite} style={{ border: 'none', background: MINT, color: '#fff', borderRadius: 11, padding: '0 16px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>{t.adminByEmail}</button>
                </div>
                <button onClick={copyAdminLink} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid rgba(6,35,26,0.16)', background: '#fff', color: INK, borderRadius: 11, padding: '10px 12px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}><Copy size={15} />{t.copyAdminLink}</button>
                {adminUrl && <div style={{ marginTop: 8, fontFamily: 'DM Mono, monospace', fontSize: 11.5, color: 'rgba(6,35,26,0.6)', wordBreak: 'break-all' }}>{adminUrl}</div>}
                {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: INK, opacity: 0.75 }}>{msg}</div>}
            </div>
        </div>, document.body) : null;

    return <>{trigger(() => setOpen(true))}{modal}</>;
}

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(6,35,26,0.4)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, padding: 14,
};
const sheet: React.CSSProperties = {
    width: '100%', maxWidth: 440, background: '#FBFAF6', borderRadius: 20, padding: 22,
    boxShadow: '0 20px 60px rgba(6,35,26,0.3)', fontFamily: 'DM Sans, system-ui, sans-serif',
    maxHeight: '88dvh', overflowY: 'auto', marginBottom: 'env(safe-area-inset-bottom)',
};
