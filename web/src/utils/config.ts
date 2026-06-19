// app_config values are stored in a PocketBase JSON field, so a flag saved as
// the string "true"/"false" is normalized and read back as a real boolean.
// Compare robustly against both representations instead of `value === 'true'`.
export const isConfigEnabled = (value: unknown, fallback = false): boolean => {
    if (value === undefined || value === null || value === '') return fallback;
    return value === true || value === 'true';
};
