import { useId, useRef } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel, catLabel } from './model';
import { useProductFlow } from './productFlowContext';
import { catalogMatches } from './productSearch';

export default function CatalogPanel({ onClose }: { onClose?: () => void }) {
    const flow = useProductFlow();
    const m = useHaulModel();
    const t = m.t;
    const items = useShopStore((s) => s.items);
    const disabledCategories = useShopStore((s) => s.disabledCategories);
    const disabledProducts = useShopStore((s) => s.disabledProducts);
    const resultsRef = useRef<HTMLDivElement>(null);
    const id = useId();
    const matches = catalogMatches(m.categories, flow.search, m.lang, disabledCategories, disabledProducts, items);
    const searchOn = !!flow.search.trim();
    const resultButtons = () => [...(resultsRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || [])];
    return <section className="haul-catalog" aria-label={t.addProducts}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><h2>{t.addProducts}</h2>{onClose && <button className="haul-btn haul-btn-quiet" aria-label={t.close} onClick={onClose}><X size={19} /></button>}</div>
        <div className="haul-search-wrap">
            <label htmlFor={`${id}-search`} className="haul-help">{t.searchProduct}</label>
            <div className="haul-search-input"><Search size={18} aria-hidden="true" /><input id={`${id}-search`} value={flow.search} placeholder={t.searchProduct} autoComplete="off" aria-controls={searchOn ? `${id}-results` : undefined} onChange={(e) => flow.setSearch(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && searchOn) { e.preventDefault(); resultButtons()[0]?.focus(); }
                if (e.key === 'Escape') flow.setSearch('');
                if (e.key === 'Enter' && flow.search.trim()) { e.preventDefault(); if (matches.length === 1) void flow.addExisting(matches[0].name, matches[0].key); else if (!matches.length) flow.openCreate(flow.activeBand, flow.search.trim()); else resultButtons()[0]?.focus(); }
            }} />{searchOn && <button className="haul-btn haul-btn-quiet" aria-label={t.clear} onClick={() => flow.setSearch('')}><X size={18} /></button>}</div>
            {searchOn && <div id={`${id}-results`} ref={resultsRef} className="haul-search-results" role="region" aria-label={t.searchResults} onKeyDown={(e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault(); const buttons = resultButtons(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            }}>
                {!matches.length && <p className="haul-help" style={{ padding: 12 }}>{t.noResults}</p>}
                {matches.map((match) => <button key={`${match.key}:${match.name}`} className="haul-search-result" disabled={match.inList} onClick={() => void flow.addExisting(match.name, match.key)}>
                    {match.inList ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}<span style={{ flex: 1 }}>{match.name}<span className="haul-item-detail" style={{ display: 'block' }}>{catLabel(match.key, m.lang, m.categories[match.key].names)}</span></span>{match.inList && <span className="haul-help">{t.alreadyInList}</span>}
                </button>)}
                <button className="haul-search-result" onClick={() => flow.openCreate(flow.activeBand, flow.search.trim())}><Plus size={17} aria-hidden="true" />{t.createProduct} «{flow.search.trim()}»</button>
            </div>}
        </div>
        <div><p className="haul-help" style={{ marginBottom: 8 }}>{t.chooseCategory}</p><div className="haul-category-chips">{m.bands.map((band) => <button key={band.key} className="haul-chip" aria-pressed={flow.activeBand === band.key} onClick={() => flow.setActiveBand(band.key)}><span aria-hidden="true">{band.emoji}</span>{band.label}</button>)}<button className="haul-chip" onClick={flow.openCategory}><Plus size={16} />{t.createCategory}</button></div></div>
        {flow.activeBand && <div><h3 style={{ margin: '0 0 9px', fontSize: 15 }}>{catLabel(flow.activeBand, m.lang, m.categories[flow.activeBand]?.names)}</h3><div className="haul-product-chips">{m.bandItems(flow.activeBand).map((item) => <button key={item.name} className="haul-chip" disabled={item.inList} aria-label={`${item.name}${item.inList ? ` · ${t.alreadyInList}` : ` · ${t.add}`}`} onClick={() => void flow.addExisting(item.name, flow.activeBand)}>{item.inList ? <Check size={15} /> : <Plus size={15} />}{item.name}</button>)}<button className="haul-btn haul-btn-primary" onClick={() => flow.openCreate(flow.activeBand)}><Plus size={16} />{t.createProduct}</button></div></div>}
        {!flow.activeBand && <button className="haul-btn haul-btn-primary" onClick={flow.openCategory}><Plus size={16} />{t.createCategory}</button>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button className="haul-btn" onClick={() => flow.openCreate(flow.activeBand, '', true)}>{t.bulkProducts}</button><button className="haul-btn haul-btn-quiet" onClick={() => { flow.setSettingsTab('catalog'); flow.setScreen('settings'); }}>{t.manageCatalog}</button></div>
    </section>;
}
