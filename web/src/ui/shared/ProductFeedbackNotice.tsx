import { useState } from 'react';
import { tt } from '../../data/i18n';
import { useShopStore } from '../../store/shopStore';
import { useProductFlow } from './productFlowContext';

export default function ProductFeedbackNotice() {
    const flow = useProductFlow();
    const t = tt(useShopStore((s) => s.lang));
    const [busy, setBusy] = useState(false);
    const feedback = flow.feedback;
    if (!feedback) return null;
    const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } finally { setBusy(false); } };
    return <div className="haul-inline-feedback" role={feedback.error ? 'alert' : 'status'} aria-live={feedback.error ? 'assertive' : 'polite'}>
        <span>{feedback.message}</span>
        {feedback.undo && <button type="button" className="haul-btn" disabled={busy} onClick={() => void run(feedback.undo!)}>{t.undo}</button>}
        {feedback.retry && <button type="button" className="haul-btn" disabled={busy} onClick={() => void run(feedback.retry!)}>{t.retry}</button>}
    </div>;
}
