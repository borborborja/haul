import { useState } from 'react';
import { Plus, X, StickyNote } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations, categoryStyles } from '../../data/constants';
import type { ShopItem } from '../../types';
import ProductModal from '../modals/ProductModal';
import AddCategoryModal from '../modals/AddCategoryModal';
import { triggerHaptic } from '../../utils/haptics';

// Planning "board": one column per category that has active items (frame 01).
const BoardView = () => {
    const { items, categories, lang, addItem, removeFromList } = useShopStore();
    const t = translations[lang];
    const [editing, setEditing] = useState<ShopItem | null>(null);
    const [showAddCat, setShowAddCat] = useState(false);

    const active = items.filter(i => i.inList !== false && !i.checked);
    const grouped: Record<string, ShopItem[]> = {};
    active.forEach(i => {
        const c = i.category || 'other';
        (grouped[c] ||= []).push(i);
    });
    // Catalog order first, then any leftover categories present on items.
    const keys = [
        ...Object.keys(categories).filter(k => grouped[k]?.length),
        ...Object.keys(grouped).filter(k => !categories[k]),
    ];

    if (active.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center opacity-60">
                <div className="w-20 h-20 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4 text-3xl">🛒</div>
                <p className="text-sm font-bold text-inkMute dark:text-creamFaint tracking-wide">{t.empty}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-card2 dark:bg-darkBg px-5 sm:px-7 py-4 overflow-x-auto">
            <div className="flex gap-3 sm:gap-[18px] items-start min-h-full">
                {keys.map(key => {
                    const cat = categories[key];
                    const style = categoryStyles[cat?.color || key] || categoryStyles['other'];
                    const groupItems = grouped[key];
                    return (
                        <BoardColumn
                            key={key}
                            catKey={key}
                            icon={cat?.icon || '📦'}
                            name={t.cats[key as keyof typeof t.cats] || key}
                            style={style}
                            items={groupItems}
                            onAdd={(name) => { addItem(name, key); triggerHaptic(20); }}
                            onEdit={setEditing}
                            onRemove={(id) => { removeFromList(id); triggerHaptic(20); }}
                            emojiFor={(i) => categories[i.category]?.icon || '📦'}
                            t={t}
                        />
                    );
                })}

                {/* add column */}
                <button
                    onClick={() => setShowAddCat(true)}
                    className="flex-none w-[60px] self-stretch min-h-[200px] border-[1.5px] border-dashed border-black/10 dark:border-white/10 rounded-[18px] flex items-center justify-center text-inkFaint hover:text-mint hover:border-mint transition"
                >
                    <Plus size={20} />
                </button>
            </div>

            {editing && <ProductModal item={editing} onClose={() => setEditing(null)} />}
            {showAddCat && <AddCategoryModal onClose={() => setShowAddCat(false)} />}
        </div>
    );
};

interface ColProps {
    catKey: string;
    icon: string;
    name: string;
    style: any;
    items: ShopItem[];
    onAdd: (name: string) => void;
    onEdit: (item: ShopItem) => void;
    onRemove: (id: string) => void;
    emojiFor: (item: ShopItem) => string;
    t: any;
}

const BoardColumn = ({ icon, name, style, items, onAdd, onEdit, onRemove, emojiFor, t }: ColProps) => {
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState('');

    const submit = () => {
        if (val.trim()) onAdd(val.trim());
        setVal('');
        setAdding(false);
    };

    return (
        <div className="flex-none w-[280px] sm:w-[300px] bg-white dark:bg-darkSurface rounded-[18px] border border-black/5 dark:border-white/5 shadow-[0_4px_16px_rgba(10,21,18,.05)] overflow-hidden">
            <div className={`h-1 ${style.bgSolid}`}></div>
            <div className="px-4 py-3.5 flex items-center gap-2.5 border-b border-black/[0.04] dark:border-white/5">
                <span className="text-lg">{icon}</span>
                <span className="flex-1 font-bold text-[14.5px] text-ink dark:text-cream truncate">{name}</span>
                <span className="font-mono text-[11px] text-inkFaint bg-chip dark:bg-white/5 px-2 py-0.5 rounded-md">{items.length}</span>
            </div>
            <div className="p-3 flex flex-col gap-2.5">
                {items.map(item => (
                    <div
                        key={item.id}
                        onClick={() => onEdit(item)}
                        className="group/card relative bg-card2 dark:bg-white/[0.03] rounded-[13px] px-3 py-3 flex items-center gap-2.5 border border-black/[0.04] dark:border-white/5 cursor-pointer hover:border-black/10 transition"
                    >
                        <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-[17px] shrink-0 ${style.pill}`}>{emojiFor(item)}</div>
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[14.5px] text-ink dark:text-cream truncate">{item.name}</div>
                            {item.note && <div className="text-[11px] text-inkFaint truncate flex items-center gap-1"><StickyNote size={9} />{item.note}</div>}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                            className="opacity-0 group-hover/card:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-inkFaint hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}

                {adding ? (
                    <input
                        autoFocus value={val}
                        onChange={e => setVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setVal(''); setAdding(false); } }}
                        onBlur={submit}
                        placeholder="…"
                        className="bg-white dark:bg-darkBg/50 border border-black/10 dark:border-white/10 rounded-[13px] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mint/40 text-ink dark:text-cream"
                    />
                ) : (
                    <button
                        onClick={() => setAdding(true)}
                        className="border-[1.5px] border-dashed border-black/10 dark:border-white/10 rounded-[13px] py-2.5 flex items-center justify-center gap-1.5 text-inkFaint hover:text-mint hover:border-mint font-semibold text-[13px] transition"
                    >
                        <Plus size={15} />{t.add}
                    </button>
                )}
            </div>
        </div>
    );
};

export default BoardView;
