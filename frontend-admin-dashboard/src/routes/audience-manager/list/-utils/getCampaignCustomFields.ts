import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';
import { fetchInstituteDefaultFields } from '@/services/custom-field-mappings';
import { getInstituteId } from '@/constants/helper';

/**
 * Interface for campaign form custom field
 */
export interface CampaignFormCustomField {
    id: string;
    type: string;
    name: string;
    isRequired: boolean;
    key: string;
    order: number;
    options?: Array<{ id: string; value: string; disabled?: boolean }>;
    _id?: string;
    status?: 'ACTIVE' | 'DELETED';
}

/**
 * Map field type to UI-compatible type
 */
const mapFieldType = (type: string): string => {
    if (type === 'select') return 'dropdown';
    if (type === 'textfield') return 'text';
    return type || 'text';
};

/**
 * Create snake_case key
 */
const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

/**
 * Default campaign fields used as a hardcoded fallback when:
 *   - the institute has no DEFAULT_CUSTOM_FIELD rows saved yet
 *   - the API fetch fails
 *
 * Kept in sync with the invite fallback (`getDefaultInviteFields`) so the
 * three seeded fields behave identically everywhere.
 */
const getDefaultCampaignFields = (): CampaignFormCustomField[] => {
    return [
        {
            id: '0',
            type: 'text',
            name: 'Full Name',
            isRequired: true,
            key: 'full_name',
            order: 0,
            status: 'ACTIVE',
        },
        {
            id: '1',
            type: 'text',
            name: 'Email',
            isRequired: true,
            key: 'email',
            order: 1,
            status: 'ACTIVE',
        },
        {
            id: '2',
            type: 'text',
            name: 'Phone Number',
            isRequired: true,
            key: 'phone_number',
            order: 2,
            status: 'ACTIVE',
        },
    ];
};

/**
 * Sync variant — intentionally returns an empty array.
 *
 * History: this function used to read from the localStorage settings cache
 * (`getCustomFieldSettingsFromCache().fixedFields + customFields + instituteFields`).
 * That approach broke the campaign picker in three ways:
 *   1. Stale cache data bled into brand-new campaigns.
 *   2. The production settings blob contains historical duplicates of
 *      Full Name / Email / Phone Number (see CUSTOM_FIELDS_PROD_CLEANUP.md),
 *      so the picker showed duplicate rows.
 *   3. The caller had to filter out Phone Number and re-seed Name/Email,
 *      which accidentally dropped Phone Number on environments where the
 *      cache was empty.
 *
 * The working invite flow (`getInviteListCustomFields`) solved this by
 * returning `[]` and delegating ALL loading to the async variant. We do the
 * same here — call `getCampaignCustomFieldsAsync()` in a useEffect and set
 * the form values once it resolves.
 */
export const getCampaignCustomFields = (): CampaignFormCustomField[] => {
    return [];
};

/**
 * Async variant that fetches DEFAULT_CUSTOM_FIELD mappings directly from the
 * live backend endpoint (`GET /common/custom-fields?instituteId=...`).
 * Bypasses the stale settings JSON blob entirely.
 *
 * - Deduplicates by field key so the historical duplicate rows in the
 *   production settings blob don't leak through.
 * - Falls back to `getDefaultCampaignFields()` (Full Name + Email + Phone
 *   Number) when the API returns nothing or the request fails.
 */
