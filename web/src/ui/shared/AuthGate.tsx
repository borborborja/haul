import { useState } from 'react';
import { Loader, ArrowRight } from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';
import { tt } from '../../data/i18n';
import { palette, cssVars, FONT_SANS, FONT_DISPLAY, FONT_MONO, ACCENT, ACCENT_INK, alpha } from '../theme';

// Login/register wall shown when the instance requires an account (require_account).
// Register is hidden when registration is closed. On success the auth store
// updates and App.tsx renders the app.
export default function AuthGate({ registrationOpen }: { registrationOpen: boolean }) {
    const isDark = useShopStore((s) => s.isDark);
    const lang = useShopStore((s) => s.lang);
    const t = tt(lang);
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const mail = email.trim().toLowerCase();
        try {
            if (mode === 'register') {
                await pb.collection('users').create({ email: mail, password, passwordConfirm: password, account_type: 'account', display_name: mail.split('@')[0] });
            }
            await pb.collection('users').authWithPassword(mail, password);
            const rec = pb.authStore.record;
            useShopStore.getState().setAuth({ isLoggedIn: true, email: rec?.email ?? null, userId: rec?.id ?? null, username: (rec as any)?.display_name ?? null });
        } catch (err: any) {
            setError(err?.response?.message || t.authError);
        } finally {
            setLoading(false);
        }
    };

    const label: React.CSSProperties = { fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 };
    const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 12, padding: '13px 14px', fontSize: 14.5, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' };

    return (
        <div style={{ ...cssVars(palette(isDark)), fontFamily: FONT_SANS, position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', right: -120, top: -120, width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(ACCENT, 0.18)}, transparent 70%)` }} />
            <div style={{ position: 'relative', width: 400, maxWidth: '90%' }}>
                <form onSubmit={submit} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '34px 32px', boxShadow: '0 24px 60px rgba(0,0,0,.18)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 17, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 26px rgba(16,185,129,.4)', marginBottom: 18 }}>
                        <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke={ACCENT_INK} strokeWidth="3" strokeLinecap="round"><circle cx="24" cy="21" r="9" /><path d="M24 30v9" /><path d="M19 12c0-3 2-6 5-6s5 3 5 6" /></svg>
                    </div>
                    <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--text)', margin: '0 0 4px' }}>Haul</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 24px' }}>{t.accountRequired}</p>
                    <div style={label}>{t.email}</div>
                    <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, marginBottom: 13 }} />
                    <div style={label}>{t.password}</div>
                    <input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...input, marginBottom: error ? 12 : 22 }} />
                    {error && <p role="alert" style={{ color: '#EF4444', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
                    <button type="submit" disabled={loading} style={{ width: '100%', cursor: 'pointer', border: 'none', background: ACCENT, color: ACCENT_INK, borderRadius: 13, padding: 15, fontFamily: 'inherit', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 12px 26px rgba(16,185,129,.3)', opacity: loading ? 0.6 : 1 }}>
                        {loading ? <Loader className="animate-spin" size={20} /> : <>{mode === 'login' ? t.login : t.createAccount} <ArrowRight size={18} strokeWidth={2.4} /></>}
                    </button>
                    {registrationOpen && (
                        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} style={{ width: '100%', marginTop: 14, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 13 }}>
                            {mode === 'login' ? t.createAccount : t.login}
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
