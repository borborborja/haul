import { useState } from 'react';
import {
    Search, Plus, Settings, Trash2, X, Check, ChevronDown,
    List, AlignJustify, LayoutGrid,
} from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel } from '../shared/model';
import ProgressRing from '../shared/ProgressRing';
import {
    ACCENT, ACCENT_INK, AMBER, DANGER, FONT_DISPLAY, FONT_MONO, alpha, catColor,
} from '../theme';
import { guessCategory } from '../shared/guess';
import ListSheet from '../shared/ListSheet';

const seg = {
    label: { fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: 'var(--muted)' },
};

export default function PhoneApp({ openSettings }: { openSettings: () => void }) {
    const m = useHaulModel();
    const {
        appMode, viewMode, listName, sync, isDark,
        setAppMode, setViewMode, addItem, toggleCheck,
        removeFromList, addBackToList, clearCompleted,
    } = useShopStore();

    const [draft, setDraft] = useState('');
    const [activeBand, setActiveBand] = useState<string | null>(null);
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
            <div style={{ padding: '14px 22px 12px', flex: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <button onClick={() => setShowSheet(true)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 23, letterSpacing: '-.02em', color: 'var(--text)', margin: 0 }}>{listName || t.myList}</h1>
                        <ChevronDown size={18} color="var(--muted)" strokeWidth={2.4} />
                        {sync.connected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, animation: 'pulseDot 1.8s ease-in-out infinite' }} />}
                    </button>
                    <button onClick={openSettings} aria-label={t.settings} style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Settings size={19} color="var(--muted)" strokeWidth={2} />
                    </button>
                </div>
                {/* Plan/Shop */}
                <div style={{ display: 'flex', background: 'var(--seg)', borderRadius: 15, padding: 5, gap: 5 }}>
                    {([['planning', t.modePlan], ['shopping', t.modeShop]] as const).map(([mode, label]) => {
                        const on = appMode === mode;
                        return (
                            <button key={mode} onClick={() => setAppMode(mode)}
                                style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 11, padding: 11, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', background: on ? ACCENT : 'transparent', color: on ? (isDark ? ACCENT_INK : '#fff') : 'var(--muted)', boxShadow: on ? '0 5px 14px rgba(16,185,129,.3)' : 'none' }}>
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {isPlan ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* add bar */}
                    <div style={{ padding: '0 22px 14px', flex: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', borderRadius: 15, height: 52, paddingLeft: 15, overflow: 'hidden', border: '1px solid var(--line)' }}>
                            <Search size={18} color="var(--muted)" strokeWidth={2} />
                            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
                                placeholder={t.placeholder}
                                style={{ flex: 1, border: 'none', background: 'transparent', paddingLeft: 11, fontSize: 15, color: 'var(--text)' }} />
                            <button onClick={submit} aria-label={t.add} style={{ width: 46, height: 52, background: ACCENT, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={20} color={ACCENT_INK} strokeWidth={2.6} />
                            </button>
                        </div>
                    </div>
                    {/* catalog category chips */}
                    <div style={{ padding: '0 22px 10px', flex: 'none', overflowX: 'auto' }} className="no-scrollbar">
                        <div style={{ display: 'flex', gap: 8, width: 'max-content', paddingRight: 4 }}>
                            {m.bands.map((b) => {
                                const on = activeBand === b.key;
                                return (
                                    <button key={b.key} onClick={() => setActiveBand(on ? null : b.key)}
                                        style={{ flex: 'none', border: on ? 'none' : '1px solid var(--line)', cursor: 'pointer', borderRadius: 12, padding: '9px 13px', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: on ? b.color : 'var(--surface2)', color: on ? ACCENT_INK : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                        <span style={{ fontSize: 14 }}>{b.emoji}</span>{b.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {/* catalog product chips */}
                    {activeBand && (
                        <div style={{ padding: '0 22px 14px', flex: 'none', borderBottom: '1px solid var(--line)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {m.bandItems(activeBand).map((ci) => {
                                    const color = catColor(activeBand, m.categories[activeBand]?.color);
                                    return (
                                        <button key={ci.name} onClick={() => toggleCatalog(ci.name, activeBand)}
                                            style={{ flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, padding: '9px 14px', borderRadius: 12, border: ci.inList ? 'none' : `1.5px solid ${alpha(color, 0.5)}`, background: ci.inList ? color : 'transparent', color: ci.inList ? ACCENT_INK : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {ci.inList && <Check size={13} color={ACCENT_INK} strokeWidth={3} />}{ci.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {/* view selector */}
                    <div style={{ padding: '12px 22px 12px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={seg.label}>Vista</span>
                        {ViewSelector}
                    </div>
                    {/* grouped list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px' }}>
                        {m.groups.map((g) => (
                            <div key={g.key} style={{ marginBottom: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <span style={{ fontSize: 16 }}>{g.emoji}</span>
                                    <span style={seg.label}>{g.label}</span>
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
                        {/* recently used */}
                        {m.recent.length > 0 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px' }}>
                                    <span style={seg.label}>{t.previouslyUsed}</span>
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
                <ShopMode
                    m={m} viewMode={viewMode} grid={grid} ViewSelector={ViewSelector}
                    onToggle={toggleCheck} onClear={clearCompleted}
                />
            )}

            {showSheet && <ListSheet onClose={() => setShowSheet(false)} />}
        </div>
    );
}

function ShopMode({ m, grid, ViewSelector, onToggle, onClear }: any) {
    const autoclean = useShopStore((s) => s.autoClearEnabled);
    const t = m.t;
    const pctLabel = Math.round(m.frac * 100) + '%';
    const remain = m.total - m.done;
    const allDone = m.total > 0 && m.done === m.total;
    const hasCompleted = m.done > 0 && m.done < m.total;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* progress hero */}
            <div style={{ padding: '0 22px 16px', flex: 'none' }}>
                <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 18, border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(10,21,18,.05)' }}>
                    <ProgressRing size={84} stroke={9} frac={m.frac} track="var(--seg)">
                        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{pctLabel}</span>
                    </ProgressRing>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: 'var(--text)', letterSpacing: '-.02em', lineHeight: 1 }}>
                            {m.done}<span style={{ color: 'var(--muted)', fontSize: 20 }}> / {m.total}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{remain > 0 ? `${t.previouslyUsed ? '' : ''}Queden ${remain} productes.` : 'Tot llest!'}</div>
                    </div>
                </div>
            </div>
            {/* autoclean + view selector */}
            <div style={{ padding: '0 22px 12px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                {autoclean && m.done > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: alpha(AMBER, 0.14), padding: '8px 11px', borderRadius: 10 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#C99700', fontFamily: 'inherit' }}>{t.autoCleanup}</span>
                    </div>
                ) : (
                    <span style={seg.label}>Vista</span>
                )}
                {ViewSelector}
            </div>
            {/* items */}
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
                            <span style={seg.label}>{t.completed}</span>
                            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 7 }}>{m.done}</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                            <button onClick={onClear} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: DANGER, fontFamily: 'inherit' }}>{t.clearComp}</button>
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
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-.02em' }}>Compra completada!</div>
                        <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>Tot a la cistella. Bona feina.</div>
                    </div>
                )}
            </div>
        </div>
    );
}
