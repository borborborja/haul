// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShopStore } from '../../../store/shopStore';
import type { Categories } from '../../../types';
import { ProductFlowProvider } from '../ProductFlow';
import { useProductFlow } from '../productFlowContext';
import CatalogPanel from '../CatalogPanel';
import CatalogManagement from '../CatalogManagement';
import { ProductRow } from '../ProductRows';
import HaulApp from '../../HaulApp';

vi.mock('../../../lib/pocketbase', () => ({ pb: { baseURL: 'https://a.example', collection: () => ({}) }, normalizeServerUrl: (url: string) => url.replace(/\/+$/, '') }));
vi.mock('../../../lib/itemWriteQueue', () => ({ enqueueItemUpdate: vi.fn(), enqueueItemDelete: vi.fn(), itemQueue: { clear: vi.fn() } }));
vi.mock('../../../hooks/useBackButton', () => ({ useBackButton: vi.fn() }));
const catalog: Categories = {
    fruit: { icon: '🍎', names: { ca: 'Fruita', es: 'Fruta', en: 'Fruit' }, items: [] },
    drinks: { icon: '☕', names: { ca: 'Begudes', es: 'Bebidas', en: 'Drinks' }, items: [{ ca: 'Cafè', es: 'Café', en: 'Coffee', _catalogId: 'coffee_base', _catalogKind: 'global' }] },
};
let desktop = false;
const mediaListeners = new Set<() => void>();
beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => ({ get matches() { return desktop; }, addEventListener: (_name: string, callback: () => void) => mediaListeners.add(callback), removeEventListener: (_name: string, callback: () => void) => mediaListeners.delete(callback) })), configurable: true });
});
beforeEach(() => {
    desktop = false;
    useShopStore.setState(useShopStore.getInitialState(), true);
    useShopStore.setState({ lang: 'en', categories: structuredClone(catalog), catalogCategories: structuredClone(catalog), catalogEntries: [], catalogInitializedScopes: [], items: [], disabledProducts: [], disabledCategories: [], quantitySupported: true, serverUrl: 'https://a.example', sync: { ...useShopStore.getState().sync, recordId: null, connected: false } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const renderCatalog = () => render(<ProductFlowProvider><CatalogPanel /></ProductFlowProvider>);

describe('shared product flow', () => {
    it('does not apply hidden single-product quantity or notes to bulk names', async () => {
        const user = userEvent.setup(); renderCatalog();
        await user.click(screen.getByRole('button', { name: 'New product' }));
        const dialog = screen.getByRole('dialog');
        await user.type(within(dialog).getByLabelText('Quantity'), '2 kg');
        await user.type(within(dialog).getByLabelText('Notes'), 'Single product note');
        await user.click(within(dialog).getByRole('button', { name: 'Add several products' }));
        await user.type(within(dialog).getByLabelText('Product names'), 'Mango\nPapaya');
        await user.click(within(dialog).getByRole('button', { name: 'Create and add' }));
        await waitFor(() => expect(useShopStore.getState().items).toHaveLength(2));
        expect(useShopStore.getState().items.every(item => !item.quantity && !item.note && item.category === 'fruit')).toBe(true);
    });
    it('creates in the selected category and adds to the list with quantity and notes', async () => {
        const user = userEvent.setup(); renderCatalog();
        await user.click(screen.getByRole('button', { name: 'Drinks' }));
        const opener = screen.getByRole('button', { name: 'New product' });
        await user.click(opener);
        const dialog = screen.getByRole('dialog');
        const input = within(dialog).getByLabelText('Product name');
        await waitFor(() => expect(document.activeElement).toBe(input));
        expect((within(dialog).getByLabelText('Category') as HTMLSelectElement).value).toBe('drinks');
        await user.type(input, 'Tea'); await user.type(within(dialog).getByLabelText('Quantity'), '2 boxes'); await user.type(within(dialog).getByLabelText('Notes'), 'Green tea');
        await user.click(within(dialog).getByRole('button', { name: 'Create and add' }));
        await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
        await waitFor(() => expect(document.activeElement).toBe(input));
        await user.click(within(dialog).getByRole('button', { name: 'Done' }));
        expect(useShopStore.getState().items[0]).toMatchObject({ name: 'Tea', category: 'drinks', quantity: '2 boxes', note: 'Green tea', inList: true });
        expect(document.activeElement).toBe(opener);
    });
    it('creates a category from the product form and returns to the preserved draft', async () => {
        const user = userEvent.setup(); renderCatalog();
        await user.click(screen.getByRole('button', { name: 'New product' }));
        const product = screen.getByRole('dialog', { name: 'New product' });
        await user.type(within(product).getByLabelText('Product name'), 'Tissues');
        await user.click(within(product).getByRole('button', { name: 'New category' }));
        const category = screen.getByRole('dialog', { name: 'New category' });
        await user.type(within(category).getByLabelText('Category name'), 'Travel');
        await user.click(within(category).getByRole('button', { name: 'New category' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New category' })).toBeNull());
        expect((within(product).getByLabelText('Product name') as HTMLInputElement).value).toBe('Tissues');
        const selected = (within(product).getByLabelText('Category') as HTMLSelectElement).value;
        expect(useShopStore.getState().categories[selected].names?.en).toBe('Travel');
        await user.click(within(product).getByRole('button', { name: 'Create and add' }));
        await waitFor(() => expect(useShopStore.getState().items[0]).toMatchObject({ name: 'Tissues', category: selected }));
    });
    it('supports catalog-only creation and bulk results without duplicate names', async () => {
        const user = userEvent.setup(); renderCatalog();
        await user.click(screen.getByRole('button', { name: 'Add several products' }));
        const dialog = screen.getByRole('dialog');
        await user.type(within(dialog).getByLabelText('Product names'), 'Pears\n pears \nApples');
        await user.click(within(dialog).getByLabelText('Add to this shopping list'));
        await user.click(within(dialog).getByRole('button', { name: 'Save in the catalog' }));
        await waitFor(() => expect(within(dialog).getAllByRole('listitem')).toHaveLength(3));
        expect(useShopStore.getState().items).toEqual([]);
        expect(useShopStore.getState().categories.fruit.items).toHaveLength(2);
        expect(within(dialog).getByText('Already exists')).toBeTruthy();
    });
    it('searches accents, disables an existing selection, and uses keyboard focus for results', async () => {
        useShopStore.setState({ items: [{ id: 'local_coffee', name: 'Coffee', category: 'drinks', note: '', checked: false, inList: true }] });
        const user = userEvent.setup(); renderCatalog();
        const input = screen.getByLabelText('Search a product…'); await user.type(input, 'cafe');
        const result = screen.getByRole('button', { name: /Coffee.*Drinks.*Already in the list/ });
        expect((result as HTMLButtonElement).disabled).toBe(true);
        await user.click(result);
        expect(useShopStore.getState().items[0].inList).toBe(true);
        await user.click(input); await user.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /New product «cafe»/ }));
    });
    it('hides suggestions explicitly, preserves purchases, and can undo', async () => {
        useShopStore.setState({ items: [{ id: 'local_coffee', name: 'Coffee', category: 'drinks', note: 'Keep', quantity: '2', checked: false, inList: true }] });
        const user = userEvent.setup(); render(<ProductFlowProvider><CatalogManagement /></ProductFlowProvider>);
        await user.click(screen.getByRole('button', { name: 'Hide Coffee' }));
        expect(useShopStore.getState().items[0]).toMatchObject({ name: 'Coffee', note: 'Keep', quantity: '2', inList: true });
        expect(screen.queryByRole('button', { name: 'Hide Coffee' })).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Hide Coffee' })).toBeTruthy());
    });
    it('edits the purchase without changing its checked state or catalog unless selected', async () => {
        const item = { id: 'local_coffee', name: 'Coffee', category: 'drinks', note: '', checked: true, inList: true };
        useShopStore.setState({ items: [item] });
        const user = userEvent.setup(); render(<ProductFlowProvider><ProductRow item={item} shopping /></ProductFlowProvider>);
        await user.click(screen.getByRole('button', { name: 'Edit: Coffee' }));
        const dialog = screen.getByRole('dialog');
        expect((within(dialog).getByLabelText('Also update the catalog for this list') as HTMLInputElement).checked).toBe(false);
        await user.clear(within(dialog).getByLabelText('Product name')); await user.type(within(dialog).getByLabelText('Product name'), 'Decaf');
        await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(useShopStore.getState().items[0]).toMatchObject({ name: 'Decaf', checked: true });
        expect(useShopStore.getState().categories.drinks.items[0].en).toBe('Coffee');
    });
    it('keeps an unsupported remote quantity unchanged when editing offline', async () => {
        const item = { id: 'remote_coffee', name: 'Coffee', category: 'drinks', note: '', quantity: '2 bags', checked: false, inList: true };
        useShopStore.setState({ items: [item], quantitySupported: false, sync: { ...useShopStore.getState().sync, recordId: 'remote_list', connected: false } });
        const user = userEvent.setup(); render(<ProductFlowProvider><ProductRow item={item} shopping /></ProductFlowProvider>);
        await user.click(screen.getByRole('button', { name: 'Edit: Coffee' }));
        const dialog = screen.getByRole('dialog');
        expect((within(dialog).getByLabelText(/Quantity/) as HTMLInputElement).disabled).toBe(true);
        await user.type(within(dialog).getByLabelText('Notes'), 'Updated offline');
        await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(useShopStore.getState().items[0]).toMatchObject({ quantity: '2 bags', note: 'Updated offline' });
    });
    it('updates bulk feedback when the durable catalog outbox is acknowledged', async () => {
        const listId = useShopStore.getState().activeListId;
        useShopStore.setState({
            createProduct: vi.fn().mockResolvedValue({ status: 'pending', catalogId: 'outbox1' }),
            sync: { ...useShopStore.getState().sync, recordId: 'remote_list', connected: false },
            catalogSyncStatus: 'pending',
            catalogEntries: [{ id: 'outbox1', origin: 'https://a.example', listId, remoteListId: 'remote_list', collection: 'list_items', data: { name: 'Pears', category_key: 'fruit' }, deleted: false, revision: 1, acknowledged: 0, modifiedAt: Date.now(), attempts: 0 }],
        });
        const user = userEvent.setup(); renderCatalog();
        await user.click(screen.getByRole('button', { name: 'Add several products' }));
        const dialog = screen.getByRole('dialog');
        await user.type(within(dialog).getByLabelText('Product names'), 'Pears');
        await user.click(within(dialog).getByLabelText('Add to this shopping list'));
        await user.click(within(dialog).getByRole('button', { name: 'Save in the catalog' }));
        await waitFor(() => expect(within(dialog).getAllByText('Saved on this device · waiting to sync').length).toBeGreaterThan(0));
        act(() => useShopStore.setState({ catalogSyncStatus: 'saved', catalogEntries: useShopStore.getState().catalogEntries.map((entry) => ({ ...entry, acknowledged: entry.revision })) }));
        await waitFor(() => expect(within(dialog).getByText('Created')).toBeTruthy());
        expect(within(dialog).queryByText('Saved on this device · waiting to sync')).toBeNull();
    });
    it('preserves the open draft across responsive layout changes and permits adding while shopping', async () => {
        useShopStore.setState({ appMode: 'shopping' });
        const user = userEvent.setup(); render(<HaulApp openSettings={() => {}} />);
        await user.click(screen.getAllByRole('button', { name: 'Add products' })[0]);
        await user.click(screen.getByRole('button', { name: 'New product' }));
        await user.type(screen.getByLabelText('Product name'), 'Keep this draft');
        act(() => { desktop = true; mediaListeners.forEach((listener) => listener()); });
        expect((screen.getByLabelText('Product name') as HTMLInputElement).value).toBe('Keep this draft');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

function ContextHarness() {
    const flow = useProductFlow();
    return <><button onClick={() => { flow.setSearch('kept search'); flow.setActiveBand('drinks'); flow.setSettingsTab('catalog'); flow.setScreen('settings'); }}>Remember</button><output>{`${flow.screen}:${flow.settingsTab}:${flow.search}:${flow.activeBand}`}</output></>;
}
describe('list-specific UI context', () => {
    it('restores each list context and invalidates undo when switching lists', async () => {
        const original = useShopStore.getState().activeListId;
        const user = userEvent.setup(); render(<ProductFlowProvider><ContextHarness /><CatalogManagement /></ProductFlowProvider>);
        await user.click(screen.getByRole('button', { name: 'Remember' }));
        await user.click(screen.getByRole('button', { name: 'Hide Coffee' }));
        expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
        act(() => { useShopStore.getState().createList('Second'); });
        expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
        expect(screen.getByRole('status').textContent).toBe('app:account::fruit');
        act(() => { useShopStore.getState().switchList(original); });
        expect(screen.getByRole('status').textContent).toBe('settings:catalog:kept search:drinks');
    });
});
