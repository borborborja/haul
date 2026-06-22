import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useShopStore } from '../../store/shopStore';
import { translations } from '../../data/constants';
import { LANGS } from '../../data/i18n';
import CategoryManager from './CategoryManager';
import ProductManager from './ProductManager';
import AdminSettings from './AdminSettings';
import ListsManager from './ListsManager';
import UsersManager from './UsersManager';
import UserSuggestionsManager from './UserSuggestionsManager';
import AdminUpdateBanner from './AdminUpdateBanner';
import { palette, cssVars, FONT_SANS, FONT_DISPLAY, FONT_MONO, ACCENT, ACCENT_INK } from '../../ui/theme';

interface AdminDashboardProps {
    onLogout: () => void;
}

type TabKey = 'lists' | 'users' | 'categories' | 'products' | 'suggestions' | 'settings';

const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
    const [activeTab, setActiveTab] = useState<TabKey>('lists');
    const [focusListId, setFocusListId] = useState<string | null>(null);
    const { isDark, lang, setLang, serverName } = useShopStore();
    const t = translations[lang] as any;
    const openList = (id: string) => { setFocusListId(id); setActiveTab('lists'); };

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'lists', label: t.tabLists },
        { key: 'users', label: t.tabUsers },
        { key: 'categories', label: t.tabCategories },
        { key: 'products', label: t.tabProducts },
        { key: 'suggestions', label: t.tabSuggestions || 'Suggeriments' },
        { key: 'settings', label: t.settings },
    ];

    return (
        <div style={{ ...cssVars(palette(isDark)), fontFamily: FONT_SANS, position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* top bar */}
            <div style={{ flex: 'none', height: 64, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 14, background: 'var(--surface)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={ACCENT_INK} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21c0-5 0-9 4-12" /><path d="M12 13c-4 0-7-2.5-7-6 3.2-.4 6 .8 7 4" /></svg>
                </div>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: 'var(--text)' }}>{serverName || 'Haul'}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: ACCENT, border: `1px solid ${ACCENT}66`, padding: '3px 8px', borderRadius: 999 }}>Admin</span>
                <div style={{ flex: 1 }} />
                <select value={lang} onChange={(e) => setLang(e.target.value as any)} aria-label="language" style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <button onClick={onLogout} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit' }}>
                    <LogOut size={17} /> {t.logout}
                </button>
            </div>

            {/* tab bar */}
            <div style={{ flex: 'none', display: 'flex', padding: '0 28px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', overflowX: 'auto' }}>
                {tabs.map((tab) => {
                    const on = activeTab === tab.key;
                    return <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, padding: '15px 4px', margin: '0 10px', borderBottom: `2px solid ${on ? ACCENT : 'transparent'}`, color: on ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{tab.label}</button>;
                })}
            </div>

            {/* content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '30px 36px', background: 'var(--bg)' }}>
                <div style={{ maxWidth: 1080, margin: '0 auto' }}>
                    <AdminUpdateBanner />
                    {activeTab === 'lists' && <ListsManager focusListId={focusListId} />}
                    {activeTab === 'users' && <UsersManager onOpenList={openList} />}
                    {activeTab === 'categories' && <CategoryManager />}
                    {activeTab === 'products' && <ProductManager />}
                    {activeTab === 'suggestions' && <UserSuggestionsManager />}
                    {activeTab === 'settings' && <AdminSettings />}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
