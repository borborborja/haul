// Admin-only AI translation helpers — call the superuser-guarded backend endpoint.
import { pb } from './pocketbase';

export type Translations = Record<string, string>;

// Translate one text from `source` into all supported languages (minus source).
export async function translate(text: string, source: string, kind: 'product' | 'category' = 'product'): Promise<Translations> {
    const res = await pb.send<{ translations: Translations }>('/api/shoplist/admin/translate', {
        method: 'POST',
        body: { text, source, kind },
    });
    return res.translations || {};
}

// Server-side bulk: fill missing languages across a whole catalog collection.
export async function bulkTranslate(collection: 'catalog_items' | 'catalog_categories'): Promise<{ updated: number; total: number }> {
    return pb.send('/api/shoplist/admin/translate', { method: 'POST', body: { bulk: collection } });
}
