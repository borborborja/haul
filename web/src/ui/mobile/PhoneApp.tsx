import { useState } from 'react';
import {
    Search, Plus, Settings, Trash2, X, Check, ChevronDown,
    List, AlignJustify, LayoutGrid, Clock,
} from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel, localized } from '../shared/model';
import { useAutoClean } from '../shared/useAutoClean';
import ProgressRing from '../shared/ProgressRing';
import {
    ACCENT, ACCENT_INK, AMBER, DANGER, FONT_DISPLAY, FONT_MONO, alpha, catColor,
} from '../theme';
import { guessCategory } from '../shared/guess';
import ListSheet from '../shared/ListSheet';
import SettingsScreen from './SettingsScreen';

const monoLabel = { fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--muted)' };

export default function PhoneApp(_props: { openSettings: () => void }) {
    const m = useHaulModel();
    const {
        appMode, viewMode, listName, sync, isDark,
        setAppMode, setViewMode, addItem, toggleCheck,
        removeFromList, addBackToList, clearCompleted,
    } = useShopStore();

    const [screen, setScreen] = useState<'app' | 'settings'>('app');
    const [draft, setDraft] = useState('');
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [activeBand, setActiveBand] = useState<string>(m.bands[0]?.key || 'fruit');
    const [showSheet, setShowSheet] = useState(false);

    const t = m.t;
    const isPlan = appMode === 'planning';
    const grid = viewMode === 'grid';
    const compact = viewMode === 'compact';
    const rowMode = !grid;

    const submit = () => {
        const name = draft.trim();
        if (!name) return;
        addItem(name.charAt(0).toUpperCase() + name.slice(1), guessCategory(name, m.categories));
        setDraft('');
    };
    const toggleCatalog = (name: string, catKey: string) => {
        const existing = useShopStore.getState().items.find((i) => i.name.toLowerCase() === name.toLowerCase());
        if (existing && existing.inList !== false) removeFromList(existing.id);
        else addItem(name, catKey);
    };

    // catalog search suggestions across the whole catalog
    const q = draft.trim().toLowerCase();
    const showSuggestions = q.length >= 2;
    const inListNames = new Set(m.pending.concat(m.completed).map((i) => i.name.toLowerCase()));
    const suggestions = showSuggestions
        ? Object.keys(m.categories).flatMap((key) =>
            (m.categories[key].items || [])
                .map((it) => localized(it, m.lang))
                .filter((name) => name.toLowerCase().includes(q))
                .map((name) => ({ name, key, color: catColor(key, m.categories[key].color), cat: m.t.cats[key as keyof typeof m.t.cats] || key, inList: inListNames.has(name.toLowerCase()) })),
        ).slice(0, 8)
        : [];

    if (screen === 'settings') {
        return (
            <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
                <SettingsScreen onClose={() => setScreen('app')} />
            </div>
        );
    }

    const ViewSelector = (
        <div style={{ display: 'flex', background: 'var(--seg)', borderRadius: 11, padding: 3, gap: 3 }}>
            {([['list', List], ['compact', AlignJustify], ['grid', LayoutGrid]] as const).map(([v, Icon]) => {
                const on = viewMode === v;
                return (
                    <button key={v} onClick={() => setViewMode(v)} aria-label={v}
                        style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 9px', display: 'flex', background: on ? 'var(--surface)' : 'transparent', boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>
                        <Icon size={15} color={on ? ACCENT : 'var(--muted)'} strokeWidth={2.2} />
                    </button>
                );
            })}
        </div>
    );

    return (
        <div style={{ fontFamily: 'var(--font-sans)', minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', color: 'var(--text)' }}>
            {/* Header */}
            <div style={{ padding: 'calc(env(safe-area-inset-top) + 10px) 22px 12px', flex: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <button onClick={() => setShowSheet(true)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 23, letterSpacing: '-.02em', color: 'var(--text)', margin: 0 }}>{listName || t.myList}</h1>
                        <ChevronDown size={18} color="var(--muted)" strokeWidth={2.4} />
                        {sync.connected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'pulseDot 1.8s ease-in-out infinite' }} />}
                    </button>
                    <button onClick={() => setScreen('settings')} aria-label={t.settings} style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Settings size={19} color="var(--muted)" strokeWidth={2} />
                    </button>
                </div>
                {/* Plan/Shop + catalog FAB */}
                <div style={{ display: 'flex', gap: 9, alignItems: 'stretch' }}>
                    <div style={{ flex: 1, display: 'flex', background: 'var(--seg)', borderRadius: 15, padding: 5, gap: 5 }}>
                        {([['planning', t.plan], ['shopping', t.shop]] as const).map(([mode, label]) => {
                            const on = appMode === mode;
                            return (
                                <button key={mode} onClick={() => setAppMode(mode)}
                                    style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 11, padding: 11, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', background: on ? ACCENT : 'transparent', color: on ? (isDark ? ACCENT_INK : '#fff') : 'var(--muted)', boxShadow: on ? '0 5px 14px rgba(16,185,129,.3)' : 'none' }}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {isPlan && (
                        <button onClick={() => { setCatalogOpen((o) => !o); if (catalogOpen) setDraft(''); }} aria-label={t.addProducts}
                            style={{ flex: 'none', width: 52, borderRadius: 14, background: catalogOpen ? '#0B7A5B' : ACCENT, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 14px rgba(16,185,129,.32)', transition: 'background .2s' }}>
                            {catalogOpen ? <X size={22} color="#fff" strokeWidth={2.6} /> : <Plus size={22} color="#fff" strokeWidth={2.6} />}
                        </button>
                    )}
                </div>
            </div>

            {isPlan ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* catalog deploy panel */}
                    {catalogOpen && (
                        <div style={{ padding: '0 22px 12px', flex: 'none', borderBottom: '1px solid var(--line)', animation: 'slideUp .2s ease' }}>
                            {/* search */}
                            <div style={{ position: 'relative', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1.5px solid ${ACCENT}`, borderRadius: 14, height: 48, padding: '0 14px', gap: 9, boxShadow: '0 0 0 3px rgba(16,185,129,.10)' }}>
                                    <Search size={17} color={ACCENT} strokeWidth={2} style={{ flex: 'none' }} />
                                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={t.searchProduct}
                                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: 'var(--text)', minWidth: 0 }} />
                                    {showSuggestions && (
                                        <button onClick={submit} style={{ flex: 'none', border: 'none', background: ACCENT, borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                            <Plus size={14} color={ACCENT_INK} strokeWidth={2.8} />
                                        </button>
                                    )}
                                </div>
                                {showSuggestions && (
                                    <div style={{ position: 'absolute', top: 54, left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 13, boxShadow: '0 12px 30px rgba(0,0,0,.22)', zIndex: 20, overflow: 'hidden' }}>
                                        {suggestions.map((s) => (
                                            <button key={s.name} onClick={() => { toggleCatalog(s.name, s.key); setDraft(''); }} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flex: 'none' }} />
                                                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                                                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: 'var(--muted)' }}>{s.cat}</span>
                                                {s.inList && <Check size={13} color={ACCENT} strokeWidth={2.8} />}
                                            </button>
                                        ))}
                                        <button onClick={submit} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', borderTop: '1px solid var(--line)', background: 'transparent', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
                                            <Plus size={13} color="var(--muted)" strokeWidth={2.2} />
                                            <span style={{ fontSize: 13, color: 'var(--muted)' }} dangerouslySetInnerHTML={{ __html: t.addNamed.replace('{x}', `<strong style="color:var(--text)">${draft.replace(/[<>&]/g, '')}</strong>`) }} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* categories box */}
                            <div style={{ background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 9px', marginBottom: 11 }}>
                                <div style={{ ...monoLabel, fontSize: 9, letterSpacing: '.14em', marginBottom: 7 }}>{t.chooseCategory}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {m.bands.map((b) => {
                                        const on = activeBand === b.key;
                                        return (
                                            <button key={b.key} onClick={() => setActiveBand(b.key)}
                                                style={{ flex: 'none', border: on ? 'none' : '1px solid var(--line)', cursor: 'pointer', borderRadius: 999, padding: '5px 10px', fontWeight: 700, fontSize: 11.5, fontFamily: 'inherit', background: on ? b.color : 'transparent', color: on ? ACCENT_INK : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <span style={{ fontSize: 12 }}>{b.emoji}</span>{b.label}
                                            </button>
                                        );
                                    })}
                                    <button onClick={() => setScreen('settings')} style={{ flex: 'none', border: '1px dashed var(--muted)', cursor: 'pointer', borderRadius: 999, padding: '5px 9px', fontWeight: 700, fontSize: 11.5, fontFamily: 'inherit', background: 'transparent', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Plus size={12} strokeWidth={2.6} />{t.manage}
                                    </button>
                                </div>
                            </div>
                            {/* products for active category */}
                            <div style={{ ...monoLabel, fontSize: 9, letterSpacing: '.14em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12 }}>{m.categories[activeBand]?.icon || '🛒'}</span>{m.t.cats[activeBand as keyof typeof m.t.cats] || activeBand}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {m.bandItems(activeBand).map((ci) => {
                                    const color = catColor(activeBand, m.categories[activeBand]?.color);
                                    return (
                                        <button key={ci.name} onClick={() => toggleCatalog(ci.name, activeBand)}
                                            style={{ flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5, padding: '7px 12px', borderRadius: 10, border: ci.inList ? 'none' : `1.5px solid ${alpha(color, 0.5)}`, background: ci.inList ? color : 'transparent', color: ci.inList ? ACCENT_INK : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            {ci.inList && <Check size={12} color={ACCENT_INK} strokeWidth={3} />}{ci.name}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setScreen('settings')} style={{ flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, padding: '7px 12px', borderRadius: 10, border: '1px dashed var(--muted)', background: 'transparent', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Plus size={13} strokeWidth={2.6} />{t.newItem}
                                </button>
                            </div>
                        </div>
                    )}
                    {/* view selector */}
                    <div style={{ padding: '12px 22px 12px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={monoLabel}>{t.view}</span>
                        {ViewSelector}
                    </div>
                    {/* grouped list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px' }}>
                        {m.groups.map((g) => (
                            <div key={g.key} style={{ marginBottom: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <span style={{ fontSize: 16 }}>{g.emoji}</span>
                                    <span style={monoLabel}>{g.label}</span>
                                    <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--muted)' }}>{g.count}</span>
                                </div>
                                {rowMode ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                        {g.items.map((it) => (
                                            <div key={it.id} style={{ background: 'var(--surface)', borderRadius: compact ? 13 : 17, padding: compact ? '10px 13px' : '14px 16px', display: 'flex', alignItems: 'center', gap: 13, position: 'relative', overflow: 'hidden', border: '1px solid var(--line)', boxShadow: '0 3px 10px rgba(10,21,18,.04)' }}>
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: g.color }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: compact ? 14 : 15.5, color: 'var(--text)' }}>{it.name}</div>
                                                    {!compact && it.note && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{it.note}</div>}
                                                </div>
                                                <button onClick={() => removeFromList(it.id)} aria-label="remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, display: 'flex' }}>
                                                    <Trash2 size={17} color="var(--muted)" strokeWidth={2} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                                        {g.items.map((it) => (
                                            <div key={it.id} style={{ background: 'var(--surface)', borderRadius: 16, padding: 14, position: 'relative', overflow: 'hidden', border: '1px solid var(--line)', height: 108, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: g.color }} />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => removeFromList(it.id)} aria-label="remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex' }}>
                                                        <X size={15} color="var(--muted)" strokeWidth={2} />
                                                    </button>
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)' }}>{it.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {m.recent.length > 0 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}>
                                    <span style={monoLabel}>{t.previouslyUsed}</span>
                                    <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {m.recent.map((r) => (
                                        <button key={r.id} onClick={() => addBackToList(r.id)}
                                            style={{ border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 12, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--muted)' }}>{r.name}</span>
                                            <Plus size={13} color={ACCENT} strokeWidth={2.6} />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <ShopMode m={m} grid={grid} ViewSelector={ViewSelector} onToggle={toggleCheck} onClear={clearCompleted} />
            )}

            {showSheet && <ListSheet onClose={() => setShowSheet(false)} />}
        </div>
    );
}

function ShopMode({ m, grid, ViewSelector, onToggle, onClear }: any) {
    const ac = useAutoClean();
    const t = m.t;
    const remain = m.total - m.done;
    const allDone = m.total > 0 && m.done === m.total;
    const hasCompleted = m.done > 0 && m.done < m.total;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '0 22px 16px', flex: 'none' }}>
                <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 18, border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(10,21,18,.05)' }}>
                    <ProgressRing size={84} stroke={9} frac={m.frac} track="var(--seg)">
                        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{Math.round(m.frac * 100)}%</span>
                    </ProgressRing>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1 }}>
                            {m.done}<span style={{ color: 'var(--muted)', fontSize: 20 }}> / {m.total}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{remain > 0 ? t.leftN.replace('{n}', String(remain)) : t.allClear}</div>
                    </div>
                </div>
            </div>
            <div style={{ padding: '0 22px 12px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                {ac.active ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: alpha(AMBER, 0.14), padding: '8px 11px', borderRadius: 10 }}>
                        <Clock size={14} color={AMBER} strokeWidth={2.2} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#C99700', fontFamily: 'inherit' }}>{t.autoclean} · {ac.label}</span>
                    </div>
                ) : (
                    <span style={monoLabel}>{t.view}</span>
                )}
                {ViewSelector}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px' }}>
                {grid ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                        {m.pending.map((it: any) => (
                            <button key={it.id} onClick={() => onToggle(it.id)} style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', borderRadius: 18, padding: 15, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden', height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: catColor(it.category, m.categories[it.category]?.color) }} />
                                <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2.4px solid var(--muted)' }} />
                                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{it.name}</div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                        {m.pending.map((it: any) => (
                            <button key={it.id} onClick={() => onToggle(it.id)} style={{ textAlign: 'left', background: 'var(--surface)', borderRadius: 17, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden', border: '1px solid var(--line)', cursor: 'pointer' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: catColor(it.category, m.categories[it.category]?.color) }} />
                                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.4px solid var(--muted)', flex: 'none' }} />
                                <div style={{ flex: 1, fontWeight: 600, fontSize: 15.5, color: 'var(--text)' }}>{it.name}</div>
                            </button>
                        ))}
                    </div>
                )}
                {hasCompleted && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
                            <span style={monoLabel}>{t.completed}</span>
                            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 7 }}>{m.done}</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                            <button onClick={onClear} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: DANGER, fontFamily: 'inherit' }}>{t.clear}</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {m.completed.map((it: any) => (
                                <button key={it.id} onClick={() => onToggle(it.id)} style={{ textAlign: 'left', background: 'var(--surface2)', borderRadius: 18, padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.62, cursor: 'pointer', border: 'none' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 4px rgba(16,185,129,.16)' }}>
                                        <Check size={15} color={ACCENT_INK} strokeWidth={3.4} />
                                    </div>
                                    <div style={{ flex: 1, fontWeight: 600, fontSize: 16, color: 'var(--muted)', textDecoration: 'line-through' }}>{it.name}</div>
                                </button>
                            ))}
                        </div>
                    </>
                )}
                {allDone && (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: 46, marginBottom: 10 }}>🎉</div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-.02em' }}>{t.allDoneTitle}</div>
                        <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>{t.allDoneSub}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
