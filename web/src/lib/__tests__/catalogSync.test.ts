import { describe, expect, it, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { catalogVisibilityKey, matchesProduct, normalizeProductName, projectCatalog, sendCatalogEntry, type CatalogEntry } from '../catalogSync';

const entry: CatalogEntry = { id: 'abc123abc123abc', origin: 'https://a.test', listId: 'local', remoteListId: 'remote',
    collection: 'list_items', data: { name: 'Mango', category_key: 'fruit' }, deleted: false, revision: 1, acknowledged: 0, attempts: 0, modifiedAt: 1 };

describe('catalog identity and recovery', () => {
    it('normalizes search text without changing persisted identity or matching metadata', () => {
        expect(normalizeProductName('  CAFÈ  amb   llet  ')).toBe('cafe amb llet');
        expect(matchesProduct({ ca: 'Cafè', es: 'Café', en: 'Coffee', _catalogId: 'secret-id' }, 'cafe')).toBe(true);
        expect(matchesProduct({ ca: 'Cafè', es: 'Café', en: 'Coffee', _catalogId: 'secret-id' }, 'secret-id')).toBe(false);
        expect(catalogVisibilityKey({ ca: 'Llet', es: 'Leche', en: 'Milk', _catalogKind: 'global', _catalogId: 'milk' })).toBe('source:global:milk');
    });

    it('projects category names and custom identities without altering the base catalog', () => {
        const base = { fruit: { icon: '🍎', items: [] } };
        const customCategory = { ...entry, id: 'cat', collection: 'list_categories' as const, data: { key: 'cat_pets', name: 'Per als gats', icon: '🐈' } };
        const projected = projectCatalog(base, [entry, customCategory]);
        expect(projected.categories.fruit.items[0]).toMatchObject({ ca: 'Mango', _catalogId: entry.id });
        expect(projected.categories.cat_pets.names?.ca).toBe('Per als gats');
        expect(base.fruit.items).toEqual([]);
    });

    it('recovers a committed create whose response was lost using the same stable ID', async () => {
        let saved = false;
        const service = {
            getFullList: vi.fn().mockResolvedValue([]),
            create: vi.fn(async () => { saved = true; throw { status: 0 }; }),
            getOne: vi.fn(async (id: string) => saved ? { id, list: 'remote' } : Promise.reject({ status: 404 })),
            update: vi.fn().mockResolvedValue({}),
        };
        const client = { collection: () => service, filter: () => 'filter' } as unknown as PocketBase;
        expect(await sendCatalogEntry(entry, 'remote', client)).toBe(entry.id);
        expect(service.create).toHaveBeenCalledOnce();
        expect(service.create.mock.calls[0]).toBeDefined();
        expect(service.update).toHaveBeenCalledWith(entry.id, entry.data, { requestKey: null });
    });

    it('adopts a simultaneous exact duplicate and treats missing deletes as successful', async () => {
        const service = { getFullList: vi.fn().mockResolvedValue([{ id: 'existing' }]), create: vi.fn(), delete: vi.fn().mockRejectedValue({ status: 404 }) };
        const client = { collection: () => service, filter: () => 'filter' } as unknown as PocketBase;
        expect(await sendCatalogEntry(entry, 'remote', client)).toBe('existing');
        expect(service.create).not.toHaveBeenCalled();
        await expect(sendCatalogEntry({ ...entry, deleted: true, remoteId: 'existing' }, 'remote', client)).resolves.toBe('existing');
    });
});
