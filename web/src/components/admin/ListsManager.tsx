import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Loader, RefreshCw, CheckSquare, Square, Ghost, Clock, AlertTriangle, ChevronDown, ChevronUp, Tag, Package, StickyNote, RotateCcw, X, Download, Upload, FileJson } from 'lucide-react';
import { exportListBackup, importListBackup, parseListBackup, resetListCustomData, resetListItems } from './listBackup';
import type { BackupCategory, BackupProduct, ListBackup } from './listBackup';

interface ShopItem {
    id: string;
    name: string;
    checked: boolean;
    in_list?: boolean;
    note: string;
    category: string;
}

interface CategoryItem {
    icon: string;
    items: unknown[];
    color?: string;
}

interface ShoppingListData {
    items?: ShopItem[];
    categories?: { [key: string]: CategoryItem };
    listName?: string;
    [key: string]: unknown;
}

interface ShoppingListRecord {
    id: string;
    name: string;
    invite_code: string;
    updated: string;
    created: string;
    data: ShoppingListData;
    atomicItems?: ShopItem[];
    customCategories?: BackupCategory[];
    customItems?: BackupProduct[];
    last_editor?: string;
    last_edited_by?: string;
    expand?: {
        'shopping_items(list)'?: ShopItem[];
        last_edited_by?: { display_name?: string; email?: string };
    };
}

interface HistoryRow { id: string; actor: string; ip: string; action: string; detail: string; created: string }

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const createInviteCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), value => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join('');

const actionLabel = (a: string): string => (({ add: '+ Añadido', remove: '− Quitado', check: '✓ Comprado', uncheck: 'Desmarcado', edit: 'Editado' } as Record<string, string>)[a] || a);

