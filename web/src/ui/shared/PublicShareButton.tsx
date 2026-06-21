import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Copy, MessageCircle, Send } from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { shareUrl, type ShareMode } from '../share/shareApi';
import type { UIDict } from '../../data/i18n';

interface ShareState { token: string; mode: string }

interface Props {
    recordId: string | null;
    t: UIDict;
    // Parent renders its own button styling and calls `open` to launch the modal.
    trigger: (open: () => void) => ReactNode;
}

const MINT = '#10B981';
const INK = '#06231A';

export default function PublicShareButton({ recordId, t, trigger }: Props) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<ShareState>({ token: '', mode: '' });
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open || !recordId) return;
        pb.send<ShareState>(`/api/shoplist/lists/${recordId}/share`, { method: 'GET' })
            .then(setState)
            .catch(() => setState({ token: '', mode: '' }));
    }, [open, recordId]);

    const setMode = async (mode: ShareMode, rotate = false) => {
        if (!recordId) return;
        setBusy(true);
        try {
            const res = await pb.send<ShareState>(`/api/shoplist/lists/${recordId}/share`, { method: 'POST', body: { mode, rotate } });
            setState(res);
        } catch { /* owner-only / offline */ } finally { setBusy(false); }
    };

    const stop = async () => {
        if (!recordId) return;
        setBusy(true);
        try {
            await pb.send(`/api/shoplist/lists/${recordId}/share/revoke`, { method: 'POST' });
            setState({ token: '', mode: '' });
        } catch { /* ignore */ } finally { setBusy(false); }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl(state.token));
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch { /* clipboard blocked */ }
    };

    const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl(state.token))}`, '_blank');
    const telegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl(state.token))}`, '_blank');

    const modes: { key: ShareMode; label: string; sub: string }[] = [
        { key: 'read', label: t.shareModeRead, sub: t.shareModeReadSub },
        { key: 'shop', label: t.shareModeShop, sub: t.shareModeShopSub },
        { key: 'plan', label: t.shareModePlan, sub: t.shareModePlanSub },
    ];

    const active = state.mode !== '' && state.token !== '';

    const modal = open ? createPortal(
        <div onClick={() => setOpen(false)} style={overlay}>
            <div onClick={(e) => e.stopPropagation()} style={sheet}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h2 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 21, margin: 0, color: INK }}>{t.publicLink}</h2>
                    <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: 'rgba(6,35,26,0.4)' }}>×</button>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'rgba(6,35,26,0.6)' }}>{t.publicLinkSub}</p>

                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(6,35,26,0.5)', marginBottom: 9 }}>{t.chooseAccess}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: active ? 18 : 4 }}>
                    {modes.map((m) => {
                        const sel = state.mode === m.key;
                        return (
                            <button key={m.key} disabled={busy} onClick={() => setMode(m.key)} style={{
                                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer',
                                border: sel ? `2px solid ${MINT}` : '1px solid rgba(6,35,26,0.14)', borderRadius: 13,
                                padding: '11px 14px', background: sel ? 'rgba(16,185,129,0.07)' : '#fff', color: INK,
                            }}>
                                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{m.label}{sel && <span style={{ color: MINT }}> ✓</span>}</span>
                                <span style={{ fontSize: 12.5, color: 'rgba(6,35,26,0.55)' }}>{m.sub}</span>
                            </button>
                        );
                    })}
                </div>

                {active && (
                    <>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(6,35,26,0.05)', borderRadius: 11, padding: '10px 12px', marginBottom: 10 }}>
                            <span style={{ flex: 1, fontFamily: 'DM Mono, monospace', fontSize: 12.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl(state.token)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <button onClick={copy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', background: MINT, color: '#fff', borderRadius: 11, padding: '11px 12px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}><Copy size={15} />{copied ? t.linkCopied : t.copyLink}</button>
                            <button onClick={whatsapp} aria-label="WhatsApp" style={{ ...iconBtn, color: '#25D366' }}><MessageCircle size={18} /></button>
                            <button onClick={telegram} aria-label="Telegram" style={{ ...iconBtn, color: '#229ED9' }}><Send size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button disabled={busy} onClick={() => setMode(state.mode as ShareMode, true)} style={ghost}>{t.regenerate}</button>
                            <button disabled={busy} onClick={stop} style={{ ...ghost, color: '#B42318', borderColor: 'rgba(180,35,24,0.25)' }}>{t.stopSharing}</button>
                        </div>
                    </>
                )}
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
const ghost: React.CSSProperties = {
    flex: 1, border: '1px solid rgba(6,35,26,0.16)', background: '#fff', color: INK,
    borderRadius: 11, padding: '10px 12px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44,
    border: '1px solid rgba(6,35,26,0.14)', background: '#fff', borderRadius: 11, cursor: 'pointer', flexShrink: 0,
};
