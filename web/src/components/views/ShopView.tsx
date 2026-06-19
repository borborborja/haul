import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';
import { triggerHaptic } from '../../utils/haptics';
import { Check, Trash2 } from 'lucide-react';

// Immersive shopping screen (frame 02). Theme-aware: follows the app theme
// (all light or all dark), not a fixed dark art-direction.
const CAT_HEX: Record<string, string> = {
    fruit: '#EF4444', veg: '#22C55E', meat: '#B45309', dairy: '#60A5FA', pantry: '#FB923C',
    cleaning: '#C084FC', home: '#64748B', snacks: '#F472B6', frozen: '#06B6D4',
    processed: '#FB7185', drinks: '#6366F1', spices: '#F59E0B', other: '#94A3B8',
};

const ShopView = () => {
    const { items, categories, lang, toggleCheck, clearCompleted, autoClearEnabled, setAutoClearEnabled, isDark } = useShopStore();
    const t = translations[lang];

    const active = items.filter(i => i.inList !== false);
    const total = active.length;
    const done = active.filter(i => i.checked).length;
    const remaining = total - done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const r = 86, circ = 2 * Math.PI * r;
    const offset = circ * (1 - percent / 100);

    const unchecked = active.filter(i => !i.checked).sort((a, b) => a.name.localeCompare(b.name));
    const checked = active.filter(i => i.checked).sort((a, b) => a.name.localeCompare(b.name));
    const ordered = [...unchecked, ...checked];

    const catName = (k: string) => t.cats[k as keyof typeof t.cats] || k;
    const hexFor = (k: string) => CAT_HEX[k] || CAT_HEX.other;
    const emojiFor = (k: string) => categories[k]?.icon || '📦';

    return (
        <div className="flex-1 bg-card2 dark:bg-darkBg flex flex-col lg:flex-row min-h-0">
            {/* Left rail */}
            <div className="lg:w-[330px] flex-none px-7 sm:px-[30px] py-8 flex flex-col border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2.5 mb-7">
                    <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink dark:text-cream">{(t as any).shoppingNow || 'Comprant ara'}</h1>
                    <span className="w-2 h-2 rounded-full bg-mint animate-pulse"></span>
                </div>

                <div className="relative w-[200px] h-[200px] mx-auto mb-7">
                    <svg width="200" height="200" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r={r} fill="none" className="stroke-black/[0.06] dark:stroke-white/[0.07]" strokeWidth="16" />
                        <circle cx="100" cy="100" r={r} fill="none" stroke="#10B981" strokeWidth="16" strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 100 100)"
                            style={{ transition: 'stroke-dashoffset .5s ease-out' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display font-extrabold text-[54px] text-ink dark:text-cream leading-none">{percent}<span className="text-[28px]">%</span></span>
                        <span className="text-[13px] text-inkFaint dark:text-creamFaint mt-1">{done} {(t as any).ofWord || 'de'} {total}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-darkSurface border border-mint/20 rounded-2xl px-[18px] py-4 text-center mb-3.5 shadow-sm">
                    <div className="text-sm text-inkMute dark:text-creamMute">{remaining > 0 ? ((t as any).remainingLabel || 'Queden') : '✓'}</div>
                    {remaining > 0 && <div className="font-display font-extrabold text-[22px] text-mint-deep dark:text-mint mt-0.5">{remaining} {(t as any).products || 'productes'}</div>}
                </div>

                <div className="mt-auto bg-white dark:bg-darkSurface border border-black/5 dark:border-white/[0.06] rounded-2xl px-[18px] py-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3.5">
                        <span className="text-sm text-ink dark:text-cream font-semibold">{(t as any).autoCleanup || 'Autoneteja'}</span>
                        <button
                            onClick={() => { setAutoClearEnabled(!autoClearEnabled); triggerHaptic(10); }}
                            className={`w-11 h-[26px] rounded-full relative transition ${autoClearEnabled ? 'bg-mint' : 'bg-black/10 dark:bg-[#38493F]'}`}
                        >
                            <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${autoClearEnabled ? 'right-[3px]' : 'left-[3px]'}`}></span>
                        </button>
                    </div>
                    <button
                        onClick={() => { clearCompleted(); triggerHaptic(20); }}
                        className="w-full border border-red-500/30 rounded-xl py-2.5 font-bold text-[13px] text-red-500 dark:text-red-400 flex items-center justify-center gap-1.5 hover:bg-red-500/10 transition"
                    >
                        <Trash2 size={14} />{(t as any).clearCompletedBtn || 'Netejar completats'}
                    </button>
                </div>
            </div>

            {/* Items grid */}
            <div className="flex-1 px-7 sm:px-[30px] py-7 overflow-y-auto">
                <div className="flex items-center justify-between mb-[18px]">
                    <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-inkFaint dark:text-creamFaint">{(t as any).toBuy || 'Per comprar'} · {remaining}</div>
                </div>

                {total === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-50 text-inkFaint dark:text-creamFaint">
                        <div className="text-4xl mb-3">🛒</div>
                        <p className="text-sm font-bold">{t.empty}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {ordered.map(item => {
                            const k = item.category || 'other';
                            const hex = hexFor(k);
                            const tileBg = item.checked
                                ? (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)')
                                : `${hex}${isDark ? '24' : '1f'}`;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => { toggleCheck(item.id); triggerHaptic(20); }}
                                    className={`relative overflow-hidden rounded-[18px] p-[18px] h-[148px] flex flex-col justify-between text-left transition ${item.checked
                                        ? 'bg-card2 dark:bg-darkSurface2 opacity-60'
                                        : 'bg-white dark:bg-darkSurface border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md'}`}
                                >
                                    {!item.checked && <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ background: hex }}></span>}
                                    <div className="flex items-start justify-between">
                                        <span
                                            className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center text-2xl"
                                            style={{ background: tileBg, filter: item.checked ? 'grayscale(1)' : undefined }}
                                        >{emojiFor(k)}</span>
                                        {item.checked ? (
                                            <span className="w-7 h-7 rounded-full bg-mint flex items-center justify-center shadow-[0_0_0_4px_rgba(16,185,129,.16)]">
                                                <Check size={15} className="text-mint-ink" strokeWidth={3.4} />
                                            </span>
                                        ) : (
                                            <span className="w-7 h-7 rounded-full border-[2.4px] border-black/15 dark:border-[#38493F]"></span>
                                        )}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-base ${item.checked ? 'text-inkFaint dark:text-creamFaint line-through' : 'text-ink dark:text-cream'}`}>{item.name}</div>
                                        <div className="text-xs text-inkFaint dark:text-creamFaint mt-0.5">{item.note ? `${item.note} · ` : ''}{catName(k)}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopView;
