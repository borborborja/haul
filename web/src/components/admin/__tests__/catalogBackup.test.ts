import { describe, expect, it } from 'vitest';
import { validateCatalogBackup } from '../catalogBackup';

function backup() {
    return {
        categories: [{ key: 'fruit', icon: '🍎', color: 'fruit', name_es: 'Fruta', name_ca: 'Fruita', name_en: 'Fruit', order: 1, hidden: false, i18n: { fr: 'Fruits' } }],
        items: [{ category_key: 'fruit', name_es: 'Fresas', name_ca: 'Maduixes', name_en: 'Strawberries', hidden: false, i18n: { fr: 'Fraises' } }],
    };
}

describe('catalog backup validation before replacing live data', () => {
    it('accepts current backups and legacy exports without optional metadata', () => {
        expect(() => validateCatalogBackup(backup())).not.toThrow();
        expect(() => validateCatalogBackup({ categories: [{ key: 'fruit' }], items: [{ category_key: 'fruit', name_es: 'Fresas', name_ca: 'Maduixes', name_en: 'Strawberries' }] })).not.toThrow();
    });

    it.each(['name_es', 'name_ca', 'name_en'] as const)('rejects a product missing the required %s field', key => {
        const data = backup();
        const item: Record<string, unknown> = data.items[0];
        delete item[key];
        expect(() => validateCatalogBackup(data)).toThrow();
        item[key] = '   ';
        expect(() => validateCatalogBackup(data)).toThrow();
    });

    it.each([
        ['key', 'k'.repeat(81)], ['icon', '🍎'.repeat(21)], ['color', 'x'.repeat(31)],
        ['name_es', 'a'.repeat(201)], ['order', '1'], ['order', Infinity], ['hidden', 'false'],
        ['i18n', { en: 42 }], ['i18n', []], ['i18n', { en: 'é'.repeat(40_000) }],
        ['i18n', { en: '<'.repeat(11_000) }],
    ])('rejects category fields that cannot be saved: %s', (key, value) => {
        const data = backup();
        Object.assign(data.categories[0], { [key as string]: value });
        expect(() => validateCatalogBackup(data)).toThrow();
    });

    it('counts Unicode characters consistently with PocketBase text fields', () => {
        const data = backup();
        data.items[0].name_ca = '🍎'.repeat(200);
        expect(() => validateCatalogBackup(data)).not.toThrow();
        data.items[0].name_ca += '🍎';
        expect(() => validateCatalogBackup(data)).toThrow();
    });

    it('rejects duplicate categories and orphan products', () => {
        const duplicate = backup();
        duplicate.categories.push({ ...duplicate.categories[0] });
        expect(() => validateCatalogBackup(duplicate)).toThrow();
        const orphan = backup();
        orphan.items[0].category_key = 'missing';
        expect(() => validateCatalogBackup(orphan)).toThrow();
    });

    it.each([null, [], {}, { categories: {}, items: [] }, { categories: [], items: [null] }])('rejects malformed backup structures', data => {
        expect(() => validateCatalogBackup(data)).toThrow();
    });
});
