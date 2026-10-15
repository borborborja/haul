import { useState } from 'react';
import { Plus, Settings, ChevronDown, List, AlignJustify, LayoutGrid, Clock, Trash2 } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel } from '../shared/model';
import { useProductFlow } from '../shared/productFlowContext';
import { useAutoClean } from '../shared/useAutoClean';
import ProgressRing from '../shared/ProgressRing';
import CatalogPanel from '../shared/CatalogPanel';
import ProductRows from '../shared/ProductRows';
import { ACCENT, ACCENT_INK, FONT_DISPLAY, segActive } from '../theme';
import ListSheet from '../shared/ListSheet';
import SettingsScreen from './SettingsScreen';

export default function PhoneApp(_props: { openSettings: () => void }) {
    const m = useHaulModel();
    const flow = useProductFlow();
    const { appMode, viewMode, listName, sync, isDark, setAppMode, setViewMode, clearCompleted } = useShopStore();
    const [showSheet, setShowSheet] = useState(false);
    const ac = useAutoClean();
    const t = m.t;
    const shopping = appMode === 'shopping';
    if (flow.screen === 'settings') return <SettingsScreen onClose={() => flow.setScreen('app')} />;
    return <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', color: 'var(--text)', background: 'var(--bg)' }}>
        <header style={{ padding: 'calc(env(safe-area-inset-top) + 10px) 20px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <button className="haul-btn haul-btn-quiet" onClick={() => setShowSheet(true)} aria-expanded={showSheet} style={{ paddingLeft: 0, textAlign: 'left', minWidth: 0 }}><span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 23, overflowWrap: 'anywhere' }}>{listName || t.myList}</span><ChevronDown size={18} />{sync.connected && <span title={t.connected} style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, flex: 'none' }} />}</button>
                <button className="haul-btn" aria-label={t.settings} onClick={() => flow.setScreen('settings')}><Settings size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}><div style={{ display: 'flex', flex: 1, background: 'var(--seg)', padding: 4, borderRadius: 14, gap: 4 }}>
                {([['planning', t.plan], ['shopping', t.shop]] as const).map(([mode, label]) => <button key={mode} className="haul-btn" aria-pressed={appMode === mode} onClick={() => setAppMode(mode)} style={{ flex: 1, border: 'none', ...(appMode === mode ? segActive(isDark) : { background: 'transparent', color: 'var(--muted)' }) }}>{label}</button>)}
            </div><button className="haul-btn haul-btn-primary" aria-label={t.addProducts} aria-expanded={flow.catalogOpen} onClick={() => flow.setCatalogOpen(!flow.catalogOpen)} style={{ minWidth: 52 }}><Plus size={22} color={ACCENT_INK} /></button></div>
        </header>
        {flow.catalogOpen && <div style={{ borderBottom: '1px solid var(--line)' }}><CatalogPanel onClose={() => flow.setCatalogOpen(false)} /></div>}
        {shopping && <div style={{ padding: '10px 20px' }}><div style={{ background: 'var(--surface)', padding: 17, border: '1px solid var(--line)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 18 }}><ProgressRing size={78} stroke={9} frac={m.frac} track="var(--seg)"><span style={{ fontWeight: 800, fontSize: 20 }}>{Math.round(m.frac * 100)}%</span></ProgressRing><div><div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 27 }}>{m.done} / {m.total}</div><p className="haul-help">{m.total - m.done > 0 ? t.leftN.replace('{n}', String(m.total - m.done)) : t.allClear}</p>{ac.active && <p className="haul-help"><Clock size={13} style={{ verticalAlign: 'middle' }} /> {t.autoclean} · {ac.label}</p>}</div></div></div>}
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}><span className="haul-help">{t.view}</span><div style={{ display: 'flex', gap: 3 }}>
            {([['list', List], ['compact', AlignJustify], ['grid', LayoutGrid]] as const).map(([view, Icon]) => <button key={view} className="haul-btn" aria-label={`${t.view}: ${view}`} aria-pressed={viewMode === view} onClick={() => setViewMode(view)} style={{ background: viewMode === view ? 'var(--seg)' : 'transparent' }}><Icon size={17} /></button>)}
        </div></div>
        <main style={{ padding: '0 20px 100px', flex: 1 }}><ProductRows shopping={shopping} />{shopping && m.done > 0 && <button className="haul-btn" onClick={clearCompleted} style={{ marginTop: 14 }}><Trash2 size={17} />{t.clear} {t.completed.toLowerCase()}</button>}</main>
        {showSheet && <ListSheet onClose={() => setShowSheet(false)} />}
    </div>;
}
