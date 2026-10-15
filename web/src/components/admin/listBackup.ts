import type PocketBase from 'pocketbase';

export interface BackupItem {
    name: string;
    category: string;
    checked: boolean;
    in_list: boolean;
    note: string;
    source: string;
    external_id: string;
}
export interface BackupCategory { key: string; icon: string; name: string }
export interface BackupProduct { category_key: string; name: string }
export interface LegacyCategory { icon?: string; items?: unknown[]; [key: string]: unknown }
export interface ListBackup {
    version: 2;
    code?: string;
    listName: string;
    data: Record<string, unknown>;
    items: BackupItem[];
    customCategories: BackupCategory[];
    customItems: BackupProduct[];
    disabledProducts: string[];
    disabledCategories: string[];
}
export interface BackupCatalog { categoryKeys: string[]; itemNames: string[] }
export interface BackupTarget { id: string; name?: string; invite_code?: string; data?: Record<string, unknown> }
interface ListRows {
    shopping_items: (BackupItem & { id: string })[];
    list_categories: (BackupCategory & { id: string })[];
    list_items: (BackupProduct & { id: string })[];
    list_disabled_products: { id: string; name: string }[];
    list_disabled_categories: { id: string; key: string }[];
}
const rowCollections = ['shopping_items', 'list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories'] as const;
type RowCollection = typeof rowCollections[number];
const normalize = (value: string) => value.trim().toLowerCase();

function object(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number, required = false): string {
    if (value === undefined && !required) return '';
    if (typeof value !== 'string' || [...value].length > max || (required && !value.trim())) throw new Error('Texto inválido en el backup');
    return value;
}
function boolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') throw new Error('Estado inválido en el backup');
    return value;
}
function array(value: unknown): unknown[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error('Formato de backup inválido');
    return value;
}
function jsonSize(value: unknown): number {
    const json = JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
    return new TextEncoder().encode(json).length;
}
function deduplicate<T>(rows: T[], key: (row: T) => string): T[] {
    return [...new Map(rows.map(row => [key(row), row])).values()];
}
const itemKey = (row: { name: string; category: string }) => JSON.stringify([row.category, normalize(row.name)]);
const productKey = (row: BackupProduct) => JSON.stringify([row.category_key, normalize(row.name)]);

// Normalize both the row-based format and older exports which embedded the
// complete planner under categories. Validate everything before any deletion.
export function parseListBackup(raw: unknown, catalog: BackupCatalog = { categoryKeys: [], itemNames: [] }): ListBackup {
    if (!object(raw) || !Array.isArray(raw.items)) throw new Error('Formato de backup inválido');
    const data = raw.data === undefined ? {} : raw.data;
    if (!object(data)) throw new Error('Metadatos de lista inválidos');
    const listName = text(raw.listName ?? data.listName ?? '', 120);
    const code = raw.code === undefined || raw.code === '' ? undefined : text(raw.code, 10, true);
    if (code !== undefined && [...code].length !== 10) throw new Error('Código de lista inválido');
    const metadata: Record<string, unknown> = { ...data, ...(listName ? { listName } : {}) };
    const categories = raw.categories ?? metadata.categories;
    if (categories !== undefined && !object(categories)) throw new Error('Categorías inválidas');
    if (categories !== undefined) metadata.categories = categories;
    if (jsonSize(metadata) > 262_144) throw new Error('Metadatos de lista demasiado grandes');
    const items = raw.items.map(row => {
        if (!object(row)) throw new Error('Producto inválido');
        const checked = boolean(row.checked, false);
        return {
            name: text(row.name, 200, true), category: text(row.category, 80), checked,
            // Old exports did not retain archived unchecked planner items.
            in_list: boolean(row.in_list, !checked), note: text(row.note, 1000),
            source: text(row.source, 30), external_id: text(row.external_id, 200),
        };
    });
    const customCategories = array(raw.customCategories).map(row => {
        if (!object(row)) throw new Error('Categoría personalizada inválida');
        return { key: text(row.key, 80, true), icon: text(row.icon, 20), name: text(row.name, 200) };
    });
    const customItems = array(raw.customItems).map(row => {
        if (!object(row)) throw new Error('Producto personalizado inválido');
        return { category_key: text(row.category_key, 80, true), name: text(row.name, 200, true) };
    });
    // Explicit row arrays are authoritative, including empty arrays. Rebuilding
    // from an old blob would resurrect products deleted since the migration.
    if (object(categories) && (raw.customCategories === undefined || raw.customItems === undefined)) {
        const catalogKeys = new Set(catalog.categoryKeys);
        const catalogNames = new Set(catalog.itemNames.map(normalize));
        for (const [key, category] of Object.entries(categories)) {
            text(key, 80, true);
            if (!object(category)) throw new Error('Categoría antigua inválida');
            const icon = text(category.icon, 20);
            if (raw.customCategories === undefined && !catalogKeys.has(key)) {
                customCategories.push({ key, icon, name: text(category.name ?? key, 200) });
            }
            for (const item of array(category.items)) {
                const name = typeof item === 'string' ? item : object(item) ? item.es || item.ca || item.en : undefined;
                const clean = text(name, 200, true);
                if (raw.customItems === undefined && !catalogNames.has(normalize(clean))) customItems.push({ category_key: key, name: clean });
            }
        }
    }
    const disabledProducts = array(raw.disabledProducts).map(name => text(name, 200, true));
    const disabledCategories = array(raw.disabledCategories).map(key => text(key, 80, true));
    return {
        version: 2, code, listName, data: metadata,
        items, customCategories: deduplicate(customCategories, row => row.key),
        customItems: deduplicate(customItems, productKey),
        disabledProducts: [...new Set(disabledProducts)], disabledCategories: [...new Set(disabledCategories)],
    };
}

