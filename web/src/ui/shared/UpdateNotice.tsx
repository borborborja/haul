import { useState } from 'react';
import { Download, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useLatestRelease } from './useLatestRelease';
import { ACCENT, ACCENT_INK, FONT_MONO } from '../theme';
import { alpha } from '../theme';
import type { UIDict } from '../../data/i18n';

// Haul-styled "update available" card for the Settings → About tab (mobile +
// desktop). Renders nothing when the app is up to date. The Update button opens
// the GitHub release (where the new image / APK live — a self-hosted server
// can't update its own client).
export default function UpdateNotice({ t }: { t: UIDict }) {
    const { release, updateAvailable } = useLatestRelease();
    const [open, setOpen] = useState(false);
    if (!updateAvailable || !release) return null;

    return (
        <div style={{ background: 'var(--surface)', border: `1px solid ${alpha(ACCENT, 0.45)}`, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: `0 8px 24px ${alpha(ACCENT, 0.14)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={16} color={ACCENT} />
                <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>{t.updateAvailable}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: ACCENT }}>{release.version}</span>
            </div>
            <button onClick={() => setOpen((o) => !o)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, padding: 0, marginBottom: open ? 10 : 12 }}>
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{t.whatsNew}
            </button>
            {open && (
                <div style={{ maxHeight: 220, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                    {release.body || '—'}
                </div>
            )}
            <a href={release.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ width: '100%', boxSizing: 'border-box', background: ACCENT, color: ACCENT_INK, borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Download size={16} />{t.updateNow}
                </div>
            </a>
        </div>
    );
}
