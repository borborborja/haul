import { useState } from 'react';
import { ChevronLeft, Plus, X, Download, Upload, RotateCcw } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel, localized, catLabel } from '../shared/model';
import { useAccountSync } from '../shared/useAccountSync';
import { useSettingsExtras } from '../shared/useSettingsExtras';
import type { LocalizedItem } from '../../types';
import { ACCENT, ACCENT_INK, DANGER, FONT_DISPLAY, FONT_MONO, alpha, catColor } from '../theme';

type Tab = 'account' | 'catalog' | 'other' | 'about';
const monoLabel = { fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: 'var(--muted)' };

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
    const m = useHaulModel();
    const t = m.t;
    const {
        theme, lang, setTheme, auth, sync, serverUrl,
        showCompletedInline, autoClearEnabled, notifyOnAdd, notifyOnCheck,
        setShowCompletedInline, setAutoClearEnabled, setNotifyOnAdd, setNotifyOnCheck,
        categories, addCategory, addCategoryItem, removeCategoryItem,
    } = useShopStore();
    const acc = useAccountSync();
    const extras = useSettingsExtras();

    const [serverInput, setServerInput] = useState(extras.serverUrl || '');
    const [tab, setTab] = useState<Tab>('account');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [uname, setUname] = useState(auth.username || '');
    const [addingCat, setAddingCat] = useState<string | null>(null);
    const [newProduct, setNewProduct] = useState('');

    const tabs: [Tab, string][] = [['account', t.account], ['catalog', t.catalog], ['other', t.other], ['about', t.about]];

    const Toggle = ({ on }: { on: boolean }) => (
        <div style={{ width: 44, height: 26, borderRadius: 999, background: on ? ACCENT : 'var(--seg)', position: 'relative', transition: 'background .2s', flex: 'none' }}>
            <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
        </div>
    );
    const Row = ({ label, on, onClick, last }: { label: string; on: boolean; onClick: () => void; last?: boolean }) => (
        <button onClick={onClick} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '15px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
            <span style={{ fontSize: 14.5, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
            <Toggle on={on} />
        </button>
    );
    const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 13, padding: '14px 15px', fontSize: 15, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' };
    const greenBtn: React.CSSProperties = { cursor: 'pointer', border: 'none', background: ACCENT, color: ACCENT_INK, borderRadius: 13, padding: 13, fontFamily: 'inherit', fontWeight: 700, fontSize: 14 };
    const ghostBtn: React.CSSProperties = { cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 13, padding: 13, fontFamily: 'inherit', fontWeight: 700, fontSize: 14 };

    return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'calc(env(safe-area-inset-top) + 6px) 22px 10px', display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
                <button onClick={onClose} aria-label="back" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft size={20} color="var(--text)" strokeWidth={2.2} />
                </button>
                <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--text)', margin: 0 }}>{t.settings}</h1>
            </div>
            {/* tab bar */}
            <div style={{ padding: '0 22px', display: 'flex', gap: 22, borderBottom: '1px solid var(--line)', flex: 'none' }}>
                {tabs.map(([key, label]) => {
                    const on = tab === key;
                    return (
                        <button key={key} onClick={() => setTab(key)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500, padding: '11px 0', borderBottom: `2px solid ${on ? ACCENT : 'transparent'}`, color: on ? 'var(--text)' : 'var(--muted)' }}>{label}</button>
                    );
                })}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 30px' }}>
                {/* ===== ACCOUNT ===== */}
                {tab === 'account' && (
                    <>
                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.sync}</div>
                        {sync.connected ? (
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'pulseDot 1.8s ease-in-out infinite' }} />
                                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: ACCENT }}>{t.connected}</span>
                                </div>
                                {sync.code && <>
                                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>{t.syncCode}</div>
                                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, letterSpacing: '.08em', color: 'var(--text)', marginBottom: 12 }}>{sync.code}</div>
                                </>}
                                <button onClick={acc.disconnect} style={{ ...ghostBtn, width: '100%' }}>{t.disconnect}</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 9, marginBottom: 24 }}>
                                <button disabled={acc.busy} onClick={acc.createShared} style={{ ...greenBtn, flex: 1, opacity: acc.busy ? 0.6 : 1 }}>{t.createList}</button>
                                <button disabled={acc.busy} onClick={() => { const c = window.prompt(t.syncCode); if (c) acc.join(c); }} style={{ ...ghostBtn, flex: 1 }}>{t.join}</button>
                            </div>
                        )}

                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.account}</div>
                        {auth.isLoggedIn ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <input value={auth.email || ''} readOnly style={{ ...inputStyle, flex: 1 }} />
                                <button onClick={acc.logout} style={{ ...ghostBtn, flex: 'none' }}>{t.logout}</button>
                            </div>
                        ) : (
                            <>
                                <input placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 9 }} />
                                <input type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                                <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
                                    <button disabled={acc.busy} onClick={() => acc.claim(email, password)} style={{ ...greenBtn, flex: 1, opacity: acc.busy ? 0.6 : 1 }}>{t.createAccount}</button>
                                    <button disabled={acc.busy} onClick={() => acc.login(email, password)} style={{ ...ghostBtn, flex: 1 }}>{t.login}</button>
                                </div>
                            </>
                        )}
                        {acc.error && <div style={{ color: DANGER, fontSize: 12.5, marginBottom: 12 }}>{acc.error}</div>}

                        <div style={{ ...monoLabel, margin: '12px 0 11px' }}>{t.username}</div>
                        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                            <input value={uname} onChange={(e) => setUname(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={() => acc.saveUsername(uname.trim())} style={{ ...greenBtn, flex: 'none', padding: '14px 20px' }}>{t.save}</button>
                        </div>
                    </>
                )}

                {/* ===== CATALOG ===== */}
                {tab === 'catalog' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                            <div>
                                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, letterSpacing: '-.01em', color: 'var(--text)' }}>{t.manageCatalog}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{t.manageCatalogSub}</div>
                            </div>
                            <button onClick={() => {
                                const name = window.prompt(t.category); if (!name) return;
                                const key = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `cat_${Date.now()}`;
                                addCategory(key, '📦');
                            }} style={{ ...greenBtn, flex: 'none', padding: '10px 14px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Plus size={13} color={ACCENT_INK} strokeWidth={2.6} />{t.category}
                            </button>
                        </div>
                        {Object.keys(categories).map((key) => {
                            const cat = categories[key];
                            const color = catColor(key, cat.color);
                            return (
                                <div key={key} style={{ marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 8, background: alpha(color, 0.16), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{cat.icon}</div>
                                        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, letterSpacing: '-.01em', color: 'var(--text)' }}>{catLabel(key, lang)}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                        {cat.items.map((it: LocalizedItem | string, idx: number) => (
                                            <div key={idx} style={{ flex: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '7px 9px 7px 13px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {localized(it, lang)}
                                                <button onClick={() => removeCategoryItem(key, idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, display: 'flex', color: 'var(--muted)' }}>
                                                    <X size={13} strokeWidth={2.4} />
                                                </button>
                                            </div>
                                        ))}
                                        <button onClick={() => { setAddingCat(addingCat === key ? null : key); setNewProduct(''); }} style={{ flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, padding: '7px 12px', borderRadius: 11, border: `1px dashed ${color}`, background: 'transparent', color, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Plus size={13} strokeWidth={2.6} />{t.add}
                                        </button>
                                    </div>
                                    {addingCat === key && (
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1.5px solid ${color}`, borderRadius: 12, height: 44, padding: '0 5px 0 13px', gap: 8, marginTop: 9 }}>
                                            <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newProduct.trim()) { addCategoryItem(key, { es: newProduct.trim(), ca: newProduct.trim(), en: newProduct.trim() }); setNewProduct(''); } }} placeholder={t.newProduct} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                                            <button onClick={() => { if (newProduct.trim()) { addCategoryItem(key, { es: newProduct.trim(), ca: newProduct.trim(), en: newProduct.trim() }); setNewProduct(''); } }} style={{ flex: 'none', border: 'none', background: ACCENT, borderRadius: 9, height: 34, padding: '0 13px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, color: ACCENT_INK }}>{t.add}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}

                {/* ===== OTHER ===== */}
                {tab === 'other' && (
                    <>
                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.theme}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                            <button onClick={() => setTheme('light')} style={{ textAlign: 'left', cursor: 'pointer', background: '#F6F7F3', borderRadius: 15, padding: 14, height: 74, border: `2px solid ${theme === 'light' ? ACCENT : 'transparent'}`, boxShadow: theme === 'light' ? `0 0 0 4px ${alpha(ACCENT, 0.14)}` : 'none' }}>
                                <div style={{ width: 24, height: 24, borderRadius: 8, background: ACCENT, marginBottom: 8 }} /><span style={{ fontWeight: 700, fontSize: 13, color: '#0E1B16' }}>{t.light}</span>
                            </button>
                            <button onClick={() => setTheme('dark')} style={{ textAlign: 'left', cursor: 'pointer', background: '#0E1D17', borderRadius: 15, padding: 14, height: 74, border: `2px solid ${theme === 'dark' ? ACCENT : 'transparent'}`, boxShadow: theme === 'dark' ? `0 0 0 4px ${alpha(ACCENT, 0.14)}` : 'none' }}>
                                <div style={{ width: 24, height: 24, borderRadius: 8, background: ACCENT, marginBottom: 8 }} /><span style={{ fontWeight: 700, fontSize: 13, color: '#EAF2EC' }}>{t.dark}</span>
                            </button>
                        </div>

                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.viewOptions}</div>
                        <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 24 }}>
                            <Row label={t.completedInline} on={showCompletedInline} onClick={() => setShowCompletedInline(!showCompletedInline)} />
                            <Row label={t.autocleanItems} on={autoClearEnabled} onClick={() => setAutoClearEnabled(!autoClearEnabled)} last />
                        </div>

                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.alerts}</div>
                        <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 24 }}>
                            <Row label={t.notifyNew} on={notifyOnAdd} onClick={() => setNotifyOnAdd(!notifyOnAdd)} />
                            <Row label={t.notifyBought} on={notifyOnCheck} onClick={() => setNotifyOnCheck(!notifyOnCheck)} last />
                        </div>

                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.server}</div>
                        <input value={serverInput} onChange={(e) => setServerInput(e.target.value)} placeholder={serverUrl || t.localMode} style={{ ...inputStyle, marginBottom: 9 }} />
                        <button onClick={() => extras.testAndSave(serverInput)} style={{ ...greenBtn, width: '100%', marginBottom: 24 }}>{t.save}{extras.status === 'ok' ? ' ✓' : extras.status === 'error' ? ' ✕' : ''}</button>

                        <div style={{ ...monoLabel, marginBottom: 11 }}>{t.about}</div>
                        <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
                            <button onClick={extras.exportJson} style={{ ...ghostBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Download size={15} />JSON</button>
                            <button onClick={extras.importJson} style={{ ...ghostBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Upload size={15} />JSON</button>
                        </div>
                        <button onClick={extras.reset} style={{ width: '100%', background: 'transparent', border: `1px solid ${alpha(DANGER, 0.3)}`, borderRadius: 13, padding: 12, fontWeight: 600, fontSize: 14, color: DANGER, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><RotateCcw size={15} />Reset</button>
                    </>
                )}

                {/* ===== ABOUT ===== */}
                {tab === 'about' && (
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '14px 0 24px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 19, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 26px rgba(16,185,129,.4)', marginBottom: 16 }}>
                                <svg width="34" height="34" viewBox="0 0 48 48" fill="none" stroke={ACCENT_INK} strokeWidth="3" strokeLinecap="round"><circle cx="24" cy="21" r="9" /><path d="M24 30v9" /><path d="M19 12c0-3 2-6 5-6s5 3 5 6" /></svg>
                            </div>
                            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--text)' }}>Haul</div>
                            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t.version} 1.3.0</div>
                            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted)', maxWidth: 240, margin: '16px 0 0' }}>{t.aboutTagline}</p>
                        </div>
                        <a href="https://github.com/borborborja/haul" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{t.sourceCode}</span>
                                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: ACCENT }}>GitHub ↗</span>
                            </div>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
