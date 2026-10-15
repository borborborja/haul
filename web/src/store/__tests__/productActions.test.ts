import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopItem } from '../../types';

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), remove: vi.fn(), list: vi.fn(), getOne: vi.fn(), send: vi.fn() }));
vi.mock('../../lib/itemWriteQueue', () => ({ enqueueItemUpdate: mocks.update, enqueueItemDelete: mocks.remove, itemQueue: { clear: vi.fn() } }));
vi.mock('../../lib/pocketbase', () => ({
    pb: { baseURL: 'https://a.test', send: mocks.send, filter: (_query: string, params: unknown) => JSON.stringify(params),
        collection: () => ({ create: mocks.create, update: mocks.update, delete: mocks.remove, getFullList: mocks.list, getOne: mocks.getOne }) },
    normalizeServerUrl: (url: string) => url.replace(/\/+$/, ''),
}));

let useShopStore: typeof import('../shopStore').useShopStore;
const fruit = { icon: '🍎', items: [] };
const base = { fruit, other: { icon: '📦', items: [] } };
const draft = { name: 'Mango', category: 'fruit', quantity: '2 peces', note: 'Madurs', addToList: true };

beforeAll(async () => {
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), localStorage: storage });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('navigator', { onLine: false });
    ({ useShopStore } = await import('../shopStore'));
});
beforeEach(() => {
    useShopStore.setState({ ...useShopStore.getInitialState(), categories: base, catalogCategories: base }, true);
    vi.stubGlobal('navigator', { onLine: false });
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([]);
    mocks.create.mockImplementation(async (body: { id: string }) => ({ id: body.id }));
    mocks.update.mockResolvedValue({});
    mocks.remove.mockResolvedValue(true);
    mocks.send.mockRejectedValue({ status: 0 });
});
afterEach(() => { vi.useRealTimers(); });

