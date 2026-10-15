import type { UIDict } from '../../data/i18n';

export function productErrorMessage(code: string | null | undefined, t: UIDict) {
    if (code === 'invalid_product') return t.invalidName;
    if (code === 'duplicate_product') return t.duplicateProduct;
    if (code === 'quantity_unsupported') return t.quantityUnavailable;
    if (code === 'permission_denied') return t.permissionDenied;
    return t.errorSaving;
}
