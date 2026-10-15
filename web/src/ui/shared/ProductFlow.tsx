import { productErrorMessage } from './productMessages';
import { useEffect, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import type { ProductDraft, ProductSaveResult } from '../../types';
import { tt } from '../../data/i18n';
import { localized } from './model';
import ProductDialog from './ProductDialog';
import { ProductFlowContext as Context, type BrowseState, type ProductFlow as Flow } from './productFlowContext';
import CategoryDialog from './CategoryDialog';

import { normalizeProductSearch } from './productSearch';
const initialBrowse = (): BrowseState => ({ screen: 'app', settingsTab: 'account', catalogOpen: false, activeBand: '', search: '', editor: null, categoryOpen: false });
type Notice = { message: string; error?: boolean; pendingSync?: boolean; undo?: () => Promise<void>; retry?: () => Promise<void> };

export function ProductFlowProvider({ children }: { children: ReactNode }) {
    const listId = useShopStore((s) => s.activeListId);
    const server = useShopStore((s) => s.serverUrl);
    const lang = useShopStore((s) => s.lang);
    const categories = useShopStore((s) => s.categories);
    const hidden = useShopStore((s) => s.disabledCategories);
    const syncStatus = useShopStore((s) => s.catalogSyncStatus);
    const syncError = useShopStore((s) => s.catalogSyncError);
    const t = tt(lang);
    const key = `${server}\u0000${listId}`;
    const [contexts, setContexts] = useState<Record<string, BrowseState>>({});
    const [notice, setNotice] = useState<Notice | null>(null);
    const state = contexts[key] || initialBrowse();
    const patch = (value: Partial<BrowseState>, target = key) => setContexts((all) => ({ ...all, [target]: { ...(all[target] || initialBrowse()), ...value } }));
    const visibleKeys = Object.keys(categories).filter((cat) => !hidden.includes(cat));
    const activeBand = visibleKeys.includes(state.activeBand) ? state.activeBand : visibleKeys[0] || '';
    useEffect(() => { setNotice(null); }, [key]);
    const current = () => {
        const s = useShopStore.getState();
        return `${s.serverUrl}\u0000${s.activeListId}` === key;
    };
    const report = (result: ProductSaveResult, success: string) => {
        if (!current()) return;
        if (result.status === 'error') setNotice({ message: productErrorMessage(result.error, t), error: true, retry: async () => { await useShopStore.getState().retryCatalogChanges(); } });
        else setNotice({ message: success, pendingSync: result.status === 'pending' });
    };
    const saveProduct = async (draft: ProductDraft, editId?: string, updateCatalog = false): Promise<ProductSaveResult> => {
        if (!current()) return { status: 'error', error: 'scope_changed' };
        return editId ? useShopStore.getState().editProduct(editId, { ...draft, updateCatalog }) : useShopStore.getState().createProduct(draft);
    };
    const retrySync = async () => { await useShopStore.getState().retryCatalogChanges(); };
    const visibleNotice: Notice | null = syncStatus === 'error'
        ? { ...notice, message: productErrorMessage(syncError, t), error: true, retry: retrySync }
        : notice ? { ...notice, message: notice.pendingSync && syncStatus === 'pending' ? t.pendingSync : notice.message }
        : syncStatus === 'pending' ? { message: t.pendingSync, retry: retrySync } : null;
    const flow: Flow = {
        ...state, activeBand, feedback: visibleNotice, dismissFeedback: () => setNotice(null),
        setScreen: (screen) => patch({ screen }), setSettingsTab: (settingsTab) => patch({ settingsTab }),
        setCatalogOpen: (catalogOpen) => patch({ catalogOpen }), setActiveBand: (activeBand) => patch({ activeBand }), setSearch: (search) => patch({ search }),
        setEditor: (editor) => patch({ editor }),
        openCreate: (category = activeBand, name = '', bulk = false) => { setNotice(null); patch({ editor: { mode: 'create', name, category, quantity: '', note: '', addToList: state.screen !== 'settings', updateCatalog: false, bulk, bulkNames: '' } }); },
        openEdit: (item) => { setNotice(null); patch({ editor: { mode: 'edit', itemId: item.id, name: item.name, category: item.category, quantity: item.quantity || '', note: item.note || '', addToList: true, updateCatalog: false, bulk: false, bulkNames: '' } }); },
        openCategory: () => { setNotice(null); patch({ categoryOpen: true }); }, closeCategory: () => patch({ categoryOpen: false }),
        removeItem: async (item) => {
            await useShopStore.getState().removeFromList(item.id);
            if (current()) setNotice({ message: `${item.name} · ${t.remove}`, undo: async () => {
                if (!current()) return;
                await useShopStore.getState().addBackToList(item.id);
                if (item.checked) await useShopStore.getState().toggleCheck(item.id);
                setNotice({ message: t.addedToList });
            } });
        },
        saveProduct, report, notify: (message) => setNotice({ message }),
        addExisting: async (name, category) => {
            const existing = useShopStore.getState().items.find((item) => normalizeProductSearch(item.name) === normalizeProductSearch(name) && item.inList !== false && !item.checked);
            if (existing) { setNotice({ message: t.alreadyInList }); return; }
            const result = await saveProduct({ name, category, addToList: true });
            if (result.status === 'error') {
                if (current()) setNotice({ message: productErrorMessage(result.error, t), error: true, retry: async () => { await flow.addExisting(name, category); } });
            } else { report(result, t.addedToList); patch({ search: '' }); }
        },
        hideProduct: async (item) => {
            await useShopStore.getState().deactivateProduct(item);
            if (current()) setNotice({ message: `${localized(item, lang)} · ${t.productHidden}`, undo: async () => { if (current()) { await useShopStore.getState().reactivateProduct(item); setNotice({ message: t.productRestored }); } } });
        },
        showProduct: async (item) => { await useShopStore.getState().reactivateProduct(item); if (current()) setNotice({ message: t.productRestored }); },
        hideCategory: async (category) => {
            await useShopStore.getState().deactivateCategory(category);
            if (current()) setNotice({ message: t.categoryHidden, undo: async () => { if (current()) { await useShopStore.getState().reactivateCategory(category); setNotice({ message: t.productRestored }); } } });
        },
        showCategory: async (category) => { await useShopStore.getState().reactivateCategory(category); if (current()) setNotice({ message: t.productRestored }); },
    };
    return <Context.Provider value={flow}>
        {children}
        {state.editor && <ProductDialog key={`${key}:${state.editor.itemId || 'new'}`} />}
        {state.categoryOpen && <CategoryDialog onCreated={(category) => {
            patch({ categoryOpen: false, activeBand: category, editor: state.editor ? { ...state.editor, category } : null });
        }} />}
        {visibleNotice && !state.editor && !state.categoryOpen && <div className="haul-feedback" role={visibleNotice.error ? 'alert' : 'status'} aria-live={visibleNotice.error ? 'assertive' : 'polite'}>
            {!visibleNotice.error && <Check size={19} aria-hidden="true" />}
            <span className="haul-feedback-message">{visibleNotice.message}</span>
            {visibleNotice.undo && <button className="haul-btn" onClick={() => void visibleNotice.undo?.()}>{t.undo}</button>}
            {visibleNotice.retry && <button className="haul-btn" onClick={() => void visibleNotice.retry?.()}>{t.retry}</button>}
            {notice && <button className="haul-btn haul-btn-quiet" aria-label={t.dismiss} onClick={() => setNotice(null)}><X size={18} /></button>}
        </div>}
    </Context.Provider>;
}
