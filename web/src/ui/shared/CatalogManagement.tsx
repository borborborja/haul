import { useState } from 'react';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { catalogVisibilityKeys, catalogVisibilityKey } from '../../lib/catalogSync';
import { useHaulModel, localized, catLabel } from './model';
import { useProductFlow } from './productFlowContext';

export default function CatalogManagement() {
    const m = useHaulModel();
    const flow = useProductFlow();
    const disabledProducts = useShopStore((s) => s.disabledProducts);
    const disabledCategories = useShopStore((s) => s.disabledCategories);
    const [showHidden, setShowHidden] = useState(false);
    const t = m.t;
    return <section aria-label={t.manageCatalog}>
        <h2 style={{ margin: '0 0 8px' }}>{t.manageCatalog}</h2><p className="haul-help">{t.manageCatalogSub}</p>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', margin: '16px 0' }}><button className="haul-btn haul-btn-primary" onClick={flow.openCategory}><Plus size={17} />{t.createCategory}</button><button className="haul-btn" onClick={() => flow.openCreate(flow.activeBand, '', true)}>{t.bulkProducts}</button></div>
        <label className="haul-check"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />{t.showHidden}</label>
        {Object.entries(m.categories).filter(([key]) => showHidden || !disabledCategories.includes(key)).map(([key, category]) => {
            const categoryOff = disabledCategories.includes(key);
            return <div className="haul-group" key={key} style={{ marginTop: 20 }}>
                <div className="haul-group-heading"><span aria-hidden="true">{category.icon}</span><h2>{catLabel(key, m.lang, category.names)}{categoryOff && <span className="haul-help"> · {t.hidden}</span>}</h2><button className="haul-btn haul-btn-quiet" onClick={() => void (categoryOff ? flow.showCategory(key) : flow.hideCategory(key))}>{categoryOff ? <Eye size={17} /> : <EyeOff size={17} />}{categoryOff ? t.reactivate : t.hide}</button></div>
                {!categoryOff && <button className="haul-btn" onClick={() => flow.openCreate(key)}><Plus size={16} />{t.createProduct}</button>}
                {category.items.filter((item) => showHidden || !catalogVisibilityKeys(item).some((value) => disabledProducts.includes(value))).map((item, index) => {
                    const off = catalogVisibilityKeys(item).some((value) => disabledProducts.includes(value));
                    const name = localized(item, m.lang);
                    return <div className="haul-catalog-row" key={`${catalogVisibilityKey(item)}:${index}`}><span className="haul-catalog-row-name">{name}{off && <span className="haul-help"> · {t.hidden}</span>}</span><button className="haul-btn haul-btn-quiet" aria-label={`${off ? t.reactivate : t.hide} ${name}`} onClick={() => void (off ? flow.showProduct(item) : flow.hideProduct(item))}>{off ? <Eye size={17} /> : <EyeOff size={17} />}{off ? t.reactivate : t.hide}</button></div>;
                })}
            </div>;
        })}
    </section>;
}
