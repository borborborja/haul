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
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();
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

    for (const [name, item] of bringActive) {
        const local = pbByName.get(name);
        if (!local) {
            await pb.collection('shopping_items').create({
                list: link.list,
                name: item.name,
                note: item.specification,
                category: 'other',
                checked: false,
                in_list: true,
                source: 'bring'
            });
        } else if (local.checked || !local.in_list) {
            await bring.complete(link.bring_list_uuid, item.name);
        }
    }

    for (const [name, item] of bringRecent) {
        const local = pbByName.get(name);
        if (!local) {
            await pb.collection('shopping_items').create({
                list: link.list,
                name: item.name,
                note: item.specification,
                category: 'other',
                checked: true,
                in_list: false,
                source: 'bring'
            });
        } else if (!local.checked || local.in_list) {
            await pb.collection('shopping_items').update(local.id, { checked: true, in_list: false });
        }
    }

    for (const [name, item] of pbByName) {
        if (item.checked || !item.in_list) {
            if (bringActive.has(name)) {
                await bring.complete(link.bring_list_uuid, item.name);
            }
            continue;
        }
        if (!bringActive.has(name) && !bringRecent.has(name)) {
            if (previousBring.has(name)) {
                await pb.collection('shopping_items').update(item.id, { in_list: false });
            } else {
                await bring.add(link.bring_list_uuid, item.name, item.note ?? '');
            }
        }
    }

    for (const deletedName of previousPocketBase) {
        if (!pbByName.has(deletedName) && bringActive.has(deletedName)) {
            await bring.remove(link.bring_list_uuid, bringActive.get(deletedName)?.name ?? deletedName);
        }
    }

    const snapshot: SyncSnapshot = {
        bringActive: uniqueNames([...bringActive.keys()]),
        pocketbaseNames: uniqueNames([...pbByName.keys()])
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
