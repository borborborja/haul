import { useState } from 'react';
import { ChevronDown, ScrollText, ShoppingCart, Settings } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';
import { triggerHaptic } from '../../utils/haptics';
import AddItemInput from '../views/AddItemInput';
import ListSwitcherModal from '../modals/ListSwitcherModal';

interface Props {
    openSettings: () => void;
}

// The desktop topbar inside the main column: list-name selector + add bar + Plan/Shop.
const Topbar = ({ openSettings }: Props) => {
    const { appMode, setAppMode, lang, listName, sync } = useShopStore();
    const t = translations[lang];
    const [showSwitcher, setShowSwitcher] = useState(false);

    return (
        <div className="sticky top-0 z-30 glass px-5 sm:px-7 py-4 flex items-center gap-3 sm:gap-[18px] flex-wrap pt-[calc(1rem+env(safe-area-inset-top))]">
            {/* List name selector */}
            <button
                onClick={() => { setShowSwitcher(true); triggerHaptic(10); }}
                className="flex items-center gap-2 min-w-0 group order-1"
            >
                <h1 className="font-display font-extrabold text-2xl sm:text-[28px] tracking-tight text-ink dark:text-cream truncate max-w-[50vw] sm:max-w-none">
                    {listName || t.myList}
                </h1>
                <ChevronDown size={22} className="text-inkFaint dark:text-creamFaint shrink-0 group-active:translate-y-0.5 transition" />
                {sync.connected && <span className="w-2 h-2 rounded-full bg-mint shrink-0 animate-pulse"></span>}
            </button>

            {/* spacer pushes the rest right on desktop */}
            <div className="hidden sm:block flex-1 order-2"></div>

            {/* Add bar */}
            <div className="order-3 w-full sm:w-[340px]">
                <AddItemInput embedded />
            </div>

            {/* Plan/Shop + settings */}
            <div className="flex items-center gap-2 order-2 sm:order-4 ml-auto sm:ml-0">
                <div className="bg-chip dark:bg-white/5 rounded-[13px] p-1 flex items-center gap-1 border border-black/5 dark:border-white/5">
                    <button
                        onClick={() => { setAppMode('planning'); triggerHaptic(10); }}
                        className={`rounded-[9px] px-3 sm:px-4 py-2.5 text-[13px] font-bold flex items-center gap-1.5 transition ${appMode === 'planning'
                            ? 'bg-mint text-white shadow-[0_4px_12px_rgba(16,185,129,.3)]'
                            : 'text-inkMute dark:text-creamFaint'}`}
                    >
                        <ScrollText size={14} /><span className="hidden sm:inline">{t.modePlan}</span>
                    </button>
                    <button
                        onClick={() => { setAppMode('shopping'); triggerHaptic(10); }}
                        className={`rounded-[9px] px-3 sm:px-4 py-2.5 text-[13px] font-bold flex items-center gap-1.5 transition ${appMode === 'shopping'
                            ? 'bg-mint text-white shadow-[0_4px_12px_rgba(16,185,129,.3)]'
                            : 'text-inkMute dark:text-creamFaint'}`}
                    >
                        <ShoppingCart size={14} /><span className="hidden sm:inline">{t.modeShop}</span>
                    </button>
                </div>
                <button
                    onClick={openSettings}
                    className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-chip dark:bg-white/5 border border-black/5 dark:border-white/5 text-inkMute dark:text-creamFaint"
                >
                    <Settings size={18} />
                </button>
            </div>

            {showSwitcher && <ListSwitcherModal onClose={() => setShowSwitcher(false)} onJoinByCode={openSettings} />}
        </div>
    );
};

export default Topbar;