export const getCampaignCustomFieldsAsync = async (): Promise<CampaignFormCustomField[]> => {
    try {
        const instId = getInstituteId();
        if (!instId) return getDefaultCampaignFields();

        const defaults = await fetchInstituteDefaultFields(instId);
        if (!defaults || defaults.length === 0) return getDefaultCampaignFields();

        // Alias groups: when one variant is seen, mark all aliases as seen
        // so old-style (`name`, `phone`) and new-style (`full_name`,
        // `phone_number`) don't both appear.
        const NAME_ALIASES: string[][] = [
            ['full_name', 'name', 'fullname'],
            ['email', 'e_mail'],
            ['phone_number', 'phone', 'mobile_number', 'mobile', 'contact'],
        ];
        const aliasMap = new Map<string, string[]>();
        NAME_ALIASES.forEach((group) => {
            group.forEach((k) => aliasMap.set(k, group));
        });

        const seenKeys = new Set<string>();
        const result: CampaignFormCustomField[] = [];

        const markSeen = (key: string) => {
            seenKeys.add(key);
            const aliases = aliasMap.get(key);
            if (aliases) aliases.forEach((a) => seenKeys.add(a));
        };

        defaults.forEach((entry, index) => {
            const cf = entry.custom_field;
            if (!cf || !cf.fieldName) return;

            const key = generateKeyFromName(cf.fieldName);
            if (seenKeys.has(key)) return;
            markSeen(key);

            const fieldType = mapFieldType(cf.fieldType || 'text');
            const transformed: CampaignFormCustomField = {
                id: String(index),
                type: fieldType,
                name: cf.fieldName,
                isRequired: cf.isMandatory || false,
                key,
                order: entry.individual_order ?? cf.formOrder ?? index,
                _id: cf.id,
                status: 'ACTIVE',
            };

            if ((fieldType === 'dropdown' || fieldType === 'radio') && cf.config) {
                try {
                    const parsed = JSON.parse(cf.config);
                    if (Array.isArray(parsed)) {
                        transformed.options = parsed.map((opt: any, i: number) => ({
                            id: `${index}_opt_${i}`,
                            value: opt.value || opt.label || opt,
                            disabled: true,
                        }));
                    } else if (parsed.coommaSepartedOptions) {
                        transformed.options = parsed.coommaSepartedOptions
                            .split(',')
                            .map((v: string, i: number) => ({
                                id: `${index}_opt_${i}`,
                                value: v.trim(),
                                disabled: true,
                            }));
                    }
                } catch {
                    // ignore parse errors — the field still renders as its base type
                }
            }

            result.push(transformed);
        });

        // Ensure Full Name / Email / Phone Number are always present — add any
        // missing ones from the fallback defaults. Preserves backend-returned
        // fields if they exist, only fills the gaps.
        const fallbackBySeed = new Map(
            getDefaultCampaignFields().map((f) => [f.key, f])
        );
        ['full_name', 'email', 'phone_number'].forEach((seedKey) => {
            if (!seenKeys.has(seedKey)) {
                const fallback = fallbackBySeed.get(seedKey);
                if (fallback) {
                    seenKeys.add(seedKey);
                    result.push(fallback);
                }
            }
        });

        return result.sort((a, b) => a.order - b.order);
    } catch (err) {
        console.error('[getCampaignCustomFieldsAsync] API call failed, using fallback defaults:', err);
        return getDefaultCampaignFields();
    }
};

/**
 * Refresh campaign custom fields (kept for API compatibility — returns [])
 */
export const refreshCampaignCustomFields = (): CampaignFormCustomField[] => {
    return getCampaignCustomFields();
};

/**
 * Get field name by ID (utility)
 * Searches in: systemFields, fixedFields, instituteFields, customFields, and fieldGroups
 */
export const getCustomFieldNameById = (fieldId: string): string | undefined => {
    try {
        const settings = getCustomFieldSettingsFromCache();
        if (!settings) return;

        // Search in systemFields first (by matching key to field ID or name)
        // SystemFields have a 'key' property (like 'EMAIL', 'FULL_NAME') that might match
        const systemField = settings.systemFields?.find(f => {
            // Try to match by key converted to field ID format, or by customValue
            return f.key === fieldId || f.customValue === fieldId;
        });

        if (systemField) {
            return systemField.customValue || systemField.defaultValue;
        }

        // Search in fixedFields, instituteFields, customFields, and fieldGroups
        const match =
            settings.fixedFields.find(f => f.id === fieldId) ||
            settings.instituteFields.find(f => f.id === fieldId) ||
            settings.customFields.find(f => f.id === fieldId) ||
            settings.fieldGroups.flatMap(g => g.fields).find(f => f.id === fieldId);

        return match?.name;
    } catch (err) {
        console.error('Error in getCustomFieldNameById:', err);
        return;
    }
};

