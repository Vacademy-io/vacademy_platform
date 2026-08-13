import type { CustomFieldConfig } from './AddCustomFieldDialog';

/**
 * Per-field settings (help text, default value, checkbox heading/body, file constraints) travel
 * as one JSON string so a new setting never needs a new column. These two helpers are the only
 * place that shape is written or read.
 */

/**
 * Turns the dialog's config into the string stored on the field. Returns '' when there is
 * nothing to store — callers send that rather than omitting the key, so clearing help text
 * actually clears it instead of leaving the previous value in place.
 */
export const serializeFieldConfig = (config?: CustomFieldConfig): string => {
    if (!config) return '';
    // isRequired is a column of its own, not a setting — keeping a copy here would let the two
    // drift apart.
    const { isRequired: _isRequired, ...settings } = config;
    const present = Object.entries(settings).filter(
        ([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)
    );
    return present.length > 0 ? JSON.stringify(Object.fromEntries(present)) : '';
};

/** Reads a stored config string back. Anything unparseable is treated as "no settings". */
export const parseFieldConfig = (config?: string | null): CustomFieldConfig | undefined => {
    if (!config) return undefined;
    try {
        const parsed = JSON.parse(config);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as CustomFieldConfig)
            : undefined;
    } catch {
        return undefined;
    }
};