const ListsManager = ({ focusListId }: { focusListId?: string | null }) => {
    const [lists, setLists] = useState<ShoppingListRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [history, setHistory] = useState<Record<string, HistoryRow[]>>({});

    // Import Logic State
    const [importData, setImportData] = useState<ListBackup | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importConflict, setImportConflict] = useState<ShoppingListRecord | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        loadLists();
    }, []);

    // Deep-link from the Users tab: expand the requested list.
    useEffect(() => {
        if (focusListId) setExpandedId(focusListId);
    }, [focusListId]);

    const loadLists = async () => {
        setLoading(true);
        try {
            const [result, items, categories, products] = await Promise.all([
                pb.collection('shopping_lists').getFullList<ShoppingListRecord>({ sort: '-updated', expand: 'last_edited_by' }),
                pb.collection('shopping_items').getFullList<ShopItem & { list: string }>(),
                pb.collection('list_categories').getFullList<BackupCategory & { list: string }>(),
                pb.collection('list_items').getFullList<BackupProduct & { list: string }>(),
            ]);
            setLists(result.map(list => ({
                ...list, data: list.data || {},
                atomicItems: items.filter(item => item.list === list.id),
                customCategories: categories.filter(category => category.list === list.id),
                customItems: products.filter(product => product.list === list.id),
            })));
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            alert('Error cargando listas');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === lists.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(lists.map(l => l.id)));
        }
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = expandedId === id ? null : id;
        setExpandedId(next);
        if (next && !history[next]) loadHistory(next);
    };

    const loadHistory = async (listId: string) => {
        try {
            const res = await pb.collection('list_history').getList<HistoryRow>(1, 80, { filter: pb.filter('list = {:list}', { list: listId }), sort: '-created' });
            setHistory(h => ({ ...h, [listId]: res.items }));
        } catch { setHistory(h => ({ ...h, [listId]: [] })); }
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!confirm(`¿Estás seguro de que quieres borrar ${count} lista${count > 1 ? 's' : ''}? Esta acción es irreversible.`)) return;

        setLoading(true);
        try {
            const promises = Array.from(selectedIds).map(id => pb.collection('shopping_lists').delete(id));
            await Promise.all(promises);
            await loadLists();
        } catch (e) {
            console.error(e);
            alert('Error borrando listas');
            setLoading(false);
        }
    };

    const handleResetItems = async (list: ShoppingListRecord) => {
        if (!confirm('¿Borrar todos los items de esta lista? Los productos se eliminarán.')) return;

        setActionLoading(list.id);
        try {
            await resetListItems(pb, list);
            await loadLists();
        } catch (e) {
            console.error(e);
            alert('Error reseteando items');
        } finally {
            setActionLoading(null);
        }
    };

    const handleResetCustomCategories = async (list: ShoppingListRecord) => {
        if (!confirm('¿Eliminar las categorías/productos personalizados? Se restaurarán solo las categorías por defecto.')) return;

        setActionLoading(list.id);
        try {
            await resetListCustomData(pb, list);
            await loadLists();
        } catch (e) {
            console.error(e);
            alert('Error reseteando categorías');
        } finally {
            setActionLoading(null);
        }
    };

    const handleExport = async (list: ShoppingListRecord) => {
        setActionLoading(list.id);
        try {
            const exportObj = await exportListBackup(pb, list);

            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `ShopList_${list.invite_code}_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error(e);
            alert('Error exportando lista');
        } finally {
            setActionLoading(null);
        }
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const [categories, products] = await Promise.all([
                        pb.collection('catalog_categories').getFullList(),
                        pb.collection('catalog_items').getFullList(),
                    ]);
                    const json = parseListBackup(JSON.parse(ev.target?.result as string), {
                        categoryKeys: categories.map(category => category.key),
                        itemNames: products.flatMap(item => [item.name_es, item.name_ca, item.name_en]),
                    });

                    setImportData(json);

                    // Check Conflict
                    if (json.code) {
                        try {
                            const existing = await pb.collection('shopping_lists').getFirstListItem(pb.filter('invite_code = {:code}', { code: json.code })) as unknown as ShoppingListRecord;
                            setImportConflict(existing);
                        } catch (error) {
                            if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error;
                            setImportConflict(null);
                        }
                    } else {
                        setImportConflict(null);
                    }
                    setShowImportModal(true);

                } catch (e) {
                    alert('Error leyendo archivo JSON valid. Asegúrate que es un export válido.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const executeImport = async (strategy: 'new_code' | 'overwrite' | 'merge') => {
        if (!importData) return;
        setIsImporting(true);
        try {
            const result = await importListBackup(pb, importData, strategy, createInviteCode(), importConflict || undefined);

            setShowImportModal(false);
            setImportData(null);
            setImportConflict(null);
            await loadLists();
            alert(`Lista importada correctamente con código: ${result.code}`);

        } catch (e) {
            console.error(e);
            alert('Fallo al importar');
        } finally {
            setIsImporting(false);
        }
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const getListItems = (list: ShoppingListRecord): ShopItem[] => {
        return list.atomicItems ?? list.expand?.['shopping_items(list)'] ?? list.data?.items ?? [];
    };

    const isPhantom = (list: ShoppingListRecord) => {
        const items = getListItems(list);
        const itemsCount = items.length;
        const lastUpdate = new Date(list.updated).getTime();
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        return itemsCount === 0 || lastUpdate < sevenDaysAgo;
    };

    const getPhantomReason = (list: ShoppingListRecord) => {
        const items = getListItems(list);
        const itemsCount = items.length;
        const lastUpdate = new Date(list.updated).getTime();
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        if (itemsCount === 0) return 'Vacía';
        if (lastUpdate < sevenDaysAgo) return 'Inactiva > 7d';
        return null;
    };

    const getCustomCategories = (list: ShoppingListRecord): [string, CategoryItem][] => {
        const products = list.customItems || [];
        return (list.customCategories || []).map(category => [category.key, {
            icon: category.icon, items: products.filter(item => item.category_key === category.key).map(item => item.name),
        }]);
    };

    const getCustomProducts = (list: ShoppingListRecord) => {
        const grouped = new Map<string, string[]>();
        for (const product of list.customItems || []) {
            const names = grouped.get(product.category_key) || [];
            names.push(product.name);
            grouped.set(product.category_key, names);
        }
        return [...grouped].map(([category, items]) => ({ category, items }));
    };

    const getItemsWithNotes = (list: ShoppingListRecord) => {
        const items = getListItems(list);
        return items.filter(item => item.note && item.note.trim() !== '');
    };

    if (loading && lists.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader className="animate-spin text-blue-500" size={32} />
            <p className="text-slate-500 font-medium">Cargando listas...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black dark:text-white flex items-center gap-3">
                        Gestor de Listas
                        <button
                            onClick={loadLists}
                            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Total: <span className="font-bold">{lists.length}</span> |
                        Fantasmas: <span className="font-bold text-orange-500">{lists.filter(isPhantom).length}</span>
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleImportClick}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                        <Upload size={18} /> Importar Lista
                    </button>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 transition-all animate-fade-in shadow-lg shadow-red-500/20 font-bold active:scale-95"
                        >
                            <Trash2 size={18} /> Borrar seleccionadas ({selectedIds.size})
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 w-12">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
                                    >
                                        {lists.length > 0 && selectedIds.size === lists.length ?
                                            <CheckSquare size={22} className="text-blue-500" /> :
                                            <Square size={22} />
                                        }
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado / Código</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Items</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Personalizados</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Última Actividad</th>
                                <th className="p-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {lists.map(list => {
                                const isSelected = selectedIds.has(list.id);
                                const phantom = isPhantom(list);
                                const reason = getPhantomReason(list);
                                const isExpanded = expandedId === list.id;
                                const customCats = getCustomCategories(list);
                                const customProducts = getCustomProducts(list);
                                const items = getListItems(list);
                                const itemsWithNotes = getItemsWithNotes(list);
                                const hasCustomData = customCats.length > 0 || customProducts.length > 0;

                                return [
                                    <tr
                                        key={list.id}
                                        className={`group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => toggleSelect(list.id)}
                                    >
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center transition-transform group-active:scale-90">
                                                {isSelected ?
                                                    <CheckSquare size={22} className="text-blue-500" /> :
                                                    <Square size={22} className="text-slate-300 dark:text-slate-700" />
                                                }
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {phantom ? (
                                                    <div className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase" title={`Lista Fantasma: ${reason}`}>
                                                        <Ghost size={12} />
                                                        {reason}
                                                    </div>
                                                ) : (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 uppercase leading-none">
                                                        {list.invite_code}
                                                    </span>
                                                    <span className="text-sm font-medium text-emerald-600 dark:text-blue-400">
                                                        {list.name || list.data.listName || 'Mi Lista'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium mt-1">#{list.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${phantom && items.length === 0 ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 dark:bg-blue-900/30 text-emerald-600 dark:text-blue-400'}`}>
                                                    {items.length}
                                                </div>
                                                {itemsWithNotes.length > 0 && (
                                                    <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold" title="Items con notas">
                                                        <StickyNote size={12} /> {itemsWithNotes.length}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {customCats.length > 0 && (
                                                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                                                        <Tag size={10} /> {customCats.length} cats
                                                    </div>
                                                )}
                                                {customProducts.length > 0 && (
                                                    <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                                        <Package size={10} /> {customProducts.reduce((sum, cp) => sum + cp.items.length, 0)} prods
                                                    </div>
                                                )}
                                                {!hasCustomData && <span className="text-slate-400 text-xs">—</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Clock size={14} className="opacity-50" />
                                                <span className="text-sm font-medium">{formatTime(list.updated)}</span>
                                            </div>
                                            {(() => {
                                                const ed = list.last_editor || list.expand?.last_edited_by?.email || list.expand?.last_edited_by?.display_name;
                                                return ed ? <div className="text-xs text-slate-400 mt-1 pl-6 truncate max-w-[180px]" title={ed}>{ed}</div> : null;
                                            })()}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={(e) => toggleExpand(list.id, e)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </td>
                                    </tr>,

                                    isExpanded && (
                                        <tr key={`${list.id}-detail`}>
                                            <td colSpan={6} className="p-0">
                                                <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 p-6 space-y-6">
                                                    {/* Actions */}
                                                    <div className="flex gap-3 flex-wrap">
                                                        <button
                                                            onClick={() => handleResetItems(list)}
                                                            disabled={actionLoading === list.id}
                                                            className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                        >
                                                            {actionLoading === list.id ? <Loader className="animate-spin" size={14} /> : <X size={14} />}
                                                            Reset Items ({items.length})
                                                        </button>
                                                        <button
                                                            onClick={() => handleResetCustomCategories(list)}
                                                            disabled={actionLoading === list.id}
                                                            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-lg text-sm font-bold border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
                                                        >
                                                            {actionLoading === list.id ? <Loader className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                                                            Reset Productos Personalizados
                                                        </button>
                                                        <button
                                                            onClick={() => handleExport(list)}
                                                            disabled={actionLoading === list.id}
                                                            className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                                                        >
                                                            {actionLoading === list.id ? <Loader className="animate-spin" size={14} /> : <Download size={14} />}
                                                            Exportar JSON (Completo)
                                                        </button>
                                                    </div>

                                                    {/* Change history */}
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                            <Clock size={14} /> Historial de cambios
                                                        </h4>
                                                        {history[list.id]?.length ? (
                                                            <div className="space-y-1 max-h-64 overflow-auto">
                                                                {history[list.id].map(h => (
                                                                    <div key={h.id} className="flex items-center gap-3 text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                        <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap w-24">{actionLabel(h.action)}</span>
                                                                        <span className="flex-1 truncate text-slate-500">{h.detail}</span>
                                                                        <span className="text-slate-600 dark:text-slate-300 whitespace-nowrap" title={h.actor}>{h.actor}</span>
                                                                        {h.ip && <span className="text-slate-400 font-mono whitespace-nowrap">{h.ip}</span>}
                                                                        <span className="text-slate-400 whitespace-nowrap">{formatTime(h.created)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">{history[list.id] ? 'Sin cambios registrados' : 'Cargando…'}</span>
                                                        )}
                                                    </div>

                                                    <div className="grid md:grid-cols-2 gap-6">
                                                        {/* Custom Categories */}
                                                        <div>
                                                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                                <Tag size={14} /> Categorías Personalizadas
                                                            </h4>
                                                            {customCats.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {customCats.map(([key, cat]) => (
                                                                        <div key={key} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xl">{cat.icon}</span>
                                                                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{key}</span>
                                                                            </div>
                                                                            <span className="text-xs text-slate-400">{cat.items?.length || 0} productos</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-slate-400 text-sm italic">Sin categorías personalizadas</p>
                                                            )}
                                                        </div>

                                                        {/* Custom Products */}
                                                        <div>
                                                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                                <Package size={14} /> Productos Personalizados en Catálogo
                                                            </h4>
                                                            {customProducts.length > 0 ? (
                                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                                    {customProducts.map(({ category, items }) => (
                                                                        <div key={category} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">{category}</div>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {items.map((item: any, idx) => (
                                                                                    <span key={idx} className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">
                                                                                        {item}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-slate-400 text-sm italic">Sin productos personalizados</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Items with Notes */}
                                                    {itemsWithNotes.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center gap-2">
                                                                <StickyNote size={14} /> Items con Notas
                                                            </h4>
                                                            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                {itemsWithNotes.map(item => (
                                                                    <div key={item.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                                                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                                            {item.checked && <span className="line-through opacity-50">{item.name}</span>}
                                                                            {!item.checked && item.name}
                                                                        </div>
                                                                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 italic">"{item.note}"</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Raw Items Preview */}
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3">
                                                            Lista de Items ({items.length})
                                                        </h4>
                                                        <div className="max-h-32 overflow-y-auto bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                                            {items.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {items.map(item => (
                                                                        <span
                                                                            key={item.id}
                                                                            className={`text-xs px-2 py-1 rounded ${item.checked ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 line-through' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                                                        >
                                                                            {item.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-slate-400 text-sm italic">Lista vacía</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                ];
                            })}
                            {lists.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Ghost size={48} className="opacity-20" />
                                            <p className="font-bold">No se encontraron listas.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 px-6 py-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-blue-500 mt-1" size={18} />
                <div className="text-sm text-emerald-700 dark:text-blue-300 leading-relaxed">
                    <p className="font-black mb-1 leading-none uppercase tracking-tighter">¿Qué es una lista fantasma?</p>
                    Se consideran listas fantasma aquellas que están <strong>vacías</strong> o que no han tenido <strong>actividad en los últimos 7 días</strong>. Es seguro borrarlas para mantener la base de datos limpia.
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && importData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700 animate-scale-in">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-white">
                            <Upload size={24} className="text-blue-500" /> Importar Lista
                        </h3>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-6">
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Archivo detectado:</div>
                            <div className="text-xs text-slate-500 font-mono mb-2">{importData.code} - {importData.listName}</div>
                            <div className="text-xs text-slate-500">{importData.items?.length || 0} items</div>
                        </div>

                        {importConflict ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                                    <strong>¡Conflicto detectado!</strong> Ya existe una lista con el código <span className="font-mono">{importData.code}</span> in this database.
                                </div>
                                <h4 className="text-xs font-bold uppercase text-slate-500">Elige una acción:</h4>

                                <button onClick={() => executeImport('new_code')} disabled={isImporting} className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group">
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Generar Nuevo Código</div>
                                        <div className="text-[10px] text-slate-400">Crea una copia nueva (Safe)</div>
                                    </div>
                                    <FileJson size={16} className="text-slate-400 group-hover:text-blue-500" />
                                </button>

                                <div className="border-t border-slate-100 dark:border-slate-800 my-2"></div>
                                <p className="text-[10px] font-bold uppercase text-slate-400">Mantener código {importData.code}:</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => executeImport('overwrite')} disabled={isImporting} className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold text-xs hover:bg-red-100 border border-red-100 dark:border-red-800 transition-colors">
                                        Sobreescribir
                                    </button>
                                    <button onClick={() => executeImport('merge')} disabled={isImporting} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-emerald-600 dark:text-blue-400 font-bold text-xs hover:bg-blue-100 border border-blue-100 dark:border-blue-800 transition-colors">
                                        Combinar (Merge)
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <button onClick={() => executeImport('new_code')} disabled={isImporting} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mb-3 hover:bg-emerald-700 transition">
                                    {isImporting ? <Loader className="animate-spin mx-auto" size={16} /> : 'Importar'}
                                </button>
                            </div>
                        )}

                        <button onClick={() => setShowImportModal(false)} disabled={isImporting} className="w-full mt-4 text-slate-400 hover:text-slate-600 text-xs font-bold">Cancelar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ListsManager;
