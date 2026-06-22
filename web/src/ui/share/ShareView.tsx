import { useEffect, useMemo, useRef, useState } from 'react';
import { tt, detectLang, LANGS, type Lang } from '../../data/i18n';
import {
    fetchSnapshot, checkItem, addItem, removeItem,
    type ShareSnapshot, type ShareItem, type ShareCategory, type ShareMode,
} from './shareApi';

// Share-specific labels (the rest reuse the app's UIDict via tt(lang)). Only
// es/ca/en are spelled out; any other UI language falls back to English.
const SHARE_L: Record<'en' | 'es' | 'ca', { readonly: string; shop: string; plan: string; addPh: string; empty: string; gone: string; goneSub: string; madeWith: string }> = {
    en: { readonly: 'Read-only', shop: 'You can check items off', plan: 'You can add, remove and check items', addPh: 'Add a product…', empty: 'This list is empty', gone: 'Link unavailable', goneSub: 'This shared link no longer works.', madeWith: 'Made with Haul' },
    es: { readonly: 'Solo lectura', shop: 'Puedes marcar comprados', plan: 'Puedes añadir, quitar y marcar', addPh: 'Añade un producto…', empty: 'Esta lista está vacía', gone: 'Enlace no disponible', goneSub: 'Este enlace compartido ya no funciona.', madeWith: 'Hecho con Haul' },
    ca: { readonly: 'Només lectura', shop: 'Pots marcar comprats', plan: 'Pots afegir, treure i marcar', addPh: 'Afegeix un producte…', empty: 'Aquesta llista és buida', gone: 'Enllaç no disponible', goneSub: 'Aquest enllaç compartit ja no funciona.', madeWith: 'Fet amb Haul' },
};

const shareL = (lang: Lang) => SHARE_L[(lang as 'en') in SHARE_L ? (lang as 'en') : 'en'];
const catName = (c: ShareCategory, lang: Lang) =>
    (lang === 'es' || lang === 'ca' || lang === 'en') ? (c.name[lang] || c.name.en) : c.name.en;

const MINT = '#10B981';
const INK = '#06231A';

