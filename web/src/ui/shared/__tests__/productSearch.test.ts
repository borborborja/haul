import { describe, expect, it } from 'vitest';
import { catalogMatches, normalizeProductSearch } from '../productSearch';
import type { Categories } from '../../../types';

const categories: Categories = {
    drinks: { icon: '☕', items: [{ en: 'Coffee beans', ca: 'Cafè en gra', es: 'Café en grano', _catalogId: 'secret_id', _catalogKind: 'global' }] },
    hidden: { icon: '📦', items: [{ en: 'Hidden coffee', ca: 'Cafè amagat', es: 'Café oculto' }] },
};
describe('catalog search', () => {
    it('matches accents, repeated spaces and translated variants while displaying the selected language', () => {
        expect(normalizeProductSearch('  CAFÈ   en GRA  ')).toBe('cafe en gra');
        expect(catalogMatches(categories, 'cafe  en gra', 'en', ['hidden'], [], [])).toEqual([{ name: 'Coffee beans', key: 'drinks', inList: false }]);
    });
    it('honors identity-based and legacy hidden products and never searches metadata', () => {
        expect(catalogMatches(categories, 'coffee', 'en', ['hidden'], ['source:global:secret_id'], [])).toEqual([]);
        expect(catalogMatches(categories, 'coffee', 'en', ['hidden'], ['coffee beans'], [])).toEqual([]);
        expect(catalogMatches(categories, 'secret_id', 'en', [], [], [])).toEqual([]);
    });
});