describe('contextual product commands', () => {
    it('keeps a transient retry scheduled when a refresh happens during backoff', async () => {
        vi.useFakeTimers();
        await useShopStore.getState().createProduct({ ...draft, quantity: '' });
        useShopStore.getState().bindLocalCatalog('backoff_remote');
        useShopStore.getState().setSyncState({ recordId: 'backoff_remote', connected: true });
        vi.stubGlobal('navigator', { onLine: true });
        mocks.list.mockRejectedValueOnce({ status: 503 });
        await useShopStore.getState().flushCatalogChanges();
        expect(useShopStore.getState().catalogEntries[0].acknowledged).toBe(0);
        await useShopStore.getState().flushCatalogChanges();
        await vi.advanceTimersByTimeAsync(1100);
        expect(useShopStore.getState().catalogEntries[0].acknowledged).toBe(1);
        expect(mocks.create).toHaveBeenCalledOnce();
    });
    it('rechecks quantity support when retrying after the server was upgraded', async () => {
        await useShopStore.getState().createProduct(draft);
        useShopStore.getState().bindLocalCatalog('upgraded_remote');
        useShopStore.getState().setSyncState({ recordId: 'upgraded_remote', connected: false });
        useShopStore.setState({ quantitySupported: false });
        useShopStore.getState().refreshCatalogProjection();
        mocks.send.mockResolvedValueOnce({ supports_quantity: true });
        await useShopStore.getState().retryCatalogChanges();
        expect(mocks.send).toHaveBeenCalledWith('/api/shoplist/health', expect.objectContaining({ method: 'GET' }));
        expect(useShopStore.getState().quantitySupported).toBe(true);
        expect(useShopStore.getState().catalogSyncError).toBeNull();
        expect(useShopStore.getState().items[0].quantity).toBe('2 peces');
    });
    it('saves the category, product, buy entry and durable intent locally together', async () => {
        const result = await useShopStore.getState().createProduct(draft);
        expect(result.status).toBe('saved');
        const state = useShopStore.getState();
        expect(state.items[0]).toMatchObject({ name: 'Mango', category: 'fruit', quantity: '2 peces', note: 'Madurs', inList: true, catalogSourceKind: 'custom' });
        expect(state.categories.fruit.items[0]).toMatchObject({ ca: 'Mango' });
        expect(state.catalogEntries[0]).toMatchObject({ collection: 'list_items', acknowledged: 0, revision: 1, listId: state.activeListId });
        expect(JSON.parse(JSON.stringify(state.catalogEntries))[0].id).toBe(result.catalogId);
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('supports catalog-only creation and normalized duplicates without removing active items', async () => {
        await useShopStore.getState().createProduct({ ...draft, name: 'Cafè', addToList: false });
        expect(useShopStore.getState().items).toEqual([]);
        await useShopStore.getState().createProduct({ ...draft, name: ' cafe ' });
        const result = await useShopStore.getState().createProduct({ ...draft, name: 'CAFÉ' });
        expect(result.status).toBe('exists');
        expect(useShopStore.getState().items).toHaveLength(1);
        expect(useShopStore.getState().categories.fruit.items).toHaveLength(1);
        expect(useShopStore.getState().items[0].inList).toBe(true);
    });

    it('lets each edit choose whether to update the custom catalog and preserves purchase state', async () => {
        const created = await useShopStore.getState().createProduct(draft);
        const originalCatalogId = created.catalogId;
        useShopStore.setState(state => ({ items: state.items.map(item => ({ ...item, checked: true, addedBy: 'Anna' })) }));
        await useShopStore.getState().editProduct(created.itemId!, { ...draft, name: 'Mango gran', quantity: '3', updateCatalog: false });
        expect(useShopStore.getState().categories.fruit.items[0]).toMatchObject({ ca: 'Mango' });
        await useShopStore.getState().editProduct(created.itemId!, { ...draft, name: 'Mango petit', category: 'other', updateCatalog: true });
        expect(useShopStore.getState().items[0]).toMatchObject({ id: created.itemId, checked: true, inList: true, addedBy: 'Anna', category: 'other' });
        expect(useShopStore.getState().catalogEntries.find(entry => entry.id === originalCatalogId)?.data).toMatchObject({ name: 'Mango petit', category_key: 'other' });
        expect(useShopStore.getState().categories.fruit.items).toEqual([]);
    });

    it('saves a list variant of a general product without changing the base', async () => {
        const milk = { en: 'Milk', ca: 'Llet', es: 'Leche', _catalogId: 'milk_global', _catalogKind: 'global' };
        const catalog = { ...base, fruit: { icon: '🍎', items: [milk] } };
        useShopStore.setState({ categories: catalog, catalogCategories: catalog });
        const created = await useShopStore.getState().createProduct({ ...draft, name: 'Llet' });
        await useShopStore.getState().editProduct(created.itemId!, { ...draft, name: 'Llet sense lactosa', updateCatalog: true });
        expect(useShopStore.getState().catalogCategories.fruit.items).toEqual([milk]);
        expect(useShopStore.getState().categories.fruit.items).toHaveLength(2);
    });

    it('hides and restores suggestions without deleting purchases or their history', async () => {
        await useShopStore.getState().createProduct(draft);
        const catalogItem = useShopStore.getState().categories.fruit.items[0];
        const history: ShopItem = { id: 'history', name: 'Mango', category: 'fruit', note: '', checked: true, inList: false };
        useShopStore.setState(state => ({ items: [...state.items, history] }));
        const before = useShopStore.getState().items;
        await useShopStore.getState().deactivateProduct(catalogItem);
        expect(useShopStore.getState().disabledProducts[0]).toMatch(/^source:custom:/);
        expect(useShopStore.getState().items).toEqual(before);
        expect(mocks.remove).not.toHaveBeenCalled();
        await useShopStore.getState().reactivateProduct(catalogItem);
        expect(useShopStore.getState().disabledProducts).toEqual([]);
        expect(useShopStore.getState().items).toEqual(before);
    });

    it('retains pending records through old remote snapshots and isolated list changes', async () => {
        const original = useShopStore.getState().activeListId;
        await useShopStore.getState().createProduct(draft);
        useShopStore.getState().bindLocalCatalog('remote_one');
        useShopStore.getState().setSyncState({ recordId: 'remote_one', connected: false });
        useShopStore.getState().mergeCatalogSnapshot([], Date.now() + 10);
        expect(useShopStore.getState().categories.fruit.items[0]).toMatchObject({ ca: 'Mango' });
        useShopStore.getState().createList('Other');
        expect(useShopStore.getState().categories.fruit.items).toEqual([]);
        useShopStore.getState().switchList(original);
        expect(useShopStore.getState().categories.fruit.items[0]).toMatchObject({ ca: 'Mango' });
    });

    it('preserves a category display name separately from its stable key', async () => {
        const result = await useShopStore.getState().createCatalogCategory('Per als gats', '🐈');
        expect(result.categoryKey).toMatch(/^cat_/);
        expect(useShopStore.getState().categories[result.categoryKey!].names?.ca).toBe('Per als gats');
        const duplicate = await useShopStore.getState().createCatalogCategory(' per ALS gats ', '🐈');
        expect(duplicate).toMatchObject({ status: 'exists', categoryKey: result.categoryKey });
    });

    it('prevents quantity from being silently lost against an older server', async () => {
        useShopStore.getState().setSyncState({ recordId: 'remote' });
        useShopStore.setState({ quantitySupported: false });
        const result = await useShopStore.getState().createProduct(draft);
        expect(result).toEqual({ status: 'error', error: 'quantity_unsupported' });
        expect(useShopStore.getState().items).toEqual([]);
    });

    it('acknowledges only the revision sent when a product is edited during its create', async () => {
        const created = await useShopStore.getState().createProduct({ ...draft, quantity: '' });
        useShopStore.getState().bindLocalCatalog('revision_remote');
        useShopStore.getState().setSyncState({ recordId: 'revision_remote', connected: true });
        vi.stubGlobal('navigator', { onLine: true });
        let resolve!: (record: { id: string }) => void;
        mocks.create.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
        const flush = useShopStore.getState().flushCatalogChanges();
        await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
        await useShopStore.getState().editProduct(created.itemId!, { ...draft, name: 'Mango updated', quantity: '', updateCatalog: true });
        resolve({ id: created.catalogId! });
        await flush;
        const entry = useShopStore.getState().catalogEntries.find(value => value.id === created.catalogId)!;
        expect(entry.acknowledged).toBe(entry.revision);
        expect(entry.data.name).toBe('Mango updated');
        expect(mocks.create).toHaveBeenCalledOnce();
        expect(mocks.update).toHaveBeenCalledWith(created.catalogId, expect.objectContaining({ name: 'Mango updated' }), { requestKey: null });
    });

    it('keeps a late acknowledgement in its original server after switching workspaces', async () => {
        const created = await useShopStore.getState().createProduct({ ...draft, quantity: '' });
        useShopStore.getState().bindLocalCatalog('workspace_remote');
        useShopStore.getState().setSyncState({ recordId: 'workspace_remote', connected: true });
        vi.stubGlobal('navigator', { onLine: true });
        let resolve!: (record: { id: string }) => void;
        mocks.create.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
        const flush = useShopStore.getState().flushCatalogChanges();
        await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
        useShopStore.getState().setServerUrl('https://b.test');
        resolve({ id: created.catalogId! });
        await flush;
        expect(useShopStore.getState().items).toEqual([]);
        expect(useShopStore.getState().catalogEntries.find(value => value.id === created.catalogId)?.acknowledged).toBe(1);
        useShopStore.getState().setServerUrl('https://a.test');
        useShopStore.getState().refreshCatalogProjection();
        expect(useShopStore.getState().categories.fruit.items[0]).toMatchObject({ ca: 'Mango' });
    });

    it('keeps permission failures visible and supports an explicit retry', async () => {
        await useShopStore.getState().createProduct({ ...draft, quantity: '' });
        useShopStore.getState().bindLocalCatalog('permissions_remote');
        useShopStore.getState().setSyncState({ recordId: 'permissions_remote', connected: true });
        vi.stubGlobal('navigator', { onLine: true });
        mocks.create.mockRejectedValueOnce({ status: 403 });
        mocks.getOne.mockRejectedValue({ status: 404 });
        await useShopStore.getState().flushCatalogChanges();
        expect(useShopStore.getState()).toMatchObject({ catalogSyncStatus: 'error', catalogSyncError: 'permission_denied' });
        expect(useShopStore.getState().catalogEntries[0].acknowledged).toBe(0);
        await useShopStore.getState().retryCatalogChanges();
        expect(useShopStore.getState().catalogEntries[0]).toMatchObject({ acknowledged: 1, blocked: false });
    });
});

describe('catalog snapshot and alias regressions', () => {
    it('ignores an older catalog request that completes after a newer deletion snapshot', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);
        useShopStore.getState().setSyncState({ recordId: 'snapshot_remote', connected: true });
        const row = { id: 'remote_mango', collection: 'list_items' as const, data: { category_key: 'fruit', name: 'Mango' } };
        useShopStore.getState().mergeCatalogSnapshot([row], 900);
        let finishOlder!: (rows: unknown[]) => void;
        const olderItems = new Promise<unknown[]>(resolve => { finishOlder = resolve; });
        mocks.list.mockResolvedValueOnce([]).mockReturnValueOnce(olderItems).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        vi.setSystemTime(1100);
        const older = useShopStore.getState().loadListCustomData();
        vi.setSystemTime(1200);
        await useShopStore.getState().loadListCustomData();
        expect(useShopStore.getState().categories.fruit.items).toEqual([]);
        finishOlder([{ id: row.id, ...row.data }]);
        await older;
        expect(useShopStore.getState().categories.fruit.items).toEqual([]);
    });

    it('does not apply a catalog snapshot after the list disconnected', async () => {
        useShopStore.getState().setSyncState({ recordId: 'disconnect_remote', connected: true });
        let finish!: (rows: unknown[]) => void;
        mocks.list.mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        const request = useShopStore.getState().loadListCustomData();
        useShopStore.getState().setSyncState({ connected: false });
        finish([{ id: 'stale_product', category_key: 'fruit', name: 'Stale mango' }]);
        await request;
        expect(useShopStore.getState().categories.fruit.items).toEqual([]);
    });

    it.each([false, true])('adopts a natural product ID without losing an existing hide (acknowledged=%s)', async (hideWasAcknowledged) => {
        const created = await useShopStore.getState().createProduct({ ...draft, quantity: '' });
        const product = useShopStore.getState().categories.fruit.items[0];
        await useShopStore.getState().setProductVisibility(product, true);
        const localId = created.catalogId!;
        const oldKey = `source:custom:${localId}`;
        const remoteId = `alias_${hideWasAcknowledged ? 'ack' : 'pending'}`;
        const newKey = `source:custom:${remoteId}`;
        useShopStore.getState().bindLocalCatalog('alias_remote');
        useShopStore.getState().setSyncState({ recordId: 'alias_remote', connected: true });
        if (hideWasAcknowledged) useShopStore.setState(state => ({ catalogEntries: state.catalogEntries.map(entry => entry.collection === 'list_disabled_products'
            ? { ...entry, acknowledged: entry.revision, remoteId: 'old_hide_record' } : entry) }));
        mocks.list.mockImplementation(async (options: { filter: string }) => {
            const filter = JSON.parse(options.filter);
            return filter.category_key ? [{ id: remoteId }] : [];
        });
        vi.stubGlobal('navigator', { onLine: true });
        await useShopStore.getState().flushCatalogChanges();
        expect(useShopStore.getState().items[0].catalogSourceId).toBe(remoteId);
        expect(useShopStore.getState().disabledProducts).toEqual([newKey]);
        const oldHide = useShopStore.getState().catalogEntries.find(entry => entry.collection === 'list_disabled_products' && entry.data.name === oldKey)!;
        expect(oldHide.deleted).toBe(true);
        expect(oldHide.acknowledged).toBe(oldHide.revision);
        expect(useShopStore.getState().catalogEntries.find(entry => entry.collection === 'list_disabled_products' && entry.data.name === newKey)).toMatchObject({ deleted: false, acknowledged: 1 });
        if (hideWasAcknowledged) expect(mocks.remove).toHaveBeenCalledWith('old_hide_record', { requestKey: null });
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: newKey }), { requestKey: null });
        await useShopStore.getState().editProduct(created.itemId!, { ...draft, quantity: '', name: 'Mango renamed', updateCatalog: true });
        await useShopStore.getState().flushCatalogChanges();
        expect(useShopStore.getState().disabledProducts).toEqual([newKey]);
    });

    it('remaps an adopted source and its visibility in an inactive server workspace', async () => {
        const created = await useShopStore.getState().createProduct({ ...draft, quantity: '' });
        await useShopStore.getState().setProductVisibility(useShopStore.getState().categories.fruit.items[0], true);
        useShopStore.getState().bindLocalCatalog('workspace_alias_remote');
        useShopStore.getState().setSyncState({ recordId: 'workspace_alias_remote', connected: true });
        let finishNatural!: (rows: { id: string }[]) => void;
        mocks.list.mockImplementationOnce(() => new Promise(resolve => { finishNatural = resolve; }));
        vi.stubGlobal('navigator', { onLine: true });
        const flush = useShopStore.getState().flushCatalogChanges();
        await vi.waitFor(() => expect(mocks.list).toHaveBeenCalled());
        useShopStore.getState().setServerUrl('https://b.test');
        finishNatural([{ id: 'workspace_adopted' }]);
        await flush;
        const workspace = useShopStore.getState().serverWorkspaces['https://a.test'];
        expect(workspace.items[0].catalogSourceId).toBe('workspace_adopted');
        expect(workspace.disabledProducts).toEqual(['source:custom:workspace_adopted']);
        expect(useShopStore.getState().items).toEqual([]);
        expect(useShopStore.getState().catalogEntries.find(entry => entry.id === created.catalogId)?.remoteId).toBe('workspace_adopted');
        useShopStore.getState().setServerUrl('https://a.test');
        useShopStore.getState().refreshCatalogProjection();
        expect(useShopStore.getState().disabledProducts).toEqual(['source:custom:workspace_adopted']);
    });

    it('blocks unsupported quantities after promoting a local list and retries purchase synchronization explicitly', async () => {
        const created = await useShopStore.getState().createProduct(draft);
        useShopStore.getState().bindLocalCatalog('old_backend');
        useShopStore.getState().setSyncState({ recordId: 'old_backend', connected: true });
        useShopStore.setState({ quantitySupported: false, quantityCapabilities: { 'https://a.test': false } });
        useShopStore.getState().refreshCatalogProjection();
        expect(useShopStore.getState()).toMatchObject({ catalogSyncStatus: 'error', catalogSyncError: 'quantity_unsupported' });
        expect(useShopStore.getState().items[0].quantity).toBe('2 peces');
        useShopStore.setState(state => ({ items: state.items.map(item => ({ ...item, id: 'server_purchase', dirty: false })) }));
        await useShopStore.getState().editProduct('server_purchase', { ...draft, note: 'Updated offline note' });
        expect(mocks.update).not.toHaveBeenCalled();
        expect(useShopStore.getState().items[0]).toMatchObject({ quantity: '2 peces', note: 'Updated offline note', dirty: true });
        const previousVersion = useShopStore.getState().sync.syncVersion;
        await useShopStore.getState().retryCatalogChanges();
        expect(useShopStore.getState().sync.syncVersion).toBe(previousVersion + 1);
        expect(useShopStore.getState().items[0].catalogSourceId).toBe(created.catalogId);
    });
});

describe('reactivating shopping history', () => {
    it('preserves quantity and notes for catalog taps but accepts explicit clearing from the editor', async () => {
        await useShopStore.getState().createProduct(draft);
        useShopStore.setState(state => ({ items: state.items.map(item => ({ ...item, inList: false, checked: true })) }));
        await useShopStore.getState().createProduct({ name: draft.name, category: draft.category, addToList: true });
        expect(useShopStore.getState().items[0]).toMatchObject({ quantity: draft.quantity, note: draft.note, inList: true, checked: false });
        useShopStore.setState(state => ({ items: state.items.map(item => ({ ...item, inList: false })) }));
        await useShopStore.getState().createProduct({ name: draft.name, category: draft.category, quantity: '', note: '', addToList: true });
        expect(useShopStore.getState().items[0]).toMatchObject({ quantity: '', note: '', inList: true });
    });
});