export default function ShareView() {
    const token = useMemo(() => decodeURIComponent(window.location.pathname.replace(/^\/s\//, '').replace(/\/$/, '')), []);
    const [lang, setLang] = useState<Lang>(() => {
        const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('haul-share-lang')) as Lang | null;
        return saved || detectLang(navigator.language);
    });
    const pickLang = (l: Lang) => { setLang(l); try { localStorage.setItem('haul-share-lang', l); } catch { /* ignore */ } };
    const t = tt(lang);
    const L = shareL(lang);

    const [snap, setSnap] = useState<ShareSnapshot | null>(null);
    const [items, setItems] = useState<ShareItem[]>([]);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState('');
    const [draftCat, setDraftCat] = useState('');
    const pending = useRef(0);

    const load = async (initial = false) => {
        try {
            const s = await fetchSnapshot(token);
            setSnap(s);
            // Don't clobber optimistic edits the server hasn't echoed yet.
            if (pending.current === 0) setItems(s.items);
            setError(false);
        } catch {
            if (initial) setError(true);
        } finally {
            if (initial) setLoading(false);
        }
    };

    useEffect(() => {
        load(true);
        const id = setInterval(() => load(false), 5000);
        return () => clearInterval(id);
    }, [token]);

    useEffect(() => {
        document.documentElement.style.background = '#F2F7F4';
    }, []);

    const mode: ShareMode = snap?.mode ?? 'read';
    const canCheck = mode === 'shop' || mode === 'plan';
    const canEdit = mode === 'plan';

    const catMeta = useMemo(() => {
        const map = new Map<string, ShareCategory>();
        snap?.categories.forEach((c) => map.set(c.key, c));
        snap?.allCategories?.forEach((c) => { if (!map.has(c.key)) map.set(c.key, c); });
        return map;
    }, [snap]);

    // Categories offered in the add picker: always the built-in defaults (so any
    // category is selectable even when the server catalog is empty), merged with
    // the server's catalog + the list's custom categories.
    const addCategories = useMemo<ShareCategory[]>(() => {
        const out: ShareCategory[] = [];
        const seen = new Set<string>();
        const push = (key: string, c?: ShareCategory) => {
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(c ?? { key, icon: '', name: { es: key, ca: key, en: key } });
        };
        (Object.keys(t.cats) as string[]).forEach((k) => push(k));
        (snap?.allCategories ?? []).forEach((c) => push(c.key, c));
        (snap?.categories ?? []).forEach((c) => push(c.key, c));
        return out;
    }, [snap, t]);

    // Built-in categories are richer/localized in the app's own dictionary;
    // fall back to the server metadata (custom categories) then the raw key.
    const labelFor = (key: string) => {
        const known = (t.cats as Record<string, string>)[key];
        if (known) return known;
        const meta = catMeta.get(key);
        return meta ? catName(meta, lang) : key;
    };

    const toggle = async (it: ShareItem) => {
        if (!canCheck) return;
        const next = !it.checked;
        setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, checked: next } : x));
        pending.current++;
        try { await checkItem(token, it.id, next); } catch { /* will resync on next poll */ } finally { pending.current--; }
    };

    const remove = async (it: ShareItem) => {
        if (!canEdit) return;
        setItems((prev) => prev.filter((x) => x.id !== it.id));
        pending.current++;
        try { await removeItem(token, it.id); } catch { /* resync */ } finally { pending.current--; }
    };

    const submitAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name || !canEdit) return;
        setDraft('');
        const cat = draftCat;
        const temp: ShareItem = { id: `tmp_${name}_${items.length}`, name, category: cat, checked: false, note: '' };
        setItems((prev) => [temp, ...prev]);
        pending.current++;
        try { await addItem(token, name, cat); } catch { /* resync */ } finally { pending.current--; load(false); }
    };

    if (loading) {
        return <Center><div style={{ width: 28, height: 28, border: `3px solid ${MINT}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'haulspin 0.8s linear infinite' }} /><style>{spin}</style></Center>;
    }
    if (error || !snap) {
        return <Center><div style={{ textAlign: 'center', color: INK }}><div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div><div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 20 }}>{L.gone}</div><div style={{ opacity: 0.6, marginTop: 6 }}>{L.goneSub}</div></div></Center>;
    }

    const total = items.length;
    const done = items.filter((i) => i.checked).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    // Group by category, preserving order; checked items sink within a group.
    const groups: { key: string; items: ShareItem[] }[] = [];
    const idx = new Map<string, number>();
    items.forEach((it) => {
        const k = it.category || 'other';
        if (!idx.has(k)) { idx.set(k, groups.length); groups.push({ key: k, items: [] }); }
        groups[idx.get(k)!].items.push(it);
    });
    groups.forEach((g) => g.items.sort((a, b) => Number(a.checked) - Number(b.checked)));

    const modeLabel = mode === 'read' ? L.readonly : mode === 'shop' ? L.shop : L.plan;

    return (
        <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #D6F0E5 0%, #F2F7F4 38%, #FBFAF6 100%)', fontFamily: 'DM Sans, system-ui, sans-serif', color: INK, paddingBottom: canEdit ? 96 : 40 }}>
            <style>{spin}</style>
            <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 18px 0' }}>
                <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: MINT, fontWeight: 600 }}>{modeLabel}</div>
                        <h1 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 30, margin: '4px 0 0', lineHeight: 1.1 }}>{snap.list.name || t.myList}</h1>
                    </div>
                    <select value={lang} onChange={(e) => pickLang(e.target.value as Lang)} aria-label="language" style={{ flexShrink: 0, marginTop: 2, border: '1px solid rgba(6,35,26,0.15)', background: '#fff', color: INK, borderRadius: 10, padding: '6px 8px', fontSize: 13, cursor: 'pointer' }}>
                        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
                    </select>
                </header>

                {total > 0 && (
                    <div style={{ marginBottom: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ fontWeight: 600 }}>{done === total ? t.allClear : t.leftN.replace('{n}', String(total - done))}</span>
                            <span style={{ opacity: 0.55 }}>{done}/{total}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 99, background: 'rgba(6,35,26,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: MINT, borderRadius: 99, transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                )}

                {total === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>{L.empty}</div>
                ) : (
                    groups.map((g) => {
                        const meta = catMeta.get(g.key);
                        const label = labelFor(g.key);
                        const icon = meta?.icon || '';
                        return (
                            <section key={g.key} style={{ marginBottom: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(6,35,26,0.5)', fontWeight: 600, margin: '0 0 8px 4px' }}>
                                    {icon && <span style={{ fontSize: 14 }}>{icon}</span>}{label}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {g.items.map((it) => (
                                        <div key={it.id} onClick={() => toggle(it)} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16,
                                            padding: '13px 15px', boxShadow: '0 0 16px rgba(6,35,26,0.06)', cursor: canCheck ? 'pointer' : 'default',
                                            opacity: it.checked ? 0.55 : 1, transition: 'opacity 0.2s',
                                        }}>
                                            <span style={{
                                                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                                border: it.checked ? `none` : `2px solid rgba(6,35,26,0.2)`,
                                                background: it.checked ? MINT : 'transparent', color: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                                            }}>{it.checked ? '✓' : ''}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 15, textDecoration: it.checked ? 'line-through' : 'none' }}>{it.name}</div>
                                                {it.note && <div style={{ fontSize: 12, opacity: 0.5 }}>{it.note}</div>}
                                            </div>
                                            {canEdit && (
                                                <button onClick={(e) => { e.stopPropagation(); remove(it); }} aria-label="remove" style={{ border: 'none', background: 'transparent', color: 'rgba(6,35,26,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}

                <footer style={{ textAlign: 'center', marginTop: 30, fontSize: 12, opacity: 0.4 }}>
                    <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>{L.madeWith}</a>
                </footer>
            </div>

            {canEdit && (
                <form onSubmit={submitAdd} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(251,250,246,0.92)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(6,35,26,0.08)', padding: '12px 14px' }}>
                    <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', gap: 8 }}>
                        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={L.addPh} style={{ flex: 1, border: '1px solid rgba(6,35,26,0.15)', borderRadius: 12, padding: '11px 14px', fontSize: 15, outline: 'none', background: '#fff', color: INK }} />
                        {addCategories.length > 0 && (
                            <select value={draftCat} onChange={(e) => setDraftCat(e.target.value)} style={{ border: '1px solid rgba(6,35,26,0.15)', borderRadius: 12, padding: '0 10px', fontSize: 14, background: '#fff', color: INK, maxWidth: 140 }}>
                                <option value="">—</option>
                                {addCategories.map((c) => <option key={c.key} value={c.key}>{labelFor(c.key)}</option>)}
                            </select>
                        )}
                        <button type="submit" style={{ border: 'none', background: MINT, color: '#fff', borderRadius: 12, padding: '0 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{t.add}</button>
                    </div>
                </form>
            )}
        </div>
    );
}

const spin = '@keyframes haulspin{to{transform:rotate(360deg)}}';

function Center({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F7F4', fontFamily: 'DM Sans, sans-serif' }}>{children}</div>;
}
