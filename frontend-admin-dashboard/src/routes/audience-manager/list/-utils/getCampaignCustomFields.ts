import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';

/**
 * Interface for campaign form custom field
 */
export interface CampaignFormCustomField {
    id: string;
    type: 'text' | 'dropdown' | 'number' | 'textfield';
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
const mapFieldType = (type: string): 'text' | 'dropdown' | 'number' | 'textfield' => {
    if (type === 'dropdown' || type === 'select') return 'dropdown';
    if (type === 'number') return 'number';
    if (type === 'textfield') return 'textfield';
    return 'text';
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
 * Get the institute's default custom fields, pre-selected for a brand-new
 * audience campaign create dialog.
 *
 * Custom Fields Revamp (2026-04): the previous implementation read fields
 * from a stale "Campaign" visibility checkbox. Per-feature visibility was
 * removed; admins now manage which fields are on a campaign from inside
 * the campaign create/edit dialog itself. This function returns the
 * institute's full default catalog (locked fixed fields + admin-created
 * defaults) so the picker starts with everything pre-selected. The admin
 * can untick before saving — only the ticked fields are persisted as
 * AUDIENCE_FORM mappings.
 *
 * Edit-mode pre-selection should fetch the existing ACTIVE mappings via
 * `GET /admin-core-service/common/custom-fields/feature-fields`
 * (type=AUDIENCE_FORM, typeId=<audienceId>) instead of calling this.
 */
export const getCampaignCustomFields = (): CampaignFormCustomField[] => {
    try {
        const settings = getCustomFieldSettingsFromCache();
        if (!settings) return [];

        const all = [
            ...(settings.fixedFields || []),
            ...(settings.customFields || []),
            ...(settings.instituteFields || []),
        ];
        if (all.length === 0) return [];

        return all
            .map((field, index): CampaignFormCustomField => {
                const fieldType = mapFieldType((field.type as string) || 'text');
                const transformed: CampaignFormCustomField = {
                    id: String(index),
                    type: fieldType,
                    name: field.name,
                    isRequired: field.required || false,
                    key: generateKeyFromName(field.name),
                    order: field.order ?? index,
                    _id: field.id,
                    status: 'ACTIVE',
                };
                if (
                    fieldType === 'dropdown' &&
                    'options' in field &&
                    field.options &&
                    field.options.length > 0
                ) {
                    transformed.options = field.options.map((opt, i) => ({
                        id: `${index}_opt_${i}`,
                        value: opt,
                        disabled: true,
                    }));
                }
                return transformed;
            })
            .sort((a, b) => a.order - b.order);
    } catch (err) {
        console.error('Error reading institute defaults for campaign picker:', err);
        return [];
    }
};

/**
 * Refresh campaign custom fields (call this when settings are updated)
 * This ensures the latest fields from settings are loaded
 */
export const refreshCampaignCustomFields = (): CampaignFormCustomField[] => {
    // The cache is automatically updated when settings are saved
    // This function just re-reads from cache
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
