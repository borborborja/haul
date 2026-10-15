import { describe, expect, it, vi } from 'vitest';
import type PocketBase from 'pocketbase';
import { syncLink } from './index';

type Link = Parameters<typeof syncLink>[2];
type Item = { id: string; name: string; checked: boolean; in_list: boolean; note?: string };
type BringItem = { name: string; specification: string };

function fixture(items: Item[] = [], purchase: BringItem[] = [], recently: BringItem[] = [], snapshot?: Link['snapshot']) {
    const link: Link = {
        id: 'link-1', collectionId: 'links', collectionName: 'bring_links',
        list: 'list-1', bring_list_uuid: 'bring-1', enabled: true, snapshot
    };
    const remote = { purchase, recently };
    const create = vi.fn(async (data: Omit<Item, 'id'>) => {
        const item = { ...data, id: `new-${items.length}` };
        items.push(item);
        return item;
    });
    const updateItem = vi.fn(async (id: string, changes: Partial<Item>) => {
        const item = items.find((candidate) => candidate.id === id)!;
        Object.assign(item, changes);
        return item;
    });
    const updateLink = vi.fn(async (_id: string, changes: Partial<Link>) => Object.assign(link, changes));
    const pb = {
        filter: () => 'list = "list-1"',
        collection: (name: string) => name === 'bring_links'
            ? { update: updateLink }
            : { getFullList: async () => structuredClone(items), create, update: updateItem }
    } as unknown as PocketBase;
    const bring = {
        getItems: vi.fn(async () => structuredClone(remote)),
        add: vi.fn(async (_list: string, name: string, specification: string) => {
            remote.recently = remote.recently.filter((item) => item.name !== name);
            remote.purchase.push({ name, specification });
        }),
        complete: vi.fn(async (_list: string, name: string) => {
            remote.purchase = remote.purchase.filter((item) => item.name !== name);
            remote.recently.push({ name, specification: '' });
        }),
        remove: vi.fn(async (_list: string, name: string) => {
            remote.purchase = remote.purchase.filter((item) => item.name !== name);
            remote.recently = remote.recently.filter((item) => item.name !== name);
        })
    };
    return { link, remote, items, create, updateItem, updateLink, bring, sync: () => syncLink(pb, bring as never, link) };
}

const milk = { name: 'Milk', specification: '2 litres' };
const localMilk = { id: 'milk-1', name: 'Milk', checked: false, in_list: true };
const activeSnapshot = { bringActive: ['milk'], pocketbaseNames: ['milk'], pocketbaseActive: ['milk'] };
const recentSnapshot = { bringActive: [], pocketbaseNames: ['milk'], pocketbaseActive: [] };

describe('Bring synchronization', () => {
    it('imports a Bring purchase once and snapshots the resulting state', async () => {
        const f = fixture([], [milk]);
        await f.sync();
        await f.sync();
        expect(f.create).toHaveBeenCalledOnce();
        expect(f.items[0]).toMatchObject({ name: 'Milk', in_list: true });
        expect(f.link.snapshot).toEqual(activeSnapshot);
        expect(f.bring.add).not.toHaveBeenCalled();
        expect(f.bring.complete).not.toHaveBeenCalled();
    });

    it('does not resurrect a local deletion from Bring', async () => {
        const f = fixture([], [milk], [], activeSnapshot);
        await f.sync();
        await f.sync();
        expect(f.create).not.toHaveBeenCalled();
        expect(f.bring.remove).toHaveBeenCalledOnce();
        expect(f.remote.purchase).toEqual([]);
        expect(f.link.snapshot?.pocketbaseNames).toEqual([]);
    });

    it('detects deletion immediately after the first import', async () => {
        const f = fixture([], [milk]);
        await f.sync();
        f.items.splice(0);
        await f.sync();
        expect(f.create).toHaveBeenCalledOnce();
        expect(f.bring.remove).toHaveBeenCalledOnce();
    });

    it('reactivates a purchased Bring item when added again locally', async () => {
        const f = fixture([{ ...localMilk }], [], [milk], recentSnapshot);
        await f.sync();
        await f.sync();
        expect(f.bring.add).toHaveBeenCalledOnce();
        expect(f.updateItem).not.toHaveBeenCalled();
        expect(f.link.snapshot).toEqual(activeSnapshot);
    });

    it('reactivates a local purchased item when added again in Bring', async () => {
        const f = fixture([{ ...localMilk, checked: true, in_list: false }], [milk], [], recentSnapshot);
        await f.sync();
        await f.sync();
        expect(f.updateItem).toHaveBeenCalledOnce();
        expect(f.items[0]).toMatchObject({ checked: false, in_list: true });
        expect(f.bring.complete).not.toHaveBeenCalled();
        expect(f.link.snapshot).toEqual(activeSnapshot);
    });

    it('propagates local completion exactly once', async () => {
        const f = fixture([{ ...localMilk, checked: true }], [milk], [], activeSnapshot);
        await f.sync();
        await f.sync();
        expect(f.bring.complete).toHaveBeenCalledOnce();
        expect(f.link.snapshot).toEqual(recentSnapshot);
    });

    it('propagates Bring completion without adding the item back', async () => {
        const f = fixture([{ ...localMilk }], [], [milk], activeSnapshot);
        await f.sync();
        await f.sync();
        expect(f.items[0]).toMatchObject({ checked: true, in_list: false });
        expect(f.bring.add).not.toHaveBeenCalled();
        expect(f.link.snapshot).toEqual(recentSnapshot);
    });

    it('propagates a Bring deletion without marking it purchased', async () => {
        const f = fixture([{ ...localMilk }], [], [], activeSnapshot);
        await f.sync();
        await f.sync();
        expect(f.items[0]).toMatchObject({ checked: false, in_list: false });
        expect(f.bring.add).not.toHaveBeenCalled();
    });

    it('supports snapshots from before active local state was recorded', async () => {
        const f = fixture([{ ...localMilk }], [], [milk], { bringActive: ['milk'], pocketbaseNames: ['milk'] });
        await f.sync();
        expect(f.items[0]).toMatchObject({ checked: true, in_list: false });
        expect(f.link.snapshot?.pocketbaseActive).toEqual([]);
    });
});
