import { describe, expect, it, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { syncLink } from './index';

describe('Bring synchronization', () => {
    it('imports a Bring purchase once and records a stable snapshot', async () => {
        const create = vi.fn().mockResolvedValue({ id: 'new-item' });
        const update = vi.fn().mockResolvedValue({});
        const collections = {
            bring_links: { update },
            shopping_items: { getFullList: vi.fn().mockResolvedValue([]), create }
        };
        const pb = {
            collection: (name: keyof typeof collections) => collections[name],
            filter: () => 'list = "list-1"'
        } as unknown as PocketBase;
        const bring = {
            getItems: vi.fn().mockResolvedValue({
                purchase: [{ name: 'Milk', specification: '2 litres' }],
                recently: []
            }),
            add: vi.fn(),
            complete: vi.fn(),
            remove: vi.fn()
        };

        await syncLink(pb, bring as never, {
            id: 'link-1',
            collectionId: 'links',
            collectionName: 'bring_links',
            list: 'list-1',
            bring_list_uuid: 'bring-1',
            enabled: true
        });

        expect(create).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Milk', in_list: true }));
        expect(update).toHaveBeenLastCalledWith('link-1', expect.objectContaining({
            status: 'ok',
            snapshot: { bringActive: ['milk'], pocketbaseNames: [] }
        }));
    });
});
