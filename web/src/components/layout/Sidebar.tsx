import { useState } from 'react';
import { Plus, Check, Settings } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { triggerHaptic } from '../../utils/haptics';

// Desktop-only left rail: brand + "Les meves llistes" switcher + account.
// Hidden under lg; mobile uses the Header bottom-sheet switcher instead.
interface Props {
    openSettings: () => void;
}

const T = {
    ca: { myLists: 'Les meves llistes', newList: 'Nova llista', synced: 'Sincronitzada', local: 'Local', guest: 'Convidat', viewing: 'Veient ara' },
    es: { myLists: 'Mis listas', newList: 'Nueva lista', synced: 'Sincronizada', local: 'Local', guest: 'Invitado', viewing: 'Viendo ahora' },
    en: { myLists: 'My lists', newList: 'New list', synced: 'Synced', local: 'Local', guest: 'Guest', viewing: 'Viewing now' },
} as const;

const Sidebar = ({ openSettings }: Props) => {
    const { lists, activeListId, listCaches, items, switchList, createList, lang, auth, activeUsers, sync } = useShopStore();
    const t = T[lang as keyof typeof T] ?? T.ca;
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');

    const countFor = (id: string) => {
        const src = id === activeListId ? items : (listCaches[id]?.items ?? []);
        const active = src.filter(i => i.inList !== false);
        return { done: active.filter(i => i.checked).length, total: active.length };
    };

    const handleCreate = () => {
        createList(name.trim() || null, '🛒');
        setName(''); setCreating(false); triggerHaptic(30);
    };

    return (
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-appbg dark:bg-darkSurface2 border-r border-black/5 dark:border-white/5 px-4 py-5 z-30">
            {/* Brand */}
            <div className="flex items-center gap-2.5 px-1 mb-6">
                <div className="w-9 h-9 rounded-xl bg-mint flex items-center justify-center shrink-0">
                    <img src="/icon.png" alt="" className="w-6 h-6 object-contain" />
                </div>
                <span className="font-display font-extrabold text-lg tracking-tight text-ink dark:text-cream">shoppinglist</span>
            </div>

            <div className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-inkFaint dark:text-creamFaint px-1 mb-2.5">{t.myLists}</div>

            {/* Lists */}
            <div className="flex flex-col gap-1.5 overflow-y-auto">
                {lists.map(l => {
                    const c = countFor(l.id);
                    const isActive = l.id === activeListId;
                    return (
                        <button
                            key={l.id}
                            onClick={() => { switchList(l.id); triggerHaptic(15); }}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${isActive
                                ? 'bg-white dark:bg-white/5 shadow-sm border border-mint/30'
                                : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border border-transparent'}`}
                        >
                            <span className="w-7 h-7 rounded-lg bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-sm shrink-0">{l.emoji}</span>
                            <span className="flex-1 min-w-0">
                                <span className={`block text-sm font-bold truncate ${isActive ? 'text-ink dark:text-cream' : 'text-inkMute dark:text-creamFaint'}`}>{l.name || t.myLists}</span>
                                <span className="block text-[11px] text-inkFaint dark:text-creamFaint">{c.done} / {c.total}</span>
                            </span>
                            {isActive && sync.connected && <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse shrink-0"></span>}
                            {isActive && !sync.connected && <Check size={14} className="text-mint shrink-0" />}
                        </button>
                    );
                })}

                {creating ? (
                    <div className="px-1 py-1.5">
                        <input
                            autoFocus value={name} onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                            onBlur={handleCreate}
                            placeholder={t.newList}
                            className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint/40 text-ink dark:text-cream"
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-inkFaint dark:text-creamFaint hover:text-mint font-semibold text-sm transition"
                    >
                        <Plus size={17} /> {t.newList}
                    </button>
                )}
            </div>

            <div className="mt-auto pt-4">
                {sync.connected && activeUsers.length > 0 && (
                    <>
                        <div className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-inkFaint dark:text-creamFaint px-1 mb-2">{t.viewing}</div>
                        <div className="flex gap-1.5 px-1 mb-4">
                            {activeUsers.slice(0, 5).map(u => (
                                <div key={u.id} className="w-8 h-8 rounded-full bg-amber text-mint-ink flex items-center justify-center text-xs font-bold border-2 border-white dark:border-darkSurface2 -ml-2 first:ml-0" title={u.username}>
                                    {(u.username || '?').charAt(0).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    </>
                )}
                <button
                    onClick={openSettings}
                    className="w-full flex items-center gap-3 bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2.5 text-left hover:shadow-sm transition"
                >
                    <span className="w-8 h-8 rounded-full bg-ink dark:bg-white/10 text-white flex items-center justify-center text-sm font-bold shrink-0">
                        {(auth.username || auth.email || 'C').charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-ink dark:text-cream truncate">{auth.username || auth.email?.split('@')[0] || t.guest}</span>
                    </span>
                    <Settings size={16} className="text-inkFaint dark:text-creamFaint shrink-0" />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
