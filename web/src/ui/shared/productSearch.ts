import type { Categories, Lang, LocalizedItem, ShopItem } from '../../types';
import { catalogVisibilityKeys, normalizeProductName, productNames } from '../../lib/catalogSync';

export const normalizeProductSearch = normalizeProductName;
export const productDisplayName = (item: LocalizedItem | string, lang: Lang) => typeof item === 'string' ? item : item[lang] || item.en || item.ca || item.es || '';
export function catalogMatches(categories: Categories, query: string, lang: Lang, disabledCategories: string[], disabledProducts: string[], items: ShopItem[]) {
    const q = normalizeProductSearch(query);
    if (!q) return [];
    const activeNames = new Set(items.filter((item) => item.inList !== false && !item.checked).map((item) => normalizeProductSearch(item.name)));
    return Object.entries(categories).filter(([key]) => !disabledCategories.includes(key)).flatMap(([key, category]) => category.items
        .filter((item) => !catalogVisibilityKeys(item).some((key) => disabledProducts.includes(key)))
        .filter((item) => productNames(item).some((name) => normalizeProductSearch(name).includes(q)))
        .map((item) => { const name = productDisplayName(item, lang); return { name, key, inList: activeNames.has(normalizeProductSearch(name)) }; })).slice(0, 30);
}
