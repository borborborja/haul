import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, ChevronRight, ArrowRight, Trash2 } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useBackButton } from '../../hooks/useBackButton';
import { useScrollLock } from '../../hooks/useScrollLock';
import { triggerHaptic } from '../../utils/haptics';

// Self-contained i18n for the switcher; folded into constants.ts in Phase 4.
const T = {
    ca: { title: 'Les meves llistes', synced: 'Sincronitzada', local: 'Local', newList: 'Nova llista', code: 'Codi', name: 'Nom de la llista', create: 'Crea', cancel: 'Cancel·la' },
    es: { title: 'Mis listas', synced: 'Sincronizada', local: 'Local', newList: 'Nueva lista', code: 'Código', name: 'Nombre de la lista', create: 'Crear', cancel: 'Cancelar' },
    en: { title: 'My lists', synced: 'Synced', local: 'Local', newList: 'New list', code: 'Code', name: 'List name', create: 'Create', cancel: 'Cancel' },
} as const;

const EMOJIS = ['🛒', '🏠', '🎉', '🏖️', '🍝', '🎄', '🧺', '🐣', '💼', '🍕', '🥗', '🎁'];

interface Props {
    onClose: () => void;
    onJoinByCode?: () => void; // opens the existing join-by-code flow (settings)
}

const ListSwitcherModal = ({ onClose, onJoinByCode }: Props) => {
    const { lists, activeListId, listCaches, items, switchList, createList, deleteList, lang } = useShopStore();
    const t = T[lang as keyof typeof T] ?? T.ca;
    useScrollLock(true);
    useBackButton(onClose);

    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('🛒');

    const countsFor = (id: string): { done: number; total: number; synced: boolean } => {
        const src = id === activeListId ? items : (listCaches[id]?.items ?? []);
        const active = src.filter(i => i.inList !== false);
        const meta = lists.find(l => l.id === id);
        return { done: active.filter(i => i.checked).length, total: active.length, synced: !!meta?.code };
    };

    const handleSwitch = (id: string) => {
        if (id !== activeListId) { switchList(id); triggerHaptic(20); }
        onClose();
    };

    const handleCreate = () => {
        const name = newName.trim();
        createList(name || null, newEmoji);
        triggerHaptic(30);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-[#0A1512]/45 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full sm:max-w-md bg-white dark:bg-darkSurface rounded-t-[30px] sm:rounded-[28px] shadow-[0_-18px_50px_rgba(10,21,18,.25)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-slide-up max-h-[88vh] flex flex-col">
                <div className="w-10 h-1.5 rounded-full bg-[#E0E3DD] dark:bg-white/10 mx-auto mb-4 sm:hidden"></div>

                <div className="flex items-center gap-3 mb-4">
                    <h2 className="flex-1 font-display font-extrabold text-[22px] tracking-tight text-ink dark:text-cream">{t.title}</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-chip dark:bg-white/5 flex items-center justify-center text-inkMute dark:text-creamFaint">
                        <X size={15} />
                    </button>
                </div>

                {/* List rows */}
                <div className="flex flex-col gap-2.5 overflow-y-auto">
                    {lists.map(l => {
                        const c = countsFor(l.id);
                        const isActive = l.id === activeListId;
                        return (
                            <button
                                key={l.id}
                                onClick={() => handleSwitch(l.id)}
                                className={`group flex items-center gap-3 rounded-2xl p-3.5 text-left transition ${isActive
                                    ? 'bg-[#EAF7F1] dark:bg-mint/10 border-[1.5px] border-mint'
                                    : 'bg-card2 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 hover:border-black/10'}`}
                            >
                                <div className="w-[42px] h-[42px] rounded-xl bg-white dark:bg-white/5 flex items-center justify-center text-xl shadow-sm shrink-0">
                                    {l.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[16px] text-ink dark:text-cream truncate">{l.name || t.title}</div>
                                    <div className={`text-xs mt-0.5 flex items-center gap-1.5 ${c.synced ? 'text-mint-deep dark:text-mint' : 'text-inkFaint dark:text-creamFaint'}`}>
                                        {c.synced && <span className="w-1.5 h-1.5 rounded-full bg-mint"></span>}
                                        {c.done} / {c.total} · {c.synced ? t.synced : t.local}
                                    </div>
                                </div>
                                {isActive ? (
                                    <span className="w-[26px] h-[26px] rounded-full bg-mint flex items-center justify-center shadow-[0_0_0_4px_rgba(16,185,129,.15)]">
                                        <Check size={15} className="text-mint-ink" strokeWidth={3.2} />
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        {lists.length > 1 && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); if (confirm(`${l.name || t.title}?`)) { deleteList(l.id); triggerHaptic(20); } }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-inkFaint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <Trash2 size={14} />
                                            </span>
                                        )}
                                        <ChevronRight size={20} className="text-[#C9D2CC] dark:text-white/20" />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Inline create */}
                {creating && (
                    <div className="mt-3 p-3 rounded-2xl bg-card2 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 animate-pop">
                        <div className="flex gap-2 mb-2.5 flex-wrap">
                            {EMOJIS.map(e => (
                                <button key={e} onClick={() => setNewEmoji(e)}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${newEmoji === e ? 'bg-mint/15 ring-2 ring-mint' : 'bg-white dark:bg-white/5'}`}>
                                    {e}
                                </button>
                            ))}
                        </div>
                        <input
                            autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder={t.name}
                            className="w-full bg-white dark:bg-darkBg/50 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/40 text-ink dark:text-cream mb-2.5"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setCreating(false)} className="flex-1 py-2.5 rounded-xl text-inkMute dark:text-creamFaint font-bold text-sm">{t.cancel}</button>
                            <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl bg-mint text-white font-bold text-sm shadow-lg shadow-mint/30">{t.create}</button>
                        </div>
                    </div>
                )}

                {/* Footer actions */}
                {!creating && (
                    <div className="flex gap-2.5 mt-4">
                        <button onClick={() => setCreating(true)}
                            className="flex-1 bg-mint text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(16,185,129,.3)]">
                            <Plus size={16} strokeWidth={2.5} />{t.newList}
                        </button>
                        <button onClick={() => { onClose(); onJoinByCode?.(); }}
                            className="bg-chip dark:bg-white/5 text-ink dark:text-cream rounded-2xl py-3.5 px-5 font-bold text-sm flex items-center justify-center gap-2">
                            <ArrowRight size={16} strokeWidth={2.3} />{t.code}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default ListSwitcherModal;
