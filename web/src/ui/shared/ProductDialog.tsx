import { productErrorMessage } from './productMessages';
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import type { ProductDraft, ProductSaveResult } from '../../types';
import { tt } from '../../data/i18n';
import { catLabel, useHaulModel } from './model';
import { normalizeProductSearch } from './productSearch';
import { useProductFlow } from './productFlowContext';
import AccessibleDialog from './AccessibleDialog';
import ProductFeedbackNotice from './ProductFeedbackNotice';

export type EditorState = {
    mode: 'create' | 'edit'; itemId?: string; name: string; category: string; quantity: string; note: string;
    addToList: boolean; updateCatalog: boolean; bulk: boolean; bulkNames: string;
};
type BulkResult = { name: string; result: ProductSaveResult };

export default function ProductDialog() {
    const flow = useProductFlow();
    const editor = flow.editor!;
    const m = useHaulModel();
    const t = tt(m.lang);
    const quantitySupported = useShopStore((s) => s.quantitySupported);
    const remoteListId = useShopStore((s) => s.sync.recordId);
    const catalogEntries = useShopStore((s) => s.catalogEntries);
    const items = useShopStore((s) => s.items);
    const listId = useShopStore((s) => s.activeListId);
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<BulkResult[]>([]);
    const edit = (value: Partial<EditorState>) => flow.setEditor({ ...editor, ...value });
    const original = useShopStore.getState().items.find((item) => item.id === editor.itemId);
    const source = original ? original.catalogSourceKind || useShopStore.getState().getCatalogSource(original.name, original.category) : 'none';
    const supportsQuantity = !remoteListId || quantitySupported === true;
    const save = async (another: boolean) => {
        if (busy) return;
        const names = editor.bulk ? editor.bulkNames.split(/\r?\n/).map((name) => name.trim()).filter(Boolean) : [editor.name.trim()];
        if (!names.length || !names[0]) { setError(t.invalidName); inputRef.current?.focus(); return; }
        if (!editor.category || !m.categories[editor.category]) { setError(t.chooseCategory); return; }
        setBusy(true); setError(''); setResults([]);
        const seen = new Set<string>();
        const outcomes: BulkResult[] = [];
        try {
            for (const name of names) {
                const normalized = normalizeProductSearch(name);
                if (seen.has(normalized)) { outcomes.push({ name, result: { status: 'exists' } }); continue; }
                seen.add(normalized);
                const draft: ProductDraft = { name, category: editor.category, note: editor.bulk ? '' : editor.note.trim(), addToList: editor.addToList, quantity: editor.bulk ? '' : supportsQuantity ? editor.quantity.trim() : original?.quantity || '' };
                const result = await flow.saveProduct(draft, editor.itemId, editor.updateCatalog);
                outcomes.push({ name, result });
            }
            if (editor.bulk) {
                setResults(outcomes);
                edit({ bulkNames: outcomes.filter(({ result }) => result.status === 'error').map(({ name }) => name).join('\n') });
                if (outcomes.some(({ result }) => result.status === 'pending')) flow.report({ status: 'pending' }, t.saved);
            } else {
                const result = outcomes[0].result;
                if (result.status === 'error') setError(productErrorMessage(result.error, t));
                else {
                    flow.report(result, result.status === 'exists' ? t.duplicateProduct : editor.mode === 'edit' ? t.saved : editor.addToList ? t.addedToList : t.productCreated);
                    if (another) { edit({ name: '', note: '', quantity: '' }); requestAnimationFrame(() => inputRef.current?.focus()); }
                    else flow.setEditor(null);
                }
            }
        } catch { setError(t.errorSaving); } finally { setBusy(false); }
    };
    const currentResult = (result: ProductSaveResult): ProductSaveResult => {
        if (result.status !== 'pending') return result;
        const entry = result.catalogId ? catalogEntries.find((value) => value.listId === listId && value.collection === 'list_items' && (value.id === result.catalogId || value.remoteId === result.catalogId)) : undefined;
        const item = items.find((value) => value.id === result.itemId);
        if (entry && entry.revision > entry.acknowledged && entry.blocked) return { ...result, status: 'error', error: entry.error };
        const pending = entry && entry.revision > entry.acknowledged || remoteListId && item && (item.id.startsWith('local_') || item.dirty);
        return { ...result, status: pending ? 'pending' : 'saved' };
    };
    return <AccessibleDialog title={editor.mode === 'edit' ? t.editProduct : editor.bulk ? t.bulkProducts : t.createProduct} onClose={() => flow.setEditor(null)}>
        <form className="haul-form" onSubmit={(e) => { e.preventDefault(); void save(editor.mode === 'create'); }}>
            {editor.mode === 'create' && <div style={{ display: 'flex', gap: 7 }}>
                <button className="haul-btn" type="button" aria-pressed={!editor.bulk} onClick={() => { edit({ bulk: false }); setResults([]); }}>{t.createProduct}</button>
                <button className="haul-btn" type="button" aria-pressed={editor.bulk} onClick={() => { edit({ bulk: true }); setResults([]); }}>{t.bulkProducts}</button>
            </div>}
            {editor.bulk ? <label className="haul-field">{t.namePerLine}<textarea aria-label={t.namePerLine} data-autofocus className="haul-input" rows={6} value={editor.bulkNames} onChange={(e) => edit({ bulkNames: e.target.value })} required maxLength={12000} aria-describedby="haul-bulk-hint" /><span id="haul-bulk-hint" className="haul-help">{t.bulkHint}</span></label>
                : <label className="haul-field">{t.productName}<input ref={inputRef} data-autofocus className="haul-input" value={editor.name} onChange={(e) => edit({ name: e.target.value })} required maxLength={200} autoComplete="off" /></label>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <label className="haul-field" style={{ flex: 1, minWidth: 0 }}>{t.category}<select className="haul-input" value={editor.category} onChange={(e) => edit({ category: e.target.value })} required>
                    <option value="" disabled>{t.chooseCategory}</option>{m.bands.map((band) => <option key={band.key} value={band.key}>{band.emoji} {band.label}</option>)}
                    {editor.category && !m.bands.some((b) => b.key === editor.category) && m.categories[editor.category] && <option value={editor.category}>{catLabel(editor.category, m.lang, m.categories[editor.category]?.names)}</option>}
                </select></label>
                <button className="haul-btn" type="button" onClick={flow.openCategory} aria-label={t.createCategory}><Plus size={18} />{t.createCategory}</button>
            </div>
            {!editor.bulk && <>
                <label className="haul-field">{t.quantity}<input className="haul-input" disabled={!supportsQuantity} value={editor.quantity} onChange={(e) => edit({ quantity: e.target.value })} maxLength={80} placeholder="2 kg" />{!supportsQuantity && <span className="haul-help">{quantitySupported === null ? t.quantityChecking : t.quantityUnavailable}</span>}</label>
                <label className="haul-field">{t.notes}<textarea className="haul-input" rows={3} value={editor.note} onChange={(e) => edit({ note: e.target.value })} maxLength={1000} /></label>
            </>}
            {editor.mode === 'create' ? <label className="haul-check"><input type="checkbox" checked={editor.addToList} onChange={(e) => edit({ addToList: e.target.checked })} />{t.addToList}</label>
                : <div><label className="haul-check"><input type="checkbox" checked={editor.updateCatalog} onChange={(e) => edit({ updateCatalog: e.target.checked })} />{t.updateCatalog}</label><p className="haul-help">{source === 'global' ? t.updateCatalogHint : t.catalogVariantHint}</p></div>}
            <ProductFeedbackNotice />
            {error && <div className="haul-error" role="alert">{error}</div>}
            {results.length > 0 && <div aria-live="polite"><h3 style={{ fontSize: 15 }}>{t.bulkResults}</h3><ul className="haul-bulk-results">{results.map(({ name, result: originalResult }, index) => { const result = currentResult(originalResult); return <li key={`${index}:${name}`}><span>{name}</span><span>{result.status === 'saved' ? t.created : result.status === 'exists' ? t.existing : result.status === 'pending' ? t.pendingSync : productErrorMessage(result.error, t)}</span></li>; })}</ul></div>}
            <div className="haul-form-actions">
                <button className="haul-btn" type="button" onClick={() => flow.setEditor(null)}>{editor.mode === 'create' ? t.done : t.cancel}</button>
                <button className="haul-btn haul-btn-primary" type="submit" disabled={busy || (editor.bulk && !editor.bulkNames.trim())}>{busy ? '…' : editor.mode === 'edit' ? t.saveChanges : editor.addToList ? t.createAndAdd : t.catalogOnly}</button>
            </div>
        </form>
    </AccessibleDialog>;
}
