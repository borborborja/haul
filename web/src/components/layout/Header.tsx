import { useState } from 'react';
import { Settings, ChevronDown, ShoppingCart, ScrollText } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';
import { triggerHaptic } from '../../utils/haptics';
import ListSwitcherModal from '../modals/ListSwitcherModal';

interface HeaderProps {
    openSettings: () => void;
}

const Header = ({ openSettings }: HeaderProps) => {
    const { appMode, setAppMode, lang, lists, activeListId, listName, sync } = useShopStore();
    const t = translations[lang];
    const [showSwitcher, setShowSwitcher] = useState(false);

    const active = lists.find(l => l.id === activeListId);
    const emoji = active?.emoji ?? '🛒';

    return (
        <header className="fixed top-0 w-full z-40 glass transition-all duration-300 pt-[env(safe-area-inset-top)] lg:pl-64">
            <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
                {/* Active-list selector → opens "Les meves llistes" */}
                <button
                    onClick={() => { setShowSwitcher(true); triggerHaptic(10); }}
                    className="flex items-center gap-2 min-w-0 flex-1 group"
                >
                    <span className="w-9 h-9 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-lg shadow-sm shrink-0">
                        {emoji}
                    </span>
                    <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-display font-extrabold text-lg tracking-tight text-ink dark:text-cream truncate">
                            {listName || t.myList}
                        </span>
                        <ChevronDown size={18} className="text-inkFaint dark:text-creamFaint shrink-0 transition group-active:translate-y-0.5" />
                        {sync.connected && (
                            <span className="w-2 h-2 rounded-full bg-mint shrink-0 animate-pulse"></span>
                        )}
                    </span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Plan / Shop */}
                    <div className="bg-chip dark:bg-white/5 p-1 rounded-xl flex items-center border border-black/5 dark:border-white/5">
                        <button
                            onClick={() => { setAppMode('planning'); triggerHaptic(10); }}
                            className={`min-h-9 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${appMode === 'planning'
                                ? 'bg-mint text-white shadow-[0_4px_12px_rgba(16,185,129,.3)]'
                                : 'text-inkMute dark:text-creamFaint'}`}
                        >
                            <ScrollText size={14} /><span className="hidden sm:inline">{t.modePlan}</span>
                        </button>
                        <button
                            onClick={() => { setAppMode('shopping'); triggerHaptic(10); }}
                            className={`min-h-9 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${appMode === 'shopping'
                                ? 'bg-mint text-white shadow-[0_4px_12px_rgba(16,185,129,.3)]'
                                : 'text-inkMute dark:text-creamFaint'}`}
                        >
                            <ShoppingCart size={14} /><span className="hidden sm:inline">{t.modeShop}</span>
                        </button>
                    </div>
                    <button
                        aria-label={t.settings || 'Settings'}
                        onClick={openSettings}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-chip dark:bg-white/5 border border-black/5 dark:border-white/5 text-inkMute dark:text-creamFaint hover:text-ink dark:hover:text-cream transition"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {showSwitcher && (
                <ListSwitcherModal
                    onClose={() => setShowSwitcher(false)}
                    onJoinByCode={openSettings}
                />
            )}
        </header>
    );
};

export default Header;
