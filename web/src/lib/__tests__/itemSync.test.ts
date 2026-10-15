import { describe, expect, it } from 'vitest';
import { mergeRemoteItems, reconcileCreatedItem, type ItemRecord } from '../itemSync';
import type { ShopItem } from '../../types';

const item: ShopItem = { id: 'local_one', name: 'Milk', category: 'dairy', checked: false, note: '', inList: true };
const record: ItemRecord = { id: 'remote_one', name: 'Milk', category: 'dairy', checked: false, note: '', in_list: true, updated: '2026-10-15 10:00:00.000Z' };

describe('reconcileCreatedItem', () => {
    it('uploads edits made while the create was in flight', () => {
        const result = reconcileCreatedItem([{ ...item, checked: true, note: 'Two' }], item.id, record);
        expect(result.items[0]).toMatchObject({ id: record.id, checked: true, note: 'Two', dirty: true });
        expect(result.update).toMatchObject({ checked: true, note: 'Two' });
    });
    it('deletes a server item when its optimistic item was removed before creation finished', () => {
        expect(reconcileCreatedItem([], item.id, record).deleted).toBe(true);
    });
    it('accepts realtime acknowledgement followed by the create response without deleting it', () => {
        const first = reconcileCreatedItem([item], item.id, record);
        expect(first.update).toBeUndefined();
        const second = reconcileCreatedItem(first.items, item.id, record);
        expect(second.deleted).toBe(false);
        expect(second.items).toHaveLength(1);
    });
});

describe('mergeRemoteItems', () => {
    it('preserves offline edits and creates, while excluding pending deletions', () => {
        const dirty = { ...item, id: record.id, note: 'Keep me', dirty: true };
        const merged = mergeRemoteItems([item, dirty], [record, { ...record, id: 'deleted' }], ['deleted']);
        expect(merged).toEqual([item, dirty]);
    });
    it('keeps newer realtime versions and items added after the fetch started', () => {
        const newer = { ...item, id: record.id, checked: true, serverUpdated: Date.parse('2026-10-15T10:00:01Z') };
        const arrived = { ...item, id: 'new_remote' };
        expect(mergeRemoteItems([newer, arrived], [record], [], () => false, new Set([record.id])))
            .toEqual([arrived, newer]);
    });
    it('dates a new remote purchase from the server update and keeps identical polls stable', () => {
        const addedAt = Date.parse('2026-10-15T08:00:00Z');
        const checkedAt = Date.parse('2026-10-15T10:00:00Z');
        const oldItem = { ...item, id: record.id, updatedAt: addedAt, serverUpdated: addedAt };
        const purchased = { ...record, checked: true };
        const [merged] = mergeRemoteItems([oldItem], [purchased], []);
        // An article added hours ago must receive a fresh auto-clear interval
        // when another shopper buys it now.
        expect(merged).toMatchObject({ checked: true, updatedAt: checkedAt });
        const [polledAgain] = mergeRemoteItems([merged], [purchased], []);
        expect(polledAgain.updatedAt).toBe(checkedAt);
    });
    it('does not overwrite writes in flight', () => {
        const edited = { ...item, id: record.id, checked: true };
        expect(mergeRemoteItems([edited], [record], [], () => true)).toEqual([edited]);
    });
});