/**
 * Get ID → Name mapping
 */
export const getCustomFieldNamesByIds = (fieldIds: string[]): Map<string, string> => {
    const map = new Map<string, string>();
    fieldIds.forEach(id => {
        const name = getCustomFieldNameById(id);
        if (name) map.set(id, name);
    });
    return map;
};

/**
 * Build a complete map of all custom fields
 * Maps field IDs from: systemFields, fixedFields, instituteFields, customFields, and fieldGroups
 * This searches across all three objects: customFields, fixedFields, and systemFields
 */
export const getAllCustomFieldsMap = (): Map<string, { name: string; type?: string; key?: string }> => {
    const fieldMap = new Map();

    try {
        const settings = getCustomFieldSettingsFromCache();
        if (!settings) {
            console.warn('⚠️ [getAllCustomFieldsMap] No settings found in localStorage');
            return fieldMap;
        }

        // 1. Add systemFields (they use 'key' like 'EMAIL', 'FULL_NAME' and 'customValue' for the field name)
        // SystemFields don't have IDs, but we can map by their key or customValue
        if (settings.systemFields && settings.systemFields.length > 0) {
            settings.systemFields.forEach((systemField) => {
                const fieldName = systemField.customValue || systemField.defaultValue;
                const fieldKey = generateKeyFromName(fieldName);
                
                // Map by system key (like 'EMAIL', 'FULL_NAME') - convert to lowercase
                const systemKeyLower = systemField.key.toLowerCase();
                fieldMap.set(systemKeyLower, {
                    name: fieldName,
                    type: 'text',
                    key: fieldKey,
                });
                
                // Also map by customValue (the actual field name used)
                if (systemField.customValue) {
                    fieldMap.set(systemField.customValue, {
                        name: fieldName,
                        type: 'text',
                        key: fieldKey,
                    });
                }
                
                // Also map by the generated key (snake_case version)
                fieldMap.set(fieldKey, {
                    name: fieldName,
                    type: 'text',
                    key: fieldKey,
                });
            });
        }

        // 2. Add fixedFields (like name, email, phone - these have IDs)
        settings.fixedFields.forEach((field) => {
            const fieldType = (field as any).type ?? "text";
            const fieldKey = generateKeyFromName(field.name);
            
            // Map by field ID (primary)
            fieldMap.set(field.id, {
                name: field.name,
                type: mapFieldType(fieldType),
                key: fieldKey,
            });
            
            // Also map by field name and key for flexibility
            fieldMap.set(field.name.toLowerCase(), {
                name: field.name,
                type: mapFieldType(fieldType),
                key: fieldKey,
            });
            fieldMap.set(fieldKey, {
                name: field.name,
                type: mapFieldType(fieldType),
                key: fieldKey,
            });
        });

        // 3. Add instituteFields
        settings.instituteFields.forEach((field) => {
            const fieldType = field.type ?? "text";
            const fieldKey = generateKeyFromName(field.name);
            
            fieldMap.set(field.id, {
                name: field.name,
                type: mapFieldType(fieldType),
                key: fieldKey,
            });
        });

        // 4. Add customFields
        settings.customFields.forEach((field) => {
            const fieldType = field.type ?? "text";
            const fieldKey = generateKeyFromName(field.name);
            
            fieldMap.set(field.id, {
                name: field.name,
                type: mapFieldType(fieldType),
                key: fieldKey,
            });
        });

        // 5. Add fieldGroups
        settings.fieldGroups.forEach((group) => {
            group.fields.forEach((field) => {
                const fieldType = field.type ?? "text";
                const fieldKey = generateKeyFromName(field.name);
                
                fieldMap.set(field.id, {
                    name: field.name,
                    type: mapFieldType(fieldType),
                    key: fieldKey,
                });
            });
        });
        
    } catch (err) {
        console.error('❌ Error in getAllCustomFieldsMap:', err);
        return new Map();
    }
    
    console.log('📋 [getAllCustomFieldsMap] Total fields mapped:', fieldMap.size);
    return fieldMap;
};
