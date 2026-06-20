// Derives the prototypes' view-model from the Zustand engine.
// Pure-ish helpers so the mobile and desktop shells share identical logic.
import { useMemo } from 'react';
import { useShopStore } from '../../store/shopStore';
import { tt } from '../../data/i18n';
import type { ShopItem, Categories, Lang, LocalizedItem } from '../../types';
import { catColor } from '../theme';
import { canonicalKey } from '../../utils/helpers';

// Catalog item names only carry es/ca/en; for other UI languages fall back to
// English text (the catalog content itself isn't translated to all 15 langs).
export const localized = (item: LocalizedItem | string, lang: Lang): string =>
    typeof item === 'string' ? item : ((item as any)[lang] || item.en || item.es || item.ca || '');

export const catLabel = (key: string, lang: Lang, names?: LocalizedItem): string => {
    if (names && (names as any)[lang]) return (names as any)[lang];
    const cats = tt(lang).cats as Record<string, string>;
    return cats[key] || (names && (names.en || names.es || names.ca)) || key.charAt(0).toUpperCase() + key.slice(1);
};

export interface Group {
    key: string;
    label: string;
    emoji: string;
    color: string;
    count: number;
    items: ShopItem[];
}

export const buildGroups = (items: ShopItem[], categories: Categories, lang: Lang): Group[] => {
    const order: string[] = [];
    const map: Record<string, ShopItem[]> = {};
    items.forEach((it) => {
        if (!map[it.category]) { map[it.category] = []; order.push(it.category); }
        map[it.category].push(it);
    });
    return order.map((key) => ({
        key,
        label: catLabel(key, lang, categories[key]?.names),
        emoji: categories[key]?.icon || '🛒',
        color: catColor(key, categories[key]?.color),
        count: map[key].length,
        items: map[key],
    }));
};

export function useHaulModel() {
    const items = useShopStore((s) => s.items);
    const categories = useShopStore((s) => s.categories);
    const disabledProducts = useShopStore((s) => s.disabledProducts);
    const lang = useShopStore((s) => s.lang);
    const lists = useShopStore((s) => s.lists);
    const activeListId = useShopStore((s) => s.activeListId);
    const listCaches = useShopStore((s) => s.listCaches);

    const t = tt(lang);

    const inList = useMemo(() => items.filter((i) => i.inList !== false), [items]);
    const recent = useMemo(() => items.filter((i) => i.inList === false), [items]);
    const groups = useMemo(() => buildGroups(inList, categories, lang), [inList, categories, lang]);
    const pending = useMemo(() => inList.filter((i) => !i.checked), [inList]);
    const completed = useMemo(() => inList.filter((i) => i.checked), [inList]);

    const total = inList.length;
    const done = completed.length;
    const frac = total ? done / total : 0;

    // Catalog bands (category chips) + items for the active band.
    const bands = useMemo(
        () => Object.keys(categories).map((key) => ({
            key,
            label: catLabel(key, lang, categories[key].names),
            emoji: categories[key].icon,
            color: catColor(key, categories[key].color),
        })),
        [categories, lang],
    );

    const currentNames = useMemo(
        () => new Set(inList.map((i) => i.name.toLowerCase())),
        [inList],
    );

    const disabledSet = useMemo(() => new Set(disabledProducts), [disabledProducts]);
    const bandItems = (key: string) =>
        (categories[key]?.items || [])
            .filter((it) => !disabledSet.has(canonicalKey(it)))
            .map((it) => {
                const name = localized(it, lang);
                return { name, inList: currentNames.has(name.toLowerCase()) };
            });

    // Multi-list summary for switchers.
    const listSummaries = useMemo(
        () => lists.map((l) => {
            const isActive = l.id === activeListId;
            const cacheItems = isActive ? inList : (listCaches[l.id]?.items?.filter((i) => i.inList !== false) ?? []);
            const d = cacheItems.filter((i) => i.checked).length;
            return {
                id: l.id,
                name: l.name,
                emoji: l.emoji,
                progress: `${d} / ${cacheItems.length}`,
                active: isActive,
            };
        }),
        [lists, activeListId, listCaches, inList],
    );

    const isDisabled = (it: LocalizedItem | string) => disabledSet.has(canonicalKey(it));

    return { t, lang, categories, groups, recent, pending, completed, total, done, frac, bands, bandItems, listSummaries, isDisabled };
}
