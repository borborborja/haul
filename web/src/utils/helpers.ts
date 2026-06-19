import type { Lang, LocalizedItem } from '../types';

export const getLocalizedItemName = (bestName: LocalizedItem | string | any, lang: Lang): string => {
    if (typeof bestName === 'string') return bestName;
    if (!bestName) return '???';
    return bestName[lang] || bestName['es'] || bestName['ca'] || Object.values(bestName)[0] as string;
};
