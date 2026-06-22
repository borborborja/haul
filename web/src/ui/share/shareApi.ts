// Client for the public (unauthenticated) shared-list endpoints. These talk to
// the backend by token only — no PocketBase auth — so the share page can render
// for anyone with the link.

export type ShareMode = 'read' | 'shop' | 'plan';

export interface ShareItem {
    id: string;
    name: string;
    category: string;
    checked: boolean;
    note: string;
    addedBy?: string;
    checkedBy?: string;
}

export interface ShareCategory {
    key: string;
    icon: string;
    name: { es: string; ca: string; en: string };
}

export interface ShareSnapshot {
    list: { name: string };
    mode: ShareMode;
    items: ShareItem[];
    categories: ShareCategory[];
    // Full set of categories to choose from when adding (catalog + list custom).
    allCategories?: ShareCategory[];
}

// Same origin in the browser; the public page is always served by the backend.
const base = (path: string) => `${window.location.origin}${path}`;

async function json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

export const fetchSnapshot = (token: string) =>
    fetch(base(`/api/shoplist/public/${encodeURIComponent(token)}`)).then(json<ShareSnapshot>);

export const checkItem = (token: string, itemId: string, checked: boolean, displayName?: string) =>
    fetch(base(`/api/shoplist/public/${encodeURIComponent(token)}/items/${itemId}/check`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked, displayName }),
    }).then((r) => json<{ ok: boolean }>(r));

export const addItem = (token: string, name: string, category: string, displayName?: string) =>
    fetch(base(`/api/shoplist/public/${encodeURIComponent(token)}/items`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, displayName }),
    }).then((r) => json<{ id: string }>(r));

export const removeItem = (token: string, itemId: string) =>
    fetch(base(`/api/shoplist/public/${encodeURIComponent(token)}/items/${itemId}`), {
        method: 'DELETE',
    }).then((r) => json<{ ok: boolean }>(r));

// Build a public share URL for a token (used by the in-app share controls).
export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;
