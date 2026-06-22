import type { UIDict } from '../../data/i18n';

// "Bought by X" for a checked item, else "Added by Y". Empty when unknown.
export function attribution(it: { checked?: boolean; checkedBy?: string; addedBy?: string }, t: UIDict): string {
    if (it.checked && it.checkedBy) return t.boughtByLabel.replace('{x}', it.checkedBy);
    if (it.addedBy) return t.addedByLabel.replace('{x}', it.addedBy);
    return '';
}
