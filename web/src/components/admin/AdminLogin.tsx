import { useState } from 'react';
import { ChevronLeft, Loader, ArrowRight } from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { useShopStore } from '../../store/shopStore';
import { palette, cssVars, FONT_SANS, FONT_DISPLAY, FONT_MONO, ACCENT, ACCENT_INK, alpha } from '../../ui/theme';

interface AdminLoginProps {
    onLogin: () => void;
}

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
    const isDark = useShopStore((s) => s.isDark);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            await pb.collection('_superusers').authWithPassword(email, password);
            onLogin();
        } catch (loginError) {
            console.error('Admin login error:', loginError);
            setError('Correu o contrasenya incorrectes');
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
                <button onClick={() => { window.location.hash = ''; }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
                    <ChevronLeft size={16} strokeWidth={2.2} />Torna a l'app
                </button>
                <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '34px 32px', boxShadow: '0 24px 60px rgba(0,0,0,.18)' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 16, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 26px rgba(16,185,129,.4)', marginBottom: 20 }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT_INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                    <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--text)', margin: '0 0 6px' }}>Administració</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.5 }}>Accés restringit. Entra amb el teu compte d'administrador.</p>
                    <div style={label}>Correu</div>
                    <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@haul.app" style={{ ...input, marginBottom: 13 }} />
                    <div style={label}>Contrasenya</div>
                    <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ ...input, marginBottom: error ? 12 : 22 }} />
                    {error && <p role="alert" style={{ color: '#EF4444', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
                    <button type="submit" disabled={loading} style={{ width: '100%', cursor: 'pointer', border: 'none', background: ACCENT, color: ACCENT_INK, borderRadius: 13, padding: 15, fontFamily: 'inherit', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 12px 26px rgba(16,185,129,.3)', opacity: loading ? 0.6 : 1 }}>
                        {loading ? <Loader className="animate-spin" size={20} /> : <>Entra <ArrowRight size={18} strokeWidth={2.4} /></>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
