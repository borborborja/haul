import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';

const ShoppingView = () => {
    const { items, lang } = useShopStore();
    const t = translations[lang];

    // Only count items actually in the shopping list (inList !== false).
    const active = items.filter(i => i.inList !== false);
    const total = active.length;
    const count = active.filter(i => i.checked).length;
    const percent = total === 0 ? 0 : Math.round((count / total) * 100);
    const remaining = total - count;

    // Ring geometry
    const r = 38;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - percent / 100);

    return (
        <div className="mb-6 animate-fade-in">
            <div className="relative overflow-hidden rounded-[22px] p-5 flex items-center gap-5 bg-gradient-to-br from-[#13352A] to-[#10271F] border border-mint/20 shadow-sm">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,.3),transparent_70%)] pointer-events-none"></div>

                <div className="relative w-[88px] h-[88px] shrink-0">
                    <svg width="88" height="88" viewBox="0 0 88 88">
                        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="9" />
                        <circle cx="44" cy="44" r={r} fill="none" stroke="#10B981" strokeWidth="9" strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 44 44)"
                            style={{ transition: 'stroke-dashoffset .5s ease-out' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display font-extrabold text-2xl text-cream leading-none">{percent}%</span>
                    </div>
                </div>

                <div className="relative flex-1 min-w-0">
                    <div className="font-display font-extrabold text-3xl text-cream tracking-tight leading-none">
                        {count}<span className="text-creamFaint text-xl"> / {total}</span>
                    </div>
                    <div className="text-[13px] text-creamMute mt-1.5">
                        {remaining > 0
                            ? <>{(t as any).almostThere || 'Queden'} <strong className="text-mint">{remaining} {(t as any).products || 'productes'}</strong>.</>
                            : <span className="text-mint font-semibold">{(t as any).allDone || 'Tot a punt!'} 🎉</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShoppingView;
