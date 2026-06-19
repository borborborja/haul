import { useState } from 'react';
import { Search, Plus, Trash2, Check, Sun, Moon, Settings, RotateCcw } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel } from '../shared/model';
import ProgressRing from '../shared/ProgressRing';
import { guessCategory } from '../shared/guess';
import {
    ACCENT, ACCENT_INK, DANGER, FONT_DISPLAY, FONT_MONO, alpha, catColor,
} from '../theme';

export default function DesktopApp({ openSettings }: { openSettings: () => void }) {
    const m = useHaulModel();
    const {
        appMode, listName, sync, isDark, auth, autoClearEnabled,
        setAppMode, addItem, removeFromList, toggleCheck, clearCompleted,
        switchList, createList, setTheme, setAutoClearEnabled,
    } = useShopStore();
    const [draft, setDraft] = useState('');
    const t = m.t;
    const isPlan = appMode === 'planning';

    const submit = () => {
        const name = draft.trim();
        if (!name) return;
        addItem(name.charAt(0).toUpperCase() + name.slice(1), guessCategory(name, m.categories));
        setDraft('');
    };
    const newList = () => {
        const name = window.prompt(t.enterListName);
        if (name === null) return;
        createList(name.trim() || null, '🛒');
    };

    const themeBtn = (mode: 'light' | 'dark', Icon: any, label: string) => {
        const on = mode === 'light' ? !isDark : isDark;
        return (
            <button onClick={() => setTheme(mode)}
                style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 8, padding: 8, fontWeight: 700, fontSize: 12, fontFamily: 'inherit', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon size={13} strokeWidth={2.2} />{label}
            </button>
        );
    };

    return (
        <div style={{ fontFamily: 'var(--font-sans)', width: '100vw', height: '100dvh', display: 'flex', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
            {/* SIDEBAR */}
            <div style={{ width: 280, flex: 'none', background: 'var(--sidebar)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '24px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 28, paddingLeft: 4 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT_INK} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c0-5 0-9 4-12" /><path d="M12 13c-4 0-7-2.5-7-6 3.2-.4 6 .8 7 4" /></svg>
                    </div>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: 'var(--text)' }}>Haul</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 4px 10px' }}>{t.myList}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {m.listSummaries.map((l) => (
                        <button key={l.id} onClick={() => switchList(l.id)}
                            style={{ textAlign: 'left', cursor: 'pointer', background: l.active ? 'var(--surface)' : 'transparent', border: `1px solid ${l.active ? alpha(ACCENT, 0.3) : 'transparent'}`, borderRadius: 13, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 11, boxShadow: l.active ? '0 2px 8px rgba(10,21,18,.06)' : 'none' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{l.emoji}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: l.active ? 'var(--text)' : 'var(--muted)' }}>{l.name || t.myList}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.progress}</div>
                            </div>
                            {l.active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT }} />}
                        </button>
                    ))}
                    <button onClick={newList} style={{ textAlign: 'left', borderRadius: 13, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9, color: 'var(--muted)', fontWeight: 600, fontSize: 13.5, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <Plus size={17} color="var(--muted)" strokeWidth={2.2} />{t.createList}
                    </button>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', background: 'var(--seg)', borderRadius: 11, padding: 4, gap: 4 }}>
                        {themeBtn('light', Sun, t.themeLight)}
                        {themeBtn('dark', Moon, t.themeDark)}
                    </div>
                    <button onClick={openSettings} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT_INK, fontWeight: 700, fontSize: 13 }}>
                            {(auth.username || 'H').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{auth.username || 'Haul'}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sync.connected && sync.code ? `${t.sync} · ${sync.code}` : t.settings}</div>
                        </div>
                        <Settings size={15} color="var(--muted)" />
                    </button>
                </div>
            </div>

            {/* MAIN */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ padding: '22px 32px 18px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: '1px solid var(--line)', flex: 'none' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--text)', margin: 0 }}>{listName || t.myList}</h1>
                        {sync.connected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'pulseDot 1.8s ease-in-out infinite' }} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1.5px solid ${ACCENT}`, borderRadius: 14, height: 48, paddingLeft: 14, width: 360, boxShadow: '0 0 0 4px rgba(16,185,129,.10)' }}>
                        <Search size={18} color="var(--muted)" strokeWidth={2} />
                        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={t.placeholder}
                            style={{ flex: 1, border: 'none', background: 'transparent', paddingLeft: 10, fontSize: 15, color: 'var(--text)' }} />
                        <button onClick={submit} aria-label={t.add} style={{ width: 44, height: 48, background: ACCENT, border: 'none', cursor: 'pointer', borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={20} color="#fff" strokeWidth={2.6} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', background: 'var(--seg)', borderRadius: 13, padding: 4, gap: 4 }}>
                        {([['planning', t.modePlan], ['shopping', t.modeShop]] as const).map(([mode, label]) => {
                            const on = appMode === mode;
                            return (
                                <button key={mode} onClick={() => setAppMode(mode)}
                                    style={{ border: 'none', cursor: 'pointer', borderRadius: 9, padding: '10px 18px', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: on ? ACCENT : 'transparent', color: on ? (isDark ? ACCENT_INK : '#fff') : 'var(--muted)', boxShadow: on ? '0 4px 12px rgba(16,185,129,.3)' : 'none' }}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {isPlan ? (
                    <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                        {m.groups.map((g) => (
                            <div key={g.key} style={{ flex: 1, minWidth: 210, background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(10,21,18,.05)', overflow: 'hidden' }}>
                                <div style={{ height: 4, background: g.color }} />
                                <div style={{ padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
                                    <span style={{ fontSize: 18 }}>{g.emoji}</span>
                                    <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', flex: 1 }}>{g.label}</span>
                                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '3px 8px', borderRadius: 7 }}>{g.count}</span>
                                </div>
                                <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 9 }}>
                                    {g.items.map((it) => (
                                        <div key={it.id} style={{ background: 'var(--surface2)', borderRadius: 13, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--line)' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)' }}>{it.name}</div>
                                                {it.note && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{it.note}</div>}
                                            </div>
                                            <button onClick={() => removeFromList(it.id)} aria-label="remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex' }}>
                                                <Trash2 size={15} color="var(--muted)" strokeWidth={2} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {/* recently used column */}
                        <div style={{ flex: 'none', width: 240, background: 'var(--surface)', borderRadius: 18, border: '1px dashed var(--line)', overflow: 'hidden' }}>
                            <div style={{ padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)' }}>
                                <RotateCcw size={16} color="var(--muted)" strokeWidth={2.2} />
                                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--muted)', flex: 1 }}>{t.previouslyUsed}</span>
                            </div>
                            <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {m.recent.map((r) => (
                                    <button key={r.id} onClick={() => useShopStore.getState().addBackToList(r.id)} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: 'var(--muted)' }}>{r.name}</span>
                                        <Plus size={14} color={ACCENT} strokeWidth={2.6} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                        {/* progress rail */}
                        <div style={{ width: 320, flex: 'none', padding: '32px 28px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)' }}>
                            <div style={{ margin: '0 auto 24px' }}>
                                <ProgressRing size={180} stroke={15} frac={m.frac} track="var(--seg)">
                                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 48, color: 'var(--text)', lineHeight: 1 }}>{Math.round(m.frac * 100)}%</span>
                                    <span style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{m.done} / {m.total}</span>
                                </ProgressRing>
                            </div>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 18px', textAlign: 'center', marginBottom: 14 }}>
                                <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>{m.total - m.done > 0 ? 'Queden' : 'Tot llest'}</div>
                                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: ACCENT, marginTop: 2 }}>{m.total - m.done > 0 ? `${m.total - m.done} productes` : '🎉'}</div>
                            </div>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{t.autoCleanup}</span>
                                    <button onClick={() => setAutoClearEnabled(!autoClearEnabled)} aria-label={t.autoCleanup} style={{ border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }}>
                                        <div style={{ width: 44, height: 26, borderRadius: 999, background: autoClearEnabled ? ACCENT : 'var(--seg)', position: 'relative', transition: 'background .2s' }}>
                                            <div style={{ position: 'absolute', top: 3, left: autoClearEnabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                                        </div>
                                    </button>
                                </div>
                            </div>
                            {m.done > 0 && (
                                <button onClick={clearCompleted} style={{ marginTop: 'auto', width: '100%', background: 'transparent', border: `1px solid ${alpha(DANGER, 0.3)}`, borderRadius: 13, padding: 12, fontWeight: 700, fontSize: 13, color: DANGER, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                    <Trash2 size={14} strokeWidth={2.2} />{t.clearComp} {t.completed.toLowerCase()}
                                </button>
                            )}
                        </div>
                        {/* items grid */}
                        <div style={{ flex: 1, padding: '30px 32px', overflow: 'auto' }}>
                            {m.total > 0 && m.done === m.total && (
                                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                                    <div style={{ fontSize: 64, marginBottom: 14 }}>🎉</div>
                                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 30, color: 'var(--text)', letterSpacing: '-.02em' }}>Compra completada!</div>
                                    <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 8 }}>Tot a la cistella. Bona feina.</div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                                {m.pending.map((it) => (
                                    <button key={it.id} onClick={() => toggleCheck(it.id)} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', borderRadius: 18, padding: 18, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden', height: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: catColor(it.category, m.categories[it.category]?.color) }} />
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.4px solid var(--muted)' }} />
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{it.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{m.groups.find((g) => g.key === it.category)?.label || it.category}</div>
                                        </div>
                                    </button>
                                ))}
                                {m.completed.map((it) => (
                                    <button key={it.id} onClick={() => toggleCheck(it.id)} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface2)', borderRadius: 18, padding: 18, position: 'relative', overflow: 'hidden', height: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: 0.58, border: 'none' }}>
                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Check size={15} color="#fff" strokeWidth={3.4} />
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--muted)', textDecoration: 'line-through' }}>{it.name}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
