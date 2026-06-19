import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Plus, Save, X, Edit, Loader, Search, EyeOff, Eye, Filter, CheckSquare, Square } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';

interface CatalogItem {
    id: string;
    category: string;
    name_es: string;
    name_ca: string;
    name_en: string;
    hidden: boolean;
    expand?: { category: { key: string, icon: string, name_es: string, hidden: boolean } }
}

const ProductManager = () => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<CatalogItem>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { lang } = useShopStore();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cats, prods] = await Promise.all([
                pb.collection('catalog_categories').getFullList({ sort: 'key' }),
                pb.collection('catalog_items').getFullList<CatalogItem>({ sort: 'name_es', expand: 'category' })
            ]);
            setCategories(cats);
            setItems(prods);
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const filteredItems = items.filter(i => {
        const matchesSearch =
            i.name_es.toLowerCase().includes(search.toLowerCase()) ||
            i.name_ca.toLowerCase().includes(search.toLowerCase()) ||
            i.name_en.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredItems.map(i => i.id)));
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`¿Borrar ${selectedIds.size} productos?`)) return;
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => pb.collection('catalog_items').delete(id)));
            loadData();
        } catch (e) {
            alert('Error borrando productos');
            setLoading(false);
        }
    };

    const handleBulkVisibility = async (hide: boolean) => {
        if (selectedIds.size === 0) return;
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => pb.collection('catalog_items').update(id, { hidden: hide })));
            loadData();
        } catch (e) {
            alert('Error cambiando visibilidad');
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (isCreating) {
                await pb.collection('catalog_items').create(formData);
            } else if (editingId) {
                await pb.collection('catalog_items').update(editingId, formData);
            }
            setIsCreating(false);
            setEditingId(null);
            setFormData({});
            loadData();
        } catch (e) {
            alert('Error guardando');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar producto?')) return;
        try {
            await pb.collection('catalog_items').delete(id);
            loadData();
        } catch (e) { alert('Error eliminando'); }
    };

    const toggleHidden = async (item: CatalogItem) => {
        try {
            await pb.collection('catalog_items').update(item.id, { hidden: !item.hidden });
            loadData();
        } catch (e) {
            alert('Error al cambiar visibilidad');
        }
    };

    const getLocalizedName = (item: CatalogItem) => {
        if (lang === 'ca') return item.name_ca || item.name_es;
        if (lang === 'en') return item.name_en || item.name_es;
        return item.name_es;
    };

    if (loading && items.length === 0) return <div className="flex justify-center p-12"><Loader className="animate-spin text-blue-500" size={32} /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black dark:text-white">Gestor de Productos ({items.length})</h2>
                    <p className="text-slate-500 text-sm">Organiza y gestiona los productos del catálogo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {selectedIds.size > 0 && (
                        <>
                            <button onClick={() => handleBulkVisibility(false)} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1.5">
                                <Eye size={14} /> Mostrar
                            </button>
                            <button onClick={() => handleBulkVisibility(true)} className="bg-orange-100 text-orange-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-orange-200 transition-colors flex items-center gap-1.5">
                                <EyeOff size={14} /> Esconder
                            </button>
                            <button onClick={handleBulkDelete} className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1.5 mr-2">
                                <Trash2 size={14} /> Borrar
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => { setIsCreating(true); setEditingId(null); setFormData({ hidden: false }); }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm"
                    >
                        <Plus size={20} /> Nuevo Producto
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none w-full focus:ring-2 focus:ring-blue-500 dark:text-white text-sm"
                    />
                </div>
                <div className="relative w-full md:w-64">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none w-full focus:ring-2 focus:ring-blue-500 dark:text-white text-sm appearance-none cursor-pointer"
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.key}</option>)}
                    </select>
                </div>
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-blue-500/30 mb-6">
                    <h3 className="font-bold text-lg mb-6 dark:text-white">Nuevo Producto</h3>
                    <ProductForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={() => setIsCreating(false)} categories={categories} />
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-4 w-12">
                                    <button onClick={toggleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                                        {filteredItems.length > 0 && selectedIds.size === filteredItems.length ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                                    </button>
                                </th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500">Estado</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500">Categoría</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500">Producto</th>
                                <th className="p-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredItems.map(item => {
                                const isCategoryHidden = item.expand?.category?.hidden;
                                const isItemHidden = item.hidden || isCategoryHidden;
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => toggleSelect(item.id)}
                                        className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedIds.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''} ${isItemHidden ? 'opacity-50' : ''}`}
                                    >
                                        <td className="p-4">
                                            <div className="flex justify-center">
                                                {selectedIds.has(item.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-slate-300 dark:text-slate-700" />}
                                            </div>
                                        </td>
                                        <td className="p-4" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => !isCategoryHidden && toggleHidden(item)}
                                                className={`p-2 rounded-lg transition-colors ${isCategoryHidden ? 'text-slate-200 dark:text-slate-700 cursor-not-allowed' : isItemHidden ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10' : 'text-slate-300 hover:bg-slate-100'}`}
                                                title={isCategoryHidden ? "Oculto por categoría" : (item.hidden ? "Mostrar" : "Esconder")}
                                                disabled={isCategoryHidden}
                                            >
                                                {isItemHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit">
                                                <span>{item.expand?.category?.icon}</span>
                                                <span className={`text-xs font-bold uppercase ${isCategoryHidden ? 'text-orange-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {item.expand?.category?.key || item.category}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {editingId === item.id ? (
                                                <div onClick={e => e.stopPropagation()}>
                                                    <ProductForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} categories={categories} />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 dark:text-white">{getLocalizedName(item)}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ES: {item.name_es} | CA: {item.name_ca} | EN: {item.name_en}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => { setEditingId(item.id); setFormData(item); setIsCreating(false); }} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit size={18} /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400 font-medium">No se encontraron productos.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ProductForm = ({ data, onChange, onSave, onCancel, categories }: any) => {
    const handleChange = (field: string, val: any) => onChange({ ...data, [field]: val });
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Categoría</label>
                    <select
                        value={data.category || ''}
                        onChange={e => handleChange('category', e.target.value)}
                        className="input-admin w-full py-2.5"
                    >
                        <option value="">Seleccionar Categoría...</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.key}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Nombre (Castellano)</label>
                    <input
                        placeholder="Ej: Manzanas"
                        value={data.name_es || ''}
                        onChange={e => handleChange('name_es', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Nombre (Català)</label>
                    <input
                        placeholder="Ej: Pomes"
                        value={data.name_ca || ''}
                        onChange={e => handleChange('name_ca', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Nombre (English)</label>
                    <input
                        placeholder="Ej: Apples"
                        value={data.name_en || ''}
                        onChange={e => handleChange('name_en', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="prod-hidden"
                    checked={data.hidden || false}
                    onChange={e => handleChange('hidden', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="prod-hidden" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Esconder producto del catálogo
                </label>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={onCancel} className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold"><X size={18} /> Cancelar</button>
                <button onClick={onSave} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow shadow-blue-500/20 text-sm font-bold"><Save size={18} /> Guardar</button>
            </div>
        </div>
    )
}

export default ProductManager;
