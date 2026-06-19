import { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { Trash2, Plus, Save, X, Edit, Loader, EyeOff, Eye } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { EMOJI_LIST } from '../../data/constants';

interface CatalogCategory {
    id: string;
    key: string;
    icon: string;
    name_es: string;
    name_ca: string;
    name_en: string;
    color: string;
    order: number;
    hidden: boolean;
}

const CategoryManager = () => {
    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<CatalogCategory>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { lang } = useShopStore();

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const result = await pb.collection('catalog_categories').getFullList<CatalogCategory>({ sort: 'key' });
            setCategories(result);
            setSelectedIds(new Set());
        } catch (e) {
            console.error(e);
            alert('Error cargando categorías');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === categories.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(categories.map(c => c.id)));
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`¿Borrar ${selectedIds.size} categorías? Se borrarán todos sus productos.`)) return;
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => pb.collection('catalog_categories').delete(id)));
            loadCategories();
        } catch (e) {
            alert('Error borrando categorías');
            setLoading(false);
        }
    };

    const handleBulkVisibility = async (hide: boolean) => {
        if (selectedIds.size === 0) return;
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => pb.collection('catalog_categories').update(id, { hidden: hide })));
            loadCategories();
        } catch (e) {
            alert('Error cambiando visibilidad');
            setLoading(false);
        }
    };

    const handleEdit = (cat: CatalogCategory) => {
        setEditingId(cat.id);
        setFormData(cat);
        setIsCreating(false);
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData({ icon: '📦', color: 'bg-slate-500', hidden: false });
        setIsCreating(true);
    };

    const handleSave = async () => {
        try {
            if (isCreating) {
                await pb.collection('catalog_categories').create(formData);
            } else if (editingId) {
                await pb.collection('catalog_categories').update(editingId, formData);
            }
            setIsCreating(false);
            setEditingId(null);
            setFormData({});
            loadCategories();
        } catch (e) {
            console.error(e);
            alert('Error guardando');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar esta categoría? Se borrarán todos sus productos.')) return;
        try {
            await pb.collection('catalog_categories').delete(id);
            loadCategories();
        } catch (e) {
            console.error(e);
            alert('Error eliminando');
        }
    };

    const toggleHidden = async (cat: CatalogCategory) => {
        try {
            await pb.collection('catalog_categories').update(cat.id, { hidden: !cat.hidden });
            loadCategories();
        } catch (e) {
            alert('Error al cambiar visibilidad');
        }
    };

    const getLocalizedName = (cat: CatalogCategory) => {
        if (lang === 'ca') return cat.name_ca || cat.name_es;
        if (lang === 'en') return cat.name_en || cat.name_es;
        return cat.name_es;
    };

    if (loading && categories.length === 0) return <div className="flex justify-center p-8"><Loader className="animate-spin text-blue-500" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Gestor de Categorías ({categories.length})</h2>
                    {selectedIds.size > 0 && (
                        <p className="text-xs font-bold text-blue-500 uppercase mt-1">
                            {selectedIds.size} seleccionadas
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {selectedIds.size > 0 && (
                        <>
                            <button onClick={() => handleBulkVisibility(false)} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1.5">
                                <Eye size={14} /> Mostrar
                            </button>
                            <button onClick={() => handleBulkVisibility(true)} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-200 transition-colors flex items-center gap-1.5">
                                <EyeOff size={14} /> Esconder
                            </button>
                            <button onClick={handleBulkDelete} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1.5 mr-2">
                                <Trash2 size={14} /> Borrar
                            </button>
                        </>
                    )}
                    <button
                        onClick={toggleSelectAll}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-lg hover:bg-slate-200 transition font-bold text-sm"
                    >
                        {selectedIds.size === categories.length ? 'Desmarcar todo' : 'Marcar todo'}
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={18} /> Nueva Categoría
                    </button>
                </div>
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-blue-500/30 mb-6">
                    <h3 className="font-bold text-lg mb-6 dark:text-white flex items-center gap-2">
                        <Plus className="text-blue-500" size={20} />
                        Nueva Categoría
                    </h3>
                    <CategoryForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={() => setIsCreating(false)} />
                </div>
            )}

            <div className="grid gap-4">
                {categories.map(cat => (
                    <div
                        key={cat.id}
                        onClick={() => toggleSelect(cat.id)}
                        className={`group relative bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border transition-all cursor-pointer ${selectedIds.has(cat.id) ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200 dark:border-slate-700'} ${cat.hidden && !selectedIds.has(cat.id) ? 'opacity-60 grayscale' : ''}`}
                    >
                        {editingId === cat.id ? (
                            <div className="w-full" onClick={e => e.stopPropagation()}>
                                <h3 className="font-bold mb-4 dark:text-white">Editando Categoría</h3>
                                <CategoryForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={() => setEditingId(null)} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(cat.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                                        {selectedIds.has(cat.id) && <Plus size={14} className="text-white rotate-45" />}
                                    </div>
                                </div>
                                <div className="text-3xl bg-slate-100 dark:bg-slate-700 w-12 h-12 flex items-center justify-center rounded-lg flex-shrink-0">
                                    {cat.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-lg dark:text-white flex items-center gap-2 truncate">
                                        {getLocalizedName(cat)}
                                        {cat.hidden && <EyeOff size={14} className="text-orange-500" />}
                                        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black text-white ${cat.color}`}>
                                            {cat.key}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">
                                        {cat.name_es} / {cat.name_ca} / {cat.name_en}
                                    </div>
                                </div>
                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleHidden(cat)}
                                        className={`p-2 rounded-lg transition-colors ${cat.hidden ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10' : 'text-slate-400 hover:bg-slate-100'}`}
                                        title={cat.hidden ? "Mostrar (también mostrará productos no ocultos individualmente)" : "Esconder (también ocultará todos sus productos)"}
                                    >
                                        {cat.hidden ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                    <button onClick={() => handleEdit(cat)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Editar">
                                        <Edit size={20} />
                                    </button>
                                    <button onClick={() => handleDelete(cat.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const CategoryForm = ({ data, onChange, onSave, onCancel }: { data: any, onChange: (d: any) => void, onSave: () => void, onCancel: () => void }) => {
    const handleChange = (field: string, val: any) => onChange({ ...data, [field]: val });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Key (ID único)</label>
                    <input
                        placeholder="Ej: fruits"
                        value={data.key || ''}
                        onChange={e => handleChange('key', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Icono (Emoji)</label>
                    <div className="flex gap-2">
                        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-xl text-2xl border border-slate-200 dark:border-slate-600">
                            {data.icon || '📦'}
                        </div>
                        <div className="flex-grow p-2 bg-slate-50 dark:bg-slate-900 shadow-inner rounded-xl border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
                                {EMOJI_LIST.map(e => (
                                    <button
                                        key={e}
                                        type="button"
                                        onClick={() => handleChange('icon', e)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors ${data.icon === e ? 'bg-white dark:bg-slate-700 ring-2 ring-blue-500/50 shadow-sm' : ''}`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Color Tailwind (bg-*)</label>
                    <input
                        placeholder="Ej: bg-red-500"
                        value={data.color || ''}
                        onChange={e => handleChange('color', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Nombre (Castellano)</label>
                    <input
                        placeholder="Frutas"
                        value={data.name_es || ''}
                        onChange={e => handleChange('name_es', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Nombre (Català)</label>
                    <input
                        placeholder="Fruites"
                        value={data.name_ca || ''}
                        onChange={e => handleChange('name_ca', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400">Nombre (English)</label>
                    <input
                        placeholder="Fruits"
                        value={data.name_en || ''}
                        onChange={e => handleChange('name_en', e.target.value)}
                        className="input-admin w-full"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 py-2">
                <input
                    type="checkbox"
                    id="cat-hidden"
                    checked={data.hidden || false}
                    onChange={e => handleChange('hidden', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="cat-hidden" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Esconder categoría del catálogo público
                </label>
            </div>

            <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button onClick={onCancel} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white transition-colors">
                    <X size={18} /> Cancelar
                </button>
                <button onClick={onSave} className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                    <Save size={18} /> Guardar
                </button>
            </div>
        </div>
    )
}

export default CategoryManager;
