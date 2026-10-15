function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateText(row: Record<string, unknown>, key: string, max: number, required = false): void {
    const value = row[key];
    if (value === undefined && !required) return;
    if (typeof value !== 'string' || (required && !value.trim()) || [...value].length > max) {
        throw new Error(`Campo de catálogo inválido: ${key}`);
    }
}

function validateMetadata(row: Record<string, unknown>): void {
    if (row.hidden !== undefined && typeof row.hidden !== 'boolean') throw new Error('Visibilidad inválida');
    if (row.i18n === undefined || row.i18n === null) return;
    if (!isRecord(row.i18n) || Object.values(row.i18n).some(value => typeof value !== 'string')) {
        throw new Error('Traducciones inválidas');
    }
    // Match the JSON field's byte limit, including Go's HTML escaping.
    const json = JSON.stringify(row.i18n).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
    if (new TextEncoder().encode(json).length > 65_536) throw new Error('Traducciones demasiado grandes');
}

// Check every row against the PocketBase schema before a substitute import
// deletes the existing catalog. Older exports without i18n/order remain valid.
export function validateCatalogBackup(data: unknown): void {
    if (!isRecord(data) || !Array.isArray(data.categories) || !Array.isArray(data.items)) {
        throw new Error('Formato de backup inválido');
    }
    const keys = new Set<string>();
    for (const category of data.categories) {
        if (!isRecord(category)) throw new Error('Categoría inválida');
        validateText(category, 'key', 80, true);
        const key = category.key as string;
        if (keys.has(key)) throw new Error('Categoría duplicada');
        keys.add(key);
        validateText(category, 'icon', 20);
        validateText(category, 'color', 30);
        for (const language of ['es', 'ca', 'en']) validateText(category, `name_${language}`, 200);
        if (category.order !== undefined && (typeof category.order !== 'number' || !Number.isFinite(category.order))) {
            throw new Error('Orden de categoría inválido');
        }
        validateMetadata(category);
    }
    for (const item of data.items) {
        if (!isRecord(item) || typeof item.category_key !== 'string' || !keys.has(item.category_key)) {
            throw new Error('Producto sin categoría válida');
        }
        for (const language of ['es', 'ca', 'en']) validateText(item, `name_${language}`, 200, true);
        validateMetadata(item);
    }
}
