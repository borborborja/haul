import { useEffect, useMemo, useRef, useState } from 'react';
import { tt, detectLang, LANGS, type Lang } from '../../data/i18n';
import {
    fetchSnapshot, checkItem, addItem, removeItem, ShareApiError,
    type ShareSnapshot, type ShareItem, type ShareCategory, type ShareMode,
} from './shareApi';
import { attribution } from '../shared/attribution';

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
        try {
            const saved = localStorage.getItem('haul-share-lang');
            if (LANGS.some(l => l.code === saved)) return saved as Lang;
        } catch { /* storage can be unavailable in private browsing */ }
        return detectLang(navigator.language);
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
    const [draftQuantity, setDraftQuantity] = useState('');
    const [addError, setAddError] = useState('');
    const pending = useRef(0);
    const revision = useRef(0);
    const latestLoad = useRef(0);
    const activeLoad = useRef<number | null>(null);
    const pendingIds = useRef(new Set<string>());
    const [busyItems, setBusyItems] = useState<Set<string>>(new Set());

    // Public viewers are anonymous — ask their name once so their checks/adds are
    // attributed ("Comprado por…"). Persisted and reused across links.
    const [viewerName, setViewerName] = useState<string>(() => {
        try { return localStorage.getItem('haul-share-name') || ''; } catch { return ''; }
    });
    const [nameDraft, setNameDraft] = useState('');
    const saveName = (n: string) => {
        const v = n.trim();
        if (!v) return;
        setViewerName(v);
        try { localStorage.setItem('haul-share-name', v); } catch { /* ignore */ }
    };

    const load = async (initial = false) => {
        if (activeLoad.current !== null || pending.current > 0) return;
        const request = ++latestLoad.current;
        activeLoad.current = request;
        const startedAt = revision.current;
        try {
            const s = await fetchSnapshot(token);
            if (request !== latestLoad.current || startedAt !== revision.current || pending.current > 0) return;
            setSnap(s);
            setItems(s.items);
            setError(false);
        } catch (err) {
            if (request !== latestLoad.current) return;
            if (initial || (err instanceof ShareApiError && [403, 404].includes(err.status))) setError(true);
        } finally {
            if (activeLoad.current === request) activeLoad.current = null;
            if (request === latestLoad.current) {
                if (initial) setLoading(false);
                // A write may have completed while this older snapshot was in
                // flight. Fetch its result without waiting for the next poll.
                if (startedAt !== revision.current && pending.current === 0) void load(false);
            }
        }
    };

    useEffect(() => {
        load(true);
        const id = setInterval(() => load(false), 5000);
        return () => { clearInterval(id); latestLoad.current++; activeLoad.current = null; };
    }, [token]);

    useEffect(() => {
        document.documentElement.style.background = '#F2F7F4';
    }, []);

    // Offer "install as app" (PWA) when the browser allows it — discreet, only
    // shown if installable (not already installed / supported browser).
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    useEffect(() => {
        const onPrompt = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
        const onInstalled = () => setInstallPrompt(null);
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
    }, []);
    const installApp = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        try { await installPrompt.userChoice; } catch { /* ignore */ }
        setInstallPrompt(null);
    };

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

    const toggle = async (id: string, checked: boolean) => {
        if (!canCheck || pendingIds.current.has(id)) return;
        pendingIds.current.add(id);
        setBusyItems(new Set(pendingIds.current));
        const next = !checked;
        revision.current++;
        setItems((prev) => prev.map((x) => x.id === id ? { ...x, checked: next } : x));
        pending.current++;
        try { await checkItem(token, id, next, viewerName); } catch { /* refetch the authoritative value */ } finally {
            pending.current--;
            pendingIds.current.delete(id);
            setBusyItems(new Set(pendingIds.current));
            load(false);
        }
    };

    const remove = async (id: string) => {
        if (!canEdit || pendingIds.current.has(id)) return;
        pendingIds.current.add(id);
        setBusyItems(new Set(pendingIds.current));
        revision.current++;
        setItems((prev) => prev.filter((x) => x.id !== id));
        pending.current++;
        try { await removeItem(token, id); } catch { /* refetch */ } finally {
            pending.current--;
            pendingIds.current.delete(id);
            setBusyItems(new Set(pendingIds.current));
            load(false);
        }
    };

    const submitAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name || !canEdit) return;
        setDraft('');
        setAddError('');
        const quantity = snap?.quantitySupported ? draftQuantity.trim() : undefined;
        setDraftQuantity('');
        const cat = draftCat;
        const temp: ShareItem = { id: `tmp_${crypto.randomUUID()}`, name, category: cat, checked: false, note: '', quantity };
        pendingIds.current.add(temp.id);
        setBusyItems(new Set(pendingIds.current));
        revision.current++;
        setItems((prev) => [temp, ...prev]);
        pending.current++;
        try {
            const record = await addItem(token, name, cat, viewerName, quantity);
            setItems(prev => prev.map(i => i.id === temp.id ? { ...i, id: record.id } : i));
        } catch {
            setItems(prev => prev.filter(i => i.id !== temp.id));
            setDraft(current => current || name);
            setDraftQuantity(current => current || quantity || '');
            setAddError(t.errorSaving);
        } finally {
            pending.current--;
            pendingIds.current.delete(temp.id);
            setBusyItems(new Set(pendingIds.current));
            load(false);
        }
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
            {canCheck && !viewerName && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,35,26,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
                    <div style={{ width: '100%', maxWidth: 360, background: '#FBFAF6', borderRadius: 20, padding: 22, boxShadow: '0 20px 60px rgba(6,35,26,0.3)' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: MINT, fontWeight: 600, marginBottom: 10 }}>{t.yourNamePrompt}</div>
                        <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveName(nameDraft); }} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid rgba(6,35,26,0.16)', borderRadius: 12, padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: INK, marginBottom: 12 }} />
                        <button onClick={() => saveName(nameDraft)} disabled={!nameDraft.trim()} style={{ width: '100%', border: 'none', background: MINT, color: '#fff', borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: nameDraft.trim() ? 1 : 0.5 }}>{t.continueLabel}</button>
                    </div>
                </div>
            )}
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
                                        <ShareItemRow key={it.id} it={it} canCheck={canCheck} canEdit={canEdit}
                                            busy={busyItems.has(it.id)} onToggle={toggle} onRemove={remove} t={t} />
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}

                <footer style={{ textAlign: 'center', marginTop: 30, fontSize: 12, opacity: 0.55 }}>
                    {installPrompt && (
                        <div style={{ marginBottom: 12 }}>
                            <button onClick={installApp} style={{ border: `1px solid ${MINT}`, background: 'transparent', color: MINT, borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ⬇ {t.installApp}
                            </button>
                        </div>
                    )}
                    <a href="/" style={{ color: 'inherit', textDecoration: 'none', opacity: 0.75 }}>{L.madeWith}</a>
                </footer>
            </div>

            {canEdit && (
                <form onSubmit={submitAdd} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(251,250,246,0.92)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(6,35,26,0.08)', padding: '12px 14px' }}>
                    <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input aria-label={t.productName} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={L.addPh} style={{ flex: 1, border: '1px solid rgba(6,35,26,0.15)', borderRadius: 12, padding: '11px 14px', fontSize: 15, outline: 'none', background: '#fff', color: INK }} />
                        {addCategories.length > 0 && (
                            <select aria-label={t.category} value={draftCat} onChange={(e) => setDraftCat(e.target.value)} style={{ border: '1px solid rgba(6,35,26,0.15)', borderRadius: 12, padding: '0 10px', fontSize: 14, background: '#fff', color: INK, maxWidth: 140 }}>
                                <option value="">—</option>
                                {addCategories.map((c) => <option key={c.key} value={c.key}>{labelFor(c.key)}</option>)}
                            </select>
                        )}
                        {snap.quantitySupported && <input aria-label={t.quantity} value={draftQuantity} onChange={(e) => setDraftQuantity(e.target.value)} placeholder={t.quantity} maxLength={80} style={{ width: 90, minHeight: 44, border: '1px solid rgba(6,35,26,0.15)', borderRadius: 12, padding: '0 10px', font: 'inherit' }} />}
                        <button type="submit" style={{ border: 'none', background: MINT, color: '#fff', borderRadius: 12, padding: '0 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{t.add}</button>
                    </div>
                    {addError && <div role="alert" style={{ maxWidth: 620, margin: '8px auto 0', color: '#B42330' }}>{addError}</div>}
                </form>
            )}
        </div>
    );
}


function ShareItemRow({ it, canCheck, canEdit, busy, onToggle, onRemove, t }: {
    it: ShareItem; canCheck: boolean; canEdit: boolean; busy: boolean;
    onToggle: (id: string, checked: boolean) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
    t: ReturnType<typeof tt>;
}) {
    return (
        <div onClick={() => onToggle(it.id, it.checked)} style={{
            display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16,
            padding: '13px 15px', boxShadow: '0 0 16px rgba(6,35,26,0.06)', cursor: canCheck && !busy ? 'pointer' : 'default',
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
                {it.quantity && <div style={{ fontSize: 12, opacity: 0.7 }}>{t.quantity}: {it.quantity}</div>}
                {it.note && <div style={{ fontSize: 12, opacity: 0.5 }}>{it.note}</div>}
                {attribution(it, t) && <div style={{ fontSize: 12, color: MINT, fontWeight: 600 }}>{attribution(it, t)}</div>}
            </div>
            {canEdit && (
                <button disabled={busy} onClick={(e) => { e.stopPropagation(); onRemove(it.id); }} aria-label="remove" style={{ border: 'none', background: 'transparent', color: 'rgba(6,35,26,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            )}
        </div>
    );
}

const spin = '@keyframes haulspin{to{transform:rotate(360deg)}}';

function Center({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F7F4', fontFamily: 'DM Sans, sans-serif' }}>{children}</div>;
}
