import 'dotenv/config';
import Bring from 'bring-shopping';
import PocketBase, { type RecordModel } from 'pocketbase';

const PB_URL = process.env.PB_URL ?? 'http://shoplist:8090';
const PB_EMAIL = process.env.PB_SERVICE_EMAIL;
const PB_PASSWORD = process.env.PB_SERVICE_PASSWORD;
const BRING_EMAIL = process.env.BRING_EMAIL;
const BRING_PASSWORD = process.env.BRING_PASSWORD;
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 60_000);

interface BringLink extends RecordModel {
    list: string;
    bring_list_uuid: string;
    enabled: boolean;
    snapshot?: SyncSnapshot;
}

interface ShoppingItem extends RecordModel {
    list: string;
    name: string;
    note: string;
    category: string;
    checked: boolean;
    in_list: boolean;
}

interface SyncSnapshot {
    bringActive: string[];
    pocketbaseNames: string[];
    pocketbaseActive?: string[];
}

const normalize = (value: string) => value.trim().toLowerCase();
const uniqueNames = (values: string[]) => [...new Set(values.map(normalize).filter(Boolean))].sort();
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class BringAdapter {
    private readonly client: Bring;

    constructor(email: string, password: string) {
        this.client = new Bring({ mail: email, password });
    }

    login() {
        return this.client.login();
    }

    getItems(listUuid: string) {
        return this.client.getItems(listUuid);
    }

    add(listUuid: string, name: string, note: string) {
        return this.client.saveItem(listUuid, name, note);
    }

    complete(listUuid: string, name: string) {
        return this.client.moveToRecentList(listUuid, name);
    }

    remove(listUuid: string, name: string) {
        return this.client.removeItem(listUuid, name);
    }
}

export async function syncLink(pb: PocketBase, bring: BringAdapter, link: BringLink) {
    await pb.collection('bring_links').update(link.id, { status: 'syncing', last_error: '' });

    const bringItems = await bring.getItems(link.bring_list_uuid);
    const pocketbaseItems = await pb.collection('shopping_items').getFullList<ShoppingItem>({
        filter: pb.filter('list = {:list}', { list: link.list })
    });

    const bringActive = new Map(bringItems.purchase.map((item) => [normalize(item.name), item]));
    const bringRecent = new Map(bringItems.recently.map((item) => [normalize(item.name), item]));
    const pbByName = new Map(pocketbaseItems.map((item) => [normalize(item.name), item]));
    const previous = link.snapshot ?? { bringActive: [], pocketbaseNames: [] };
    const previousBring = new Set(previous.bringActive);
    const previousPocketBase = new Set(previous.pocketbaseNames);
    const previousActive = previous.pocketbaseActive ? new Set(previous.pocketbaseActive) : undefined;

    for (const name of new Set([...bringActive.keys(), ...bringRecent.keys(), ...pbByName.keys()])) {
        let local = pbByName.get(name);
        const active = bringActive.get(name);
        const recent = bringRecent.get(name);

        // Process local deletions before importing remote items, otherwise a
        // deleted product is immediately recreated from the stale Bring copy.
        if (!local && previousPocketBase.has(name)) {
            if (active || recent) {
                await bring.remove(link.bring_list_uuid, (active ?? recent)!.name);
                bringActive.delete(name);
                bringRecent.delete(name);
            }
            continue;
        }

        if (!local) {
            const remote = active ?? recent;
            if (!remote) continue;
            const created = await pb.collection('shopping_items').create<ShoppingItem>({
                list: link.list,
                name: remote.name,
                note: remote.specification,
                category: 'other',
                checked: !active,
                in_list: !!active,
                source: 'bring'
            });
            pbByName.set(name, { ...created, name: remote.name, checked: !active, in_list: !!active });
            continue;
        }

        const localActive = local.in_list && !local.checked;
        const localChanged = previousActive !== undefined && previousActive.has(name) !== localActive;
        const remoteChanged = link.snapshot !== undefined && previousBring.has(name) !== !!active;

        // The previous active state identifies which side changed. In
        // particular, a newly re-added item must not be completed again just
        // because the other service still has it in its purchased history.
        if (localChanged) {
            if (localActive && !active) {
                await bring.add(link.bring_list_uuid, local.name, local.note ?? '');
                bringActive.set(name, { name: local.name, specification: local.note ?? '' });
                bringRecent.delete(name);
            } else if (!localActive && active) {
                await bring.complete(link.bring_list_uuid, active.name);
                bringActive.delete(name);
                bringRecent.set(name, active);
            }
        } else if (remoteChanged) {
            const changes = { checked: !!recent, in_list: !!active };
            await pb.collection('shopping_items').update(local.id, changes);
            pbByName.set(name, { ...local, ...changes });
        } else if (localActive && !active) {
            await bring.add(link.bring_list_uuid, local.name, local.note ?? '');
            bringActive.set(name, { name: local.name, specification: local.note ?? '' });
            bringRecent.delete(name);
        } else if (!localActive && active) {
            const changes = { checked: false, in_list: true };
            await pb.collection('shopping_items').update(local.id, changes);
            pbByName.set(name, { ...local, ...changes });
        }
    }

    // Persist the resulting state, including records created in this cycle, so
    // the next cycle can detect deletions and changes in either direction.
    const snapshot: SyncSnapshot = {
        bringActive: uniqueNames([...bringActive.keys()]),
        pocketbaseNames: uniqueNames([...pbByName.keys()]),
        pocketbaseActive: uniqueNames([...pbByName.values()].filter((item) => item.in_list && !item.checked).map((item) => item.name))
    };
    await pb.collection('bring_links').update(link.id, { status: 'ok', last_error: '', snapshot });
}

async function syncAll(pb: PocketBase, bring: BringAdapter) {
    const links = await pb.collection('bring_links').getFullList<BringLink>({ filter: 'enabled = true' });
    for (const link of links) {
        try {
            await syncLink(pb, bring, link);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Bring sync failed for ${link.id}:`, message);
            await pb.collection('bring_links').update(link.id, { status: 'error', last_error: message }).catch(console.error);
        }
    }
}

async function main() {
    if (!PB_EMAIL || !PB_PASSWORD || !BRING_EMAIL || !BRING_PASSWORD) {
        throw new Error('PB_SERVICE_EMAIL, PB_SERVICE_PASSWORD, BRING_EMAIL and BRING_PASSWORD are required');
    }

    const pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    const bring = new BringAdapter(BRING_EMAIL, BRING_PASSWORD);

    let attempt = 0;
    while (true) {
        try {
            if (!pb.authStore.isValid) {
                await pb.collection('service_accounts').authWithPassword(PB_EMAIL, PB_PASSWORD);
            }
            await bring.login();
            await syncAll(pb, bring);
            attempt = 0;
            await delay(SYNC_INTERVAL_MS);
        } catch (error) {
            attempt += 1;
            const wait = Math.min(300_000, 2 ** attempt * 1_000);
            console.error(`Connector cycle failed; retrying in ${wait}ms`, error);
            pb.authStore.clear();
            await delay(wait);
        }
    }
}

if (require.main === module) {
    void main();
}
