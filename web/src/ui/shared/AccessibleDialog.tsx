import { useLayoutEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useBackButton } from '../../hooks/useBackButton';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useShopStore } from '../../store/shopStore';
import { tt } from '../../data/i18n';

export default function AccessibleDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const t = tt(useShopStore((s) => s.lang));
    useScrollLock(true);
    useBackButton(onClose);
    useLayoutEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const el = ref.current;
        const siblings = [...(el?.closest('.haul-dialog-backdrop')?.parentElement?.children || [])].filter((node) => node !== el?.closest('.haul-dialog-backdrop'));
        const prior = siblings.map((node) => ({ node: node as HTMLElement, inert: (node as HTMLElement).inert }));
        prior.forEach(({ node }) => { node.inert = true; });
        (el?.querySelector<HTMLElement>('[data-autofocus]') || el)?.focus();
        return () => { prior.forEach(({ node, inert }) => { node.inert = inert; }); if (previous?.isConnected) previous.focus(); };
    }, []);
    return <div className="haul-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="haul-dialog" onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
            if (e.key !== 'Tab') return;
            const focusable = [...(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || [])];
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (!first) { e.preventDefault(); ref.current?.focus(); }
            else if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }}>
            <div className="haul-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="haul-btn haul-btn-quiet" aria-label={t.close} onClick={onClose}><X size={20} /></button></div>
            {children}
        </div>
    </div>;
}
