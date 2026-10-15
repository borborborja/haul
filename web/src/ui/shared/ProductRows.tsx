import type { CSSProperties } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import type { ShopItem } from '../../types';
import { useHaulModel } from './model';
import { useProductFlow } from './productFlowContext';
import { attribution } from './attribution';
import { catColor } from '../theme';

export function ProductRow({ item, shopping = false }: { item: ShopItem; shopping?: boolean }) {
    const flow = useProductFlow();
    const m = useHaulModel();
    const t = m.t;
    const toggle = useShopStore((s) => s.toggleCheck);
    return <div className="haul-item" style={{ borderLeft: `4px solid ${catColor(item.category, m.categories[item.category]?.color)}` }}>
        {shopping && <button type="button" className="haul-item-check" role="checkbox" aria-checked={item.checked} aria-label={`${t.purchased}: ${item.name}`} onClick={() => toggle(item.id)}>{item.checked ? <Check size={20} /> : <span style={{ width: 19, height: 19, border: '2px solid currentColor', borderRadius: 6 }} />}</button>}
        <div className="haul-item-main"><div className="haul-item-name" style={{ textDecoration: shopping && item.checked ? 'line-through' : undefined }}>{item.name}</div>
            {item.quantity && <div className="haul-item-detail">{t.quantity}: {item.quantity}</div>}
            {item.note && <div className="haul-item-detail">{item.note}</div>}
            {attribution(item, t) && <div className="haul-item-detail">{attribution(item, t)}</div>}
        </div>
        <div className="haul-item-actions"><button type="button" className="haul-btn haul-btn-quiet" aria-label={`${t.edit}: ${item.name}`} onClick={() => flow.openEdit(item)}><Pencil size={17} /></button><button type="button" className="haul-btn haul-btn-quiet" aria-label={`${t.remove}: ${item.name}`} onClick={() => void flow.removeItem(item)}><Trash2 size={17} /></button></div>
    </div>;
}

export default function ProductRows({ shopping = false }: { shopping?: boolean }) {
    const m = useHaulModel();
    const flow = useProductFlow();
    const viewMode = useShopStore((s) => s.viewMode);
    const addBack = useShopStore((s) => s.addBackToList);
    return <div>
        <div className={!shopping ? 'haul-planning-board' : undefined}>
        {m.groups.map((group) => <section className="haul-group" key={group.key} aria-label={group.label} style={{ '--haul-category-color': group.color } as CSSProperties}>
            <div className="haul-group-heading"><span aria-hidden="true">{group.emoji}</span><h2>{group.label} <span className="haul-help">({group.count})</span></h2><button className="haul-btn haul-btn-quiet" onClick={() => flow.openCreate(group.key)}>+ {m.t.createProduct}</button></div>
            <div className={viewMode === 'grid' ? 'haul-item-grid' : undefined} style={viewMode !== 'grid' ? { display: 'flex', flexDirection: 'column', gap: viewMode === 'compact' ? 6 : 10 } : undefined}>{group.items.map((item) => <ProductRow key={item.id} item={item} shopping={shopping} />)}</div>
        </section>)}
        </div>
        {!m.groups.length && <div style={{ padding: '35px 0', textAlign: 'center' }}><p className="haul-help">{shopping && m.total > 0 ? m.t.allDoneTitle : m.t.addProducts}</p><button className="haul-btn haul-btn-primary" style={{ marginTop: 14 }} onClick={() => flow.setCatalogOpen(true)}>{m.t.addProducts}</button></div>}
        {!shopping && m.recent.length > 0 && <section><h2 style={{ fontSize: 15 }}>{m.t.previouslyUsed}</h2><div className="haul-product-chips">{m.recent.map((item) => <button className="haul-chip" key={item.id} onClick={() => addBack(item.id)}>+ {item.name}{item.quantity && ` · ${item.quantity}`}</button>)}</div></section>}
    </div>;
}
