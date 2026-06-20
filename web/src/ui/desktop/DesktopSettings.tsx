import { useState } from 'react';
import { ChevronLeft, Plus, X, Share2, RefreshCw, Download, Upload, RotateCcw, Trash2 } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel, localized, catLabel } from '../shared/model';
import { useAccountSync } from '../shared/useAccountSync';
import { useSettingsExtras } from '../shared/useSettingsExtras';
import type { LocalizedItem } from '../../types';
import { ACCENT, ACCENT_INK, DANGER, FONT_DISPLAY, FONT_MONO, alpha, catColor } from '../theme';

type Tab = 'account' | 'catalog' | 'other' | 'about';
const mono = { fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--muted)' };
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 22 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, padding: '12px 14px', fontSize: 14.5, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' };

export default function DesktopSettings({ onClose }: { onClose: () => void }) {
    const m = useHaulModel();
    const t = m.t;
    const {
        lang, auth, sync, showCompletedInline, autoClearEnabled, notifyOnAdd, notifyOnCheck,
        setShowCompletedInline, setAutoClearEnabled, setNotifyOnAdd, setNotifyOnCheck,
        categories, addCategory, addCategoryItem, removeCategoryItem,
    } = useShopStore();
    const acc = useAccountSync();
    const extras = useSettingsExtras();

    const [tab, setTab] = useState<Tab>('account');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [uname, setUname] = useState(auth.username || '');
    const [serverInput, setServerInput] = useState(extras.serverUrl || '');
    const [addingCat, setAddingCat] = useState<string | null>(null);
    const [newProduct, setNewProduct] = useState('');

    const Toggle = ({ on }: { on: boolean }) => (
        <div style={{ width: 44, height: 26, borderRadius: 999, background: on ? ACCENT : 'var(--seg)', position: 'relative', flex: 'none' }}>
            <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
        </div>
    );
    const ToggleRow = ({ label, on, onClick, first }: { label: string; on: boolean; onClick: () => void; first?: boolean }) => (
        <button onClick={onClick} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: first ? '0 0 14px' : '14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: first ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontSize: 14.5, color: 'var(--text)', fontWeight: 500 }}>{label}</span><Toggle on={on} />
        </button>
    );
    const greenBtn: React.CSSProperties = { cursor: 'pointer', border: 'none', background: ACCENT, color: ACCENT_INK, borderRadius: 12, padding: '11px 16px', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5 };
    const ghostBtn: React.CSSProperties = { cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface2)', color: 'var(--text)', borderRadius: 12, padding: '11px 16px', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5 };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '22px 40px 0', borderBottom: '1px solid var(--line)', flex: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <ChevronLeft size={20} color="var(--text)" strokeWidth={2.2} />
                    </button>
                    <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, letterSpacing: '-.02em', color: 'var(--text)', margin: 0 }}>{t.settings}</h1>
                </div>
                <div style={{ display: 'flex', gap: 28 }}>
                    {([['account', t.account], ['catalog', t.catalog], ['other', t.other], ['about', t.about]] as [Tab, string][]).map(([k, label]) => {
                        const on = tab === k;
                        return <button key={k} onClick={() => setTab(k)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 12.5, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500, padding: '12px 0', borderBottom: `2px solid ${on ? ACCENT : 'transparent'}`, color: on ? 'var(--text)' : 'var(--muted)' }}>{label}</button>;
                    })}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
                {tab === 'account' && (
                    <div style={{ maxWidth: 680, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        {/* sync hero */}
                        <div style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg,#13352A,#0E1D17)', borderRadius: 18, padding: 24, color: '#EAF2EC', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: ACCENT, animation: 'pulseDot 1.8s ease-in-out infinite' }} />
                                        <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: ACCENT }}>{sync.connected ? t.connected : t.sync}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: '#A9BBB1', marginBottom: 6 }}>{t.syncCode}</div>
                                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 34, letterSpacing: '.08em', color: '#EAF2EC' }}>{sync.code || '—'}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                    {sync.connected ? <>
                                        <button onClick={extras.shareCode} style={{ ...greenBtn, display: 'flex', alignItems: 'center', gap: 7 }}><Share2 size={15} />{t.add}</button>
                                        <button onClick={extras.rotateCode} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '11px 16px', fontWeight: 600, fontSize: 13.5, color: '#EAF2EC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><RefreshCw size={15} />{t.sync}</button>
                                    </> : <>
                                        <button disabled={acc.busy} onClick={acc.createShared} style={greenBtn}>{t.createList}</button>
                                        <button disabled={acc.busy} onClick={() => { const c = window.prompt(t.syncCode); if (c) acc.join(c); }} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '11px 16px', fontWeight: 600, fontSize: 13.5, color: '#EAF2EC', cursor: 'pointer' }}>{t.join}</button>
                                    </>}
                                </div>
                            </div>
                        </div>
                        {/* account */}
                        <div style={card}>
                            {auth.isLoggedIn ? <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
                                    <div style={{ width: 46, height: 46, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT_INK, fontWeight: 700, fontSize: 18, fontFamily: FONT_DISPLAY }}>{(auth.username || 'H').charAt(0).toUpperCase()}</div>
                                    <div><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{auth.username || 'Haul'}</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{auth.email}</div></div>
                                </div>
                                <button onClick={acc.logout} style={{ width: '100%', background: 'transparent', border: `1.5px solid ${alpha(DANGER, 0.3)}`, borderRadius: 11, padding: 11, fontWeight: 600, fontSize: 13.5, color: DANGER, cursor: 'pointer' }}>{t.logout}</button>
                            </> : <>
                                <div style={{ ...mono, marginBottom: 12 }}>{t.account}</div>
                                <input placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 9 }} />
                                <input type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                                <div style={{ display: 'flex', gap: 9 }}>
                                    <button disabled={acc.busy} onClick={() => acc.claim(email, password)} style={{ ...greenBtn, flex: 1 }}>{t.createAccount}</button>
                                    <button disabled={acc.busy} onClick={() => acc.login(email, password)} style={{ ...ghostBtn, flex: 1 }}>{t.login}</button>
                                </div>
                                {acc.error && <div style={{ color: DANGER, fontSize: 12.5, marginTop: 10 }}>{acc.error}</div>}
                            </>}
                        </div>
                        {/* username */}
                        <div style={card}>
                            <div style={{ ...mono, marginBottom: 11 }}>{t.username}</div>
                            <input value={uname} onChange={(e) => setUname(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
                            <button onClick={() => acc.saveUsername(uname.trim())} style={{ ...greenBtn, width: '100%' }}>{t.save}</button>
                        </div>
                    </div>
                )}

                {tab === 'catalog' && (
                    <div style={{ maxWidth: 820 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                            <div><div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-.01em', color: 'var(--text)' }}>{t.manageCatalog}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{t.manageCatalogSub}</div></div>
                            <button onClick={() => { const name = window.prompt(t.category); if (!name) return; const key = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `cat_${Date.now()}`; addCategory(key, '📦'); }} style={{ ...greenBtn, display: 'flex', alignItems: 'center', gap: 7 }}><Plus size={14} color={ACCENT_INK} strokeWidth={2.6} />{t.category}</button>
                        </div>
                        {Object.keys(categories).map((key) => {
                            const cat = categories[key]; const color = catColor(key, cat.color);
                            return (
                                <div key={key} style={{ marginBottom: 22 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 9, background: alpha(color, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{cat.icon}</div>
                                        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, letterSpacing: '-.01em', color: 'var(--text)' }}>{catLabel(key, lang, cat.names)}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {cat.items.map((it: LocalizedItem | string, idx: number) => (
                                            <div key={idx} style={{ fontWeight: 600, fontSize: 13, padding: '8px 10px 8px 14px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 9 }}>
                                                {localized(it, lang)}
                                                <button onClick={() => removeCategoryItem(key, idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, display: 'flex', color: 'var(--muted)' }}><X size={13} strokeWidth={2.4} /></button>
                                            </div>
                                        ))}
                                        <button onClick={() => { setAddingCat(addingCat === key ? null : key); setNewProduct(''); }} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: '8px 13px', borderRadius: 11, border: `1px dashed ${color}`, background: 'transparent', color, display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={13} strokeWidth={2.6} />{t.add}</button>
                                    </div>
                                    {addingCat === key && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 9, maxWidth: 360 }}>
                                            <input value={newProduct} autoFocus onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newProduct.trim()) { addCategoryItem(key, { es: newProduct.trim(), ca: newProduct.trim(), en: newProduct.trim() }); setNewProduct(''); } }} placeholder={t.newProduct} style={{ ...inputStyle, flex: 1 }} />
                                            <button onClick={() => { if (newProduct.trim()) { addCategoryItem(key, { es: newProduct.trim(), ca: newProduct.trim(), en: newProduct.trim() }); setNewProduct(''); } }} style={greenBtn}>{t.add}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {tab === 'other' && (
                    <div style={{ maxWidth: 680, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                        <div style={card}>
                            <div style={{ ...mono, marginBottom: 14 }}>{t.viewOptions}</div>
                            <ToggleRow label={t.completedInline} on={showCompletedInline} onClick={() => setShowCompletedInline(!showCompletedInline)} first />
                            <ToggleRow label={t.autocleanItems} on={autoClearEnabled} onClick={() => setAutoClearEnabled(!autoClearEnabled)} />
                        </div>
                        <div style={card}>
                            <div style={{ ...mono, marginBottom: 14 }}>{t.alerts}</div>
                            <ToggleRow label={t.notifyNew} on={notifyOnAdd} onClick={() => setNotifyOnAdd(!notifyOnAdd)} first />
                            <ToggleRow label={t.notifyBought} on={notifyOnCheck} onClick={() => setNotifyOnCheck(!notifyOnCheck)} />
                        </div>
                        <div style={card}>
                            <div style={{ ...mono, marginBottom: 14 }}>{t.server}</div>
                            <input value={serverInput} onChange={(e) => setServerInput(e.target.value)} placeholder="https://…" style={{ ...inputStyle, marginBottom: 10 }} />
                            <button onClick={() => extras.testAndSave(serverInput)} style={{ ...greenBtn, width: '100%' }}>{t.save}{extras.status === 'ok' ? ' ✓' : extras.status === 'error' ? ' ✕' : ''}</button>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{extras.serverUrl || t.localMode}</div>
                        </div>
                        <div style={card}>
                            <div style={{ ...mono, marginBottom: 14 }}>{t.about /* Backup */}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                <button onClick={extras.exportJson} style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><Download size={15} />JSON</button>
                                <button onClick={extras.importJson} style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><Upload size={15} />JSON</button>
                                <button onClick={extras.reset} style={{ background: 'transparent', border: `1px solid ${alpha(DANGER, 0.3)}`, borderRadius: 12, padding: '11px 16px', fontWeight: 600, fontSize: 13.5, color: DANGER, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><RotateCcw size={15} />Reset</button>
                            </div>
                        </div>
                        {extras.syncHistory.length > 0 && (
                            <div style={{ ...card, gridColumn: 'span 2' }}>
                                <div style={{ ...mono, marginBottom: 14 }}>{t.sync}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {extras.syncHistory.map((h: any) => {
                                        const code = typeof h === 'string' ? h : h.code;
                                        return <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 11px' }}>
                                            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: 'var(--text)' }}>{code}</span>
                                            <button onClick={() => extras.removeFromSyncHistory(code)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--muted)' }}><Trash2 size={13} /></button>
                                        </div>;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'about' && (
                    <div style={{ maxWidth: 420, textAlign: 'center', margin: '0 auto', padding: '20px 0' }}>
                        <div style={{ width: 64, height: 64, borderRadius: 19, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 26px rgba(16,185,129,.4)', margin: '0 auto 16px' }}>
                            <svg width="34" height="34" viewBox="0 0 48 48" fill="none" stroke={ACCENT_INK} strokeWidth="3" strokeLinecap="round"><circle cx="24" cy="21" r="9" /><path d="M24 30v9" /><path d="M19 12c0-3 2-6 5-6s5 3 5 6" /></svg>
                        </div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--text)' }}>Haul</div>
                        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t.version} 1.3.0</div>
                        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted)', margin: '16px auto 18px' }}>{t.aboutTagline}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                            <a href="https://github.com/borborborja/haul" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: ACCENT }}>{t.sourceCode} ↗</span>
                            </a>
                            <button onClick={() => { window.location.hash = '#/admin'; }} style={{ border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 12, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>Administració ↗</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
