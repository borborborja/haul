import type { Categories } from '../../types';
import { localized } from './model';

// Best-effort category detection for free-typed product names:
// match the typed name against any catalog item in any language, else 'other'.
export function guessCategory(name: string, categories: Categories): string {
    const q = name.trim().toLowerCase();
    if (!q) return 'other';
    for (const key of Object.keys(categories)) {
        for (const item of categories[key].items) {
            const candidates = typeof item === 'string'
                ? [item]
                : [localized(item, 'ca'), localized(item, 'es'), localized(item, 'en'), item.ca, item.es, item.en];
            if (candidates.some((c) => c && c.toLowerCase() === q)) return key;
        }
    }
    return 'other';
}
