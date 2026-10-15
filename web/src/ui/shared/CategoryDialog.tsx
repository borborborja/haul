import { productErrorMessage } from './productMessages';
import { useState } from 'react';
import { useShopStore } from '../../store/shopStore';
import { tt } from '../../data/i18n';
import { useProductFlow } from './productFlowContext';
import AccessibleDialog from './AccessibleDialog';
import ProductFeedbackNotice from './ProductFeedbackNotice';

export default function CategoryDialog({ onCreated }: { onCreated: (key: string) => void }) {
    const flow = useProductFlow();
    const t = tt(useShopStore((s) => s.lang));
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('📦');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return <AccessibleDialog title={t.createCategory} onClose={flow.closeCategory}>
        <form className="haul-form" onSubmit={async (e) => {
            e.preventDefault(); if (busy) return; if (!name.trim()) { setError(t.invalidName); return; }
            setBusy(true); setError('');
            try {
                const result = await useShopStore.getState().createCatalogCategory(name.trim(), icon.trim() || '📦');
                if (result.status === 'error' || !result.categoryKey) setError(productErrorMessage(result.error, t));
                else { flow.report(result, result.status === 'exists' ? t.existing : t.categoryCreated); onCreated(result.categoryKey); }
            } catch { setError(t.errorSaving); } finally { setBusy(false); }
        }}>
            <label className="haul-field">{t.categoryName}<input className="haul-input" data-autofocus value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
            <label className="haul-field">{t.categoryIcon}<input className="haul-input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={20} /></label>
            <ProductFeedbackNotice />
            {error && <div className="haul-error" role="alert">{error}</div>}
            <div className="haul-form-actions"><button type="button" className="haul-btn" onClick={flow.closeCategory}>{t.cancel}</button><button type="submit" className="haul-btn haul-btn-primary" disabled={busy}>{busy ? '…' : t.createCategory}</button></div>
        </form>
    </AccessibleDialog>;
}
