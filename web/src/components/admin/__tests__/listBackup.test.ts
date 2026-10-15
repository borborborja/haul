import { describe, expect, it, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { exportListBackup, importListBackup, parseListBackup, resetListCustomData, resetListItems } from '../listBackup';

type Row = { id: string; [key: string]: unknown };
function fixture() {
    const list = { id: 'list-1', invite_code: 'ABCDEF2345', name: 'Home', data: { emoji: '🏠', customSetting: true } };
    const rows: Record<string, Row[]> = {
        shopping_lists: [list], users: [{ id: 'owner-1', account_type: 'account' }], list_members: [],
        shopping_items: [], list_categories: [], list_items: [], list_disabled_products: [], list_disabled_categories: [],
    };
    const writes = vi.fn();
    const pb = {
        filter: vi.fn((_query, parameters) => `list:${parameters.list}`),
        collection: vi.fn((name: string) => ({
            getFullList: vi.fn(async ({ filter }: { filter?: string } = {}) => rows[name].filter(row => !filter || row.list === filter.slice(5)).map(row => structuredClone(row))),
            getOne: vi.fn(async (id: string) => structuredClone(rows[name].find(row => row.id === id))),
            getList: vi.fn(async (_page: number, _size: number, options?: { filter?: string }) => ({
                items: rows[name].filter(row => !options?.filter || row.account_type === 'account').slice(0, 1),
            })),
            create: vi.fn(async (data: Record<string, unknown>) => {
                writes('create', name, data);
                const record = { ...data, id: `${name}-${rows[name].length}` };
                rows[name].push(record);
                return record;
            }),
            update: vi.fn(async (id: string, data: Record<string, unknown>) => {
                writes('update', name, id, data);
                Object.assign(rows[name].find(row => row.id === id)!, data);
            }),
            delete: vi.fn(async (id: string) => {
                writes('delete', name, id);
                rows[name] = rows[name].filter(row => row.id !== id);
            }),
        })),
    } as unknown as PocketBase;
    return { pb, rows, list, writes };
}
const item = { name: 'Milk', category: 'dairy', checked: false, in_list: false, note: 'Oat milk' };
const valid = () => ({ listName: 'Imported', items: [item], customCategories: [{ key: 'special', name: 'Special', icon: '⭐' }], customItems: [{ category_key: 'special', name: 'My product' }], disabledProducts: ['milk'], disabledCategories: ['meat'] });

describe('list backup compatibility and validation', () => {
    it('preserves unchecked archived products and legacy checked semantics', () => {
        expect(parseListBackup({ items: [item] }).items[0].in_list).toBe(false);
        expect(parseListBackup({ items: [{ name: 'Legacy', checked: true }] }).items[0]).toMatchObject({ checked: true, in_list: false });
        expect(parseListBackup({ items: [{ name: 'Legacy', checked: false }] }).items[0].in_list).toBe(true);
    });
    it('preserves distinct stored duplicate items in a backup', () => {
        const parsed = parseListBackup({ items: [item, { ...item, note: 'Different quantity' }] });
        expect(parsed.items).toHaveLength(2);
        expect(parsed.items[1].note).toBe('Different quantity');
    });
    it('extracts custom rows from legacy categories without importing the global catalog', () => {
        const result = parseListBackup({ items: [], categories: {
            fruit: { icon: '🍎', items: [{ es: 'Manzana', ca: 'Poma', en: 'Apple' }, 'Pitahaya'] },
            custom: { icon: '⭐', items: ['My product'] },
        } }, { categoryKeys: ['fruit'], itemNames: ['Manzana', 'Poma', 'Apple'] });
        expect(result.customCategories).toEqual([{ key: 'custom', icon: '⭐', name: 'custom' }]);
        expect(result.customItems).toEqual([{ category_key: 'fruit', name: 'Pitahaya' }, { category_key: 'custom', name: 'My product' }]);
    });
    it('treats explicit empty row arrays as authoritative over an old blob', () => {
        const result = parseListBackup({ items: [], categories: { deleted: { icon: '⭐', items: ['Deleted product'] } }, customCategories: [], customItems: [] });
        expect(result.customCategories).toEqual([]);
        expect(result.customItems).toEqual([]);
    });
    it.each([
        { items: [{ ...item, name: '' }] }, { items: [{ ...item, name: 'x'.repeat(201) }] },
        { items: [{ ...item, note: 'x'.repeat(1001) }] }, { items: [{ ...item, checked: 'false' }] },
        { items: [{ ...item, in_list: 1 }] }, { items: [], listName: 'x'.repeat(121) },
        { items: [], code: 'bad' }, { items: [], data: [] },
        { items: [], customCategories: [{ key: '', icon: '⭐' }] },
        { items: [], customItems: [{ category_key: 'fruit' }] },
        { items: [], disabledProducts: ['x'.repeat(201)] },
        { items: [], disabledCategories: [null] },
    ])('rejects invalid records before import can write anything', async invalid => {
        const f = fixture();
        await expect(importListBackup(f.pb, invalid, 'overwrite', 'ABCDEFGH23', f.list)).rejects.toThrow();
        expect(f.pb.collection).not.toHaveBeenCalled();
        expect(f.writes).not.toHaveBeenCalled();
    });
});

describe('row-based list administration', () => {
    it('exports actual custom collections, disabled sets and complete planner metadata', async () => {
        const f = fixture();
        f.rows.shopping_items.push({ ...item, id: 'item-1', list: f.list.id });
        f.rows.list_categories.push({ id: 'cat-1', list: f.list.id, ...valid().customCategories[0] });
        f.rows.list_items.push({ id: 'product-1', list: f.list.id, ...valid().customItems[0] });
        f.rows.list_disabled_products.push({ id: 'disabled-1', list: f.list.id, name: 'milk' });
        f.rows.list_disabled_categories.push({ id: 'disabled-cat-1', list: f.list.id, key: 'meat' });
        const exported = await exportListBackup(f.pb, f.list);
        expect(exported).toMatchObject({ code: f.list.invite_code, listName: 'Home', data: f.list.data, items: [item], customCategories: valid().customCategories, customItems: valid().customItems, disabledProducts: ['milk'], disabledCategories: ['meat'] });
    });
    it('reset items deletes current rows while preserving list metadata', async () => {
        const f = fixture();
        f.rows.shopping_items.push({ ...item, id: 'item-1', list: f.list.id });
        f.rows.shopping_items.push({ ...item, id: 'other-item', list: 'other-list' });
        await resetListItems(f.pb, f.list);
        expect(f.rows.shopping_items.map(row => row.id)).toEqual(['other-item']);
        expect(f.list.data).toMatchObject({ emoji: '🏠', customSetting: true, items: [] });
    });
    it('reset custom data clears current custom rows and disabled sets while keeping shopping items', async () => {
        const f = fixture();
        f.rows.shopping_items.push({ ...item, id: 'item-1', list: f.list.id });
        for (const collection of ['list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories']) f.rows[collection].push({ id: collection, list: f.list.id });
        await resetListCustomData(f.pb, f.list);
        expect(f.rows.shopping_items).toHaveLength(1);
        for (const collection of ['list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories']) expect(f.rows[collection]).toEqual([]);
        expect(f.list.data).toMatchObject({ emoji: '🏠', customSetting: true, categories: {} });
    });
    it('merges repeatedly without duplicate shopping/custom/disabled rows', async () => {
        const f = fixture();
        await importListBackup(f.pb, valid(), 'merge', 'ABCDEFGH23', f.list);
        await importListBackup(f.pb, valid(), 'merge', 'ABCDEFGH23', f.list);
        for (const collection of ['shopping_items', 'list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories']) expect(f.rows[collection]).toHaveLength(1);
        expect(f.rows.shopping_items[0]).toMatchObject({ in_list: false, checked: false });
        expect(f.list.data).toMatchObject({ emoji: '🏠', customSetting: true, listName: 'Imported' });
        expect(f.list.name).toBe('Imported');
    });
    it('does not add duplicate products repeated inside one merge file', async () => {
        const f = fixture();
        const data = valid();
        data.items.push({ ...item });
        await importListBackup(f.pb, data, 'merge', 'ABCDEFGH23', f.list);
        expect(f.rows.shopping_items).toHaveLength(1);
    });
    it('overwrites current row collections without retaining stale custom rows', async () => {
        const f = fixture();
        for (const collection of ['shopping_items', 'list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories']) f.rows[collection].push({ id: collection, list: f.list.id });
        await importListBackup(f.pb, { items: [], customCategories: [], customItems: [] }, 'overwrite', 'ABCDEFGH23', f.list);
        for (const collection of ['shopping_items', 'list_categories', 'list_items', 'list_disabled_products', 'list_disabled_categories']) expect(f.rows[collection]).toEqual([]);
        expect(f.list.data).toMatchObject({ emoji: '🏠', customSetting: true });
    });
    it('can create a list owned by an existing guest when no permanent account exists', async () => {
        const f = fixture();
        f.rows.users[0].account_type = 'guest';
        const imported = await importListBackup(f.pb, valid(), 'new_code', 'ABCDEFGH23');
        expect(imported.code).toBe('ABCDEFGH23');
        expect(f.rows.list_members[0]).toMatchObject({ list: imported.id, user: 'owner-1', role: 'owner' });
    });
});
