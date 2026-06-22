import { useRef } from 'react';
import { useShopStore } from '../../store/shopStore';
import { useAccountSync } from './useAccountSync';
import type { UIDict } from '../../data/i18n';

const PALETTE = ['#10B981', '#0EA5E9', '#6366F1', '#EC4899', '#F59E0B', '#EF4444', '#14B8A6', '#8B5CF6'];

// Account avatar: shows the current photo or a colored initial circle, and lets
// the user upload a photo or pick a color.
export default function AvatarPicker({ t }: { t: UIDict }) {
    const auth = useShopStore((s) => s.auth);
    const { saveUserAvatar, saveUserColor } = useAccountSync();
    const fileRef = useRef<HTMLInputElement>(null);

    const initial = (auth.username || auth.email || 'H').charAt(0).toUpperCase();
    const bg = auth.avatarColor || '#10B981';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div onClick={() => fileRef.current?.click()} title={t.choosePhoto} style={{ cursor: 'pointer', flexShrink: 0 }}>
                {auth.avatarUrl ? (
                    <img src={auth.avatarUrl} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, fontFamily: '"Bricolage Grotesque", sans-serif' }}>{initial}</div>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <button onClick={() => fileRef.current?.click()} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: '8px 14px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', marginBottom: 10 }}>{t.choosePhoto}</button>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {PALETTE.map((c) => (
                        <button key={c} onClick={() => saveUserColor(c)} aria-label={c} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: auth.avatarColor === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
                    ))}
                </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) saveUserAvatar(f); e.target.value = ''; }} />
        </div>
    );
}
