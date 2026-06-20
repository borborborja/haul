import type { Lang, LocalizedItem } from '../types';

export const getLocalizedItemName = (bestName: LocalizedItem | string | any, lang: Lang): string => {
    if (typeof bestName === 'string') return bestName;
    if (!bestName) return '???';
    return bestName[lang] || bestName['es'] || bestName['ca'] || Object.values(bestName)[0] as string;
};

// Stable, language-independent key for a catalog product (used by the per-list
// "deactivated products" feature so it matches across display languages).
// Both web and Android use lowercase(trim(english/base name)).
export const canonicalKey = (item: LocalizedItem | string): string => {
    const s = typeof item === 'string' ? item : (item.en || item.es || item.ca || '');
    return s.trim().toLowerCase();
};

// All localized variants of a catalog item, lowercased — to match shopping items
// (whose stored name may be in any language) when deactivating.
export const localizedVariants = (item: LocalizedItem | string): string[] => {
    if (typeof item === 'string') return [item.trim().toLowerCase()];
    return [item.en, item.es, item.ca].filter(Boolean).map((s) => s.trim().toLowerCase());
};
