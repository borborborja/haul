import { Plus, Settings, Sun, Moon, List, AlignJustify, LayoutGrid, Trash2, Clock } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { useHaulModel } from '../shared/model';
import { useProductFlow } from '../shared/productFlowContext';
import { useAutoClean } from '../shared/useAutoClean';
import CatalogPanel from '../shared/CatalogPanel';
import ProductRows from '../shared/ProductRows';
import ProgressRing from '../shared/ProgressRing';
import Avatar from '../shared/Avatar';
import { ACCENT, ACCENT_INK, FONT_DISPLAY, segActive } from '../theme';
import DesktopSettings from './DesktopSettings';

export default function DesktopApp(_props: { openSettings: () => void }) {
    const m = useHaulModel();
    const flow = useProductFlow();
    const { appMode, listName, auth, sync, isDark, viewMode, setAppMode, setViewMode, clearCompleted, switchList, createList, setTheme, autoClearEnabled, setAutoClearEnabled } = useShopStore();
    const ac = useAutoClean();
    const t = m.t;
    const shopping = appMode === 'shopping';
    return <div style={{ display: 'flex', width: '100%', height: '100dvh', color: 'var(--text)', background: 'var(--bg)', overflow: 'hidden' }}>
        <aside aria-label={t.myList} style={{ width: 225, boxSizing: 'border-box', flex: 'none', padding: '24px 15px', background: 'var(--sidebar)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14, paddingLeft: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT_INK} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c0-5 0-9 4-12" /><path d="M12 13c-4 0-7-2.5-7-6 3.2-.4 6 .8 7 4" /></svg>
                </div>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: 'var(--text)' }}>Haul</span>
            </div>
            <span className="haul-help" style={{ padding: '0 8px' }}>{t.myList}</span>
            {m.listSummaries.map((list) => <button key={list.id} className="haul-btn" onClick={() => switchList(list.id)} aria-current={list.active ? 'page' : undefined} style={{ textAlign: 'left', justifyContent: 'start', background: list.active ? 'var(--surface)' : 'transparent' }}><span aria-hidden="true">{list.emoji}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{list.name || t.myList}<span className="haul-item-detail" style={{ display: 'block' }}>{list.progress}</span></span></button>)}
            <button className="haul-btn haul-btn-quiet" onClick={() => { const name = window.prompt(t.enterListName); if (name !== null) createList(name.trim() || null, '🛒'); }}><Plus size={17} />{t.createList}</button>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}><div style={{ display: 'flex', gap: 6 }}><button className="haul-btn" aria-pressed={!isDark} onClick={() => setTheme('light')}><Sun size={16} />{t.light}</button><button className="haul-btn" aria-pressed={isDark} onClick={() => setTheme('dark')}><Moon size={16} />{t.dark}</button></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={auth.username || auth.email} url={auth.avatarUrl} color={auth.avatarColor} size={30} /><span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: 13 }}>{auth.username || 'Haul'}<span className="haul-item-detail" style={{ display: 'block' }}>{sync.connected ? t.connected : t.localMode}</span></span><button className="haul-btn" aria-label={t.settings} onClick={() => flow.setScreen('settings')}><Settings size={18} /></button></div>
            </div>
        </aside>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {flow.screen === 'settings' ? <DesktopSettings onClose={() => flow.setScreen('app')} /> : <>
                <header style={{ padding: '20px 25px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><h1 style={{ margin: 0, flex: 1, fontFamily: FONT_DISPLAY, fontSize: 27, minWidth: 100, overflowWrap: 'anywhere' }}>{listName || t.myList}</h1><div style={{ display: 'flex', background: 'var(--seg)', borderRadius: 14, padding: 4, gap: 4 }}>{([['planning', t.plan], ['shopping', t.shop]] as const).map(([mode, label]) => <button key={mode} className="haul-btn" aria-pressed={appMode === mode} onClick={() => setAppMode(mode)} style={{ border: 'none', ...(appMode === mode ? segActive(isDark) : { background: 'transparent' }) }}>{label}</button>)}</div><button className="haul-btn haul-btn-primary" aria-expanded={flow.catalogOpen} onClick={() => flow.setCatalogOpen(!flow.catalogOpen)}><Plus size={18} />{t.addProducts}</button></header>
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    <main style={{ flex: 1, minWidth: 0, padding: 23, overflowY: 'auto', paddingBottom: 110 }}>
                        {shopping && <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}><ProgressRing size={100} stroke={10} frac={m.frac} track="var(--seg)"><span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 23 }}>{Math.round(m.frac * 100)}%</span></ProgressRing><div><div style={{ fontSize: 22, fontWeight: 750 }}>{m.done} / {m.total}</div><p className="haul-help">{m.total - m.done > 0 ? t.leftN.replace('{n}', String(m.total - m.done)) : t.allClear}</p><label className="haul-check"><input type="checkbox" checked={autoClearEnabled} onChange={(e) => setAutoClearEnabled(e.target.checked)} />{t.autoclean}</label>{ac.active && <p className="haul-help"><Clock size={13} /> {ac.label}</p>}</div></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 8 }}><span className="haul-help">{t.view}</span><div style={{ display: 'flex', gap: 4 }}>{([['list', List], ['compact', AlignJustify], ['grid', LayoutGrid]] as const).map(([view, Icon]) => <button key={view} className="haul-btn" aria-label={`${t.view}: ${view}`} aria-pressed={viewMode === view} onClick={() => setViewMode(view)} style={{ background: viewMode === view ? 'var(--seg)' : 'transparent' }}><Icon size={17} /></button>)}</div></div>
                        <ProductRows shopping={shopping} />{shopping && m.done > 0 && <button className="haul-btn" onClick={clearCompleted} style={{ marginTop: 14 }}><Trash2 size={17} />{t.clear} {t.completed.toLowerCase()}</button>}
                    </main>
                    {flow.catalogOpen && <aside style={{ width: 330, flex: 'none', borderLeft: '1px solid var(--line)', overflowY: 'auto', paddingBottom: 100 }}><CatalogPanel onClose={() => flow.setCatalogOpen(false)} /></aside>}
                </div>
            </>}
        </div>
    </div>;
}
