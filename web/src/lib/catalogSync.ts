import type PocketBase from 'pocketbase';
import type { Categories, LocalizedItem } from '../types';

export type CatalogCollection = 'list_categories' | 'list_items' | 'list_disabled_products' | 'list_disabled_categories';

/** Durable desired state. Acknowledgements only cover the revision sent. */
export interface CatalogEntry {
    id: string;
    origin: string;
    listId: string;
    remoteListId: string | null;
    remoteId?: string;
    collection: CatalogCollection;
    data: Record<string, string>;
    deleted: boolean;
    revision: number;
    acknowledged: number;
    modifiedAt: number;
    attempts: number;
    retryAt?: number;
    error?: string;
    blocked?: boolean;
}

export const sameCatalogEntry = (a: CatalogEntry, b: CatalogEntry) => a.id === b.id && a.collection === b.collection &&
    a.origin === b.origin && a.listId === b.listId && a.remoteListId === b.remoteListId;

// Search normalization is deliberately independent of persisted canonical keys.
export const normalizeProductName = (name: string) =>
    name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const productNames = (item: LocalizedItem | string): string[] =>
    typeof item === 'string' ? [item] : Object.entries(item).filter(([key, value]) => !key.startsWith('_') && value).map(([, value]) => value);

export const catalogVisibilityKey = (item: LocalizedItem | string) => typeof item !== 'string' && item._catalogId && item._catalogKind
    ? `source:${item._catalogKind}:${item._catalogId}`
    : (typeof item === 'string' ? item : item.en || item.es || item.ca || '').trim().toLowerCase();

export const catalogVisibilityKeys = (item: LocalizedItem | string) => [catalogVisibilityKey(item),
    (typeof item === 'string' ? item : item.en || item.es || item.ca || '').trim().toLowerCase()];

export const matchesProduct = (item: LocalizedItem | string, name: string) =>
    productNames(item).some(value => normalizeProductName(value) === normalizeProductName(name));

export const catalogId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 15);

export function projectCatalog(base: Categories, entries: CatalogEntry[]) {
    const categories: Categories = Object.fromEntries(Object.entries(base).map(([key, cat]) => [key, { ...cat, items: [...cat.items] }]));
    const disabledProducts: string[] = [];
    const disabledCategories: string[] = [];
    for (const entry of entries.filter(e => e.collection === 'list_categories' && !e.deleted)) {
        const { key, icon, name } = entry.data;
        categories[key] = { ...categories[key], icon: icon || '📦', names: { ca: name || key, es: name || key, en: name || key }, items: categories[key]?.items || [] };
    }
    for (const entry of entries.filter(e => e.collection === 'list_items' && !e.deleted)) {
        const { category_key: key, name } = entry.data;
        const category = categories[key];
        if (category && !category.items.some(item => matchesProduct(item, name))) {
            category.items.push({ ca: name, es: name, en: name, _catalogId: entry.remoteId || entry.id, _catalogKind: 'custom' });
        }
    }
    for (const entry of entries.filter(e => !e.deleted)) {
        if (entry.collection === 'list_disabled_products') disabledProducts.push(entry.data.name);
        if (entry.collection === 'list_disabled_categories') disabledCategories.push(entry.data.key);
    }
    return { categories, disabledProducts, disabledCategories };
}

export const pendingCatalogEntries = (entries: CatalogEntry[]) => entries.filter(entry => entry.revision > entry.acknowledged);

export function catalogRetryable(error: unknown) {
    const status = (error as { status?: number })?.status || 0;
    return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function naturalCatalogFilter(entry: CatalogEntry, remoteListId: string, client: PocketBase) {
    const identity = entry.collection === 'list_categories' || entry.collection === 'list_disabled_categories'
        ? { key: entry.data.key }
        : entry.collection === 'list_items'
            ? { category_key: entry.data.category_key, name: entry.data.name }
            : { name: entry.data.name };
    const values = { list: remoteListId, ...identity };
    return client.filter(Object.keys(values).map(key => `${key} = {:${key}}`).join(' && '), values);
}

/** Stable client IDs make a POST retry safe even when the response was lost. */
export async function sendCatalogEntry(entry: CatalogEntry, remoteListId: string, client: PocketBase): Promise<string | undefined> {
    const service = client.collection(entry.collection);
    const findNatural = () => service.getFullList({ filter: naturalCatalogFilter(entry, remoteListId, client), requestKey: null });
    if (entry.deleted) {
        const records = entry.remoteId ? [{ id: entry.remoteId }] : await findNatural();
        for (const record of records) {
            try { await service.delete(record.id, { requestKey: null }); }
            catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
        }
        return entry.remoteId;
    }
    if (entry.remoteId) {
        try {
            await service.update(entry.remoteId, entry.data, { requestKey: null });
            return entry.remoteId;
        } catch (error) {
            if ((error as { status?: number }).status !== 404) throw error;
            // Another member can delete a suggestion or visibility record.
            // Reconcile the desired presence instead of retrying a missing ID.
        }
    }
    // Also adopts legacy/exact duplicates without overwriting another member.
    const matching = await findNatural();
    if (matching[0]) return matching[0].id;
    try {
        const record = await service.create({ id: entry.id, list: remoteListId, ...entry.data }, { requestKey: null });
        return record.id;
    } catch (error) {
        try {
            const record = await service.getOne(entry.id, { requestKey: null });
            if (record.list === remoteListId) {
                // A lost response may have accepted an older local revision.
                await service.update(record.id, entry.data, { requestKey: null });
                return record.id;
            }
        } catch { /* Look for a simultaneous create with the natural key. */ }
        const duplicate = await findNatural();
        if (duplicate[0]) return duplicate[0].id;
        throw error;
    }
}