export async function loadListRows(pb: PocketBase, listId: string) {
    const filter = pb.filter('list = {:list}', { list: listId });
    const entries = await Promise.all(rowCollections.map(async collection => [collection, await pb.collection(collection).getFullList({ filter })] as const));
    return Object.fromEntries(entries) as unknown as ListRows;
}

export async function exportListBackup(pb: PocketBase, list: BackupTarget): Promise<ListBackup> {
    list = await pb.collection('shopping_lists').getOne<BackupTarget>(list.id);
    const rows = await loadListRows(pb, list.id);
    return parseListBackup({
        version: 2, code: list.invite_code, listName: list.name || list.data?.listName || '', data: list.data || {},
        items: rows.shopping_items,
        customCategories: rows.list_categories,
        customItems: rows.list_items,
        disabledProducts: rows.list_disabled_products.map(row => row.name),
        disabledCategories: rows.list_disabled_categories.map(row => row.key),
    });
}

export async function resetListItems(pb: PocketBase, list: BackupTarget): Promise<void> {
    list = await pb.collection('shopping_lists').getOne<BackupTarget>(list.id);
    const items = await pb.collection('shopping_items').getFullList({ filter: pb.filter('list = {:list}', { list: list.id }) });
    for (const item of items) await pb.collection('shopping_items').delete(item.id);
    await pb.collection('shopping_lists').update(list.id, { data: { ...list.data, items: [] } });
}

export async function resetListCustomData(pb: PocketBase, list: BackupTarget): Promise<void> {
    list = await pb.collection('shopping_lists').getOne<BackupTarget>(list.id);
    const rows = await loadListRows(pb, list.id);
    for (const collection of rowCollections.filter(name => name !== 'shopping_items')) {
        for (const row of rows[collection]) await pb.collection(collection).delete(row.id);
    }
    await pb.collection('shopping_lists').update(list.id, { data: { ...list.data, categories: {} } });
}

function mergedData(current: Record<string, unknown>, incoming: Record<string, unknown>, merge: boolean) {
    const data = { ...current, ...incoming };
    if (merge && object(current.categories) && object(incoming.categories)) {
        data.categories = { ...current.categories, ...incoming.categories };
    }
    if (jsonSize(data) > 262_144) throw new Error('Metadatos de lista demasiado grandes');
    return data;
}

export async function importListBackup(pb: PocketBase, raw: unknown, strategy: 'new_code' | 'overwrite' | 'merge', newCode: string, target?: BackupTarget): Promise<{ id: string; code: string }> {
    const backup = parseListBackup(raw);
    const merge = strategy === 'merge';
    let list = strategy === 'new_code' ? undefined : target;
    // Refresh the source of metadata before patching it, preserving fields such
    // as the emoji that were not included in older export formats.
    if (list) list = await pb.collection('shopping_lists').getOne<BackupTarget>(list.id);
    const data = mergedData(list?.data || {}, backup.data, merge);
    const rows = list ? await loadListRows(pb, list.id) : undefined;
    if (!list) {
        const accounts = await pb.collection('users').getList(1, 1, { filter: "account_type = 'account'" });
        const users = accounts.items.length ? accounts : await pb.collection('users').getList(1, 1);
        const owner = users.items[0];
        if (!owner) throw new Error('Crea una cuenta de usuario antes de importar una lista nueva.');
        const created = await pb.collection('shopping_lists').create({ owner: owner.id, invite_code: newCode, name: backup.listName || 'Imported list', data });
        try {
            await pb.collection('list_members').create({ list: created.id, user: owner.id, role: 'owner' });
        } catch (error) {
            await pb.collection('shopping_lists').delete(created.id);
            throw error;
        }
        list = { ...created, invite_code: newCode };
    } else {
        await pb.collection('shopping_lists').update(list.id, { data, ...(backup.listName ? { name: backup.listName } : {}) });
        if (!merge && rows) {
            for (const collection of rowCollections) {
                for (const row of rows[collection]) await pb.collection(collection).delete(row.id);
            }
        }
    }
    const targetList = list;
    const seenItems = new Set(merge ? rows?.shopping_items.map(row => itemKey({ name: row.name, category: row.category })) : []);
    const seenCategories = new Set(merge ? rows?.list_categories.map(row => row.key) : []);
    const seenProducts = new Set(merge ? rows?.list_items.map(row => productKey({ category_key: row.category_key, name: row.name })) : []);
    const seenDisabledProducts = new Set(merge ? rows?.list_disabled_products.map(row => row.name) : []);
    const seenDisabledCategories = new Set(merge ? rows?.list_disabled_categories.map(row => row.key) : []);
    async function add(collection: RowCollection, entries: unknown[]) {
        for (const entry of entries) await pb.collection(collection).create({ ...(entry as Record<string, unknown>), list: targetList.id });
    }
    await add('shopping_items', backup.items.filter(row => {
        if (!merge) return true;
        const key = itemKey(row);
        if (seenItems.has(key)) return false;
        seenItems.add(key);
        return true;
    }));
    await add('list_categories', backup.customCategories.filter(row => !seenCategories.has(row.key)));
    await add('list_items', backup.customItems.filter(row => !seenProducts.has(productKey(row))));
    await add('list_disabled_products', backup.disabledProducts.filter(name => !seenDisabledProducts.has(name)).map(name => ({ name })));
    await add('list_disabled_categories', backup.disabledCategories.filter(key => !seenDisabledCategories.has(key)).map(key => ({ key })));
    return { id: list.id, code: list.invite_code || newCode };
}
