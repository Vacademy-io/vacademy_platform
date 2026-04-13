import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';

/**
 * Interface for invite form custom field
 */
export interface InviteFormCustomField {
    id: string; // Form-level ID (can be numeric string or UUID)
    type: 'text' | 'dropdown' | 'number';
    name: string;
    oldKey: boolean;
    isRequired: boolean;
    key: string;
    order: number;
    options?: Array<{ id: string; value: string; disabled?: boolean }>;
    _id?: string; // Custom field ID from localStorage (for API payload)
    status?: 'ACTIVE' | 'DELETED';
}

/**
 * Map custom field types to invite form field types
 */
const mapFieldType = (type: string): 'text' | 'dropdown' | 'number' => {
    if (type === 'dropdown' || type === 'select') {
        return 'dropdown';
    }
    if (type === 'number') {
        return 'number';
    }
    return 'text';
};

/**
 * Generate a key from field name (convert to snake_case)
 */
const generateKeyFromName = (name: string): string => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

/**
 * Get the institute's default custom fields, pre-selected for a brand-new
 * invite create dialog.
 *
 * Custom Fields Revamp (2026-04): the previous implementation read from a
 * stale "Invite List" visibility checkbox. The revamp moved per-feature
 * field selection out of Settings and into each feature's create/edit
 * dialog, so the picker is now seeded from the institute's default catalog
 * (every CustomField + FixedField stored in `CUSTOM_FIELD_SETTING`). The
 * admin can untick anything in the dialog before saving — only the ticked
 * fields are persisted as ENROLL_INVITE mappings on save.
 *
 * Edit-mode pre-selection should fetch the existing ACTIVE mappings for
 * the invite via `GET /admin-core-service/common/custom-fields/feature-fields`
 * (type=ENROLL_INVITE, typeId=<inviteId>) instead of calling this function.
 */
export const getInviteListCustomFields = (): InviteFormCustomField[] => {
    try {
        const settings = getCustomFieldSettingsFromCache();
        if (!settings) {
            return getDefaultInviteFields();
        }

        // Combine fixed (locked seeded) + admin-created custom fields. The
        // institute owns all of these as DEFAULT_CUSTOM_FIELD mappings, so
        // pre-selecting all of them is the right starting state.
        const all = [
            ...(settings.fixedFields || []),
            ...(settings.customFields || []),
            ...(settings.instituteFields || []),
        ];

        if (all.length === 0) {
            return getDefaultInviteFields();
        }

        return all
            .map((field, index): InviteFormCustomField => {
                const fieldType = mapFieldType((field.type as string) || 'text');
                const transformed: InviteFormCustomField = {
                    id: String(index),
                    type: fieldType,
                    name: field.name,
                    // System-locked fields stay marked oldKey: true so the
                    // dialog hides their delete button.
                    oldKey: !field.canBeDeleted,
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
                    transformed.options = field.options.map((option, optIndex) => ({
                        id: `${index}_option_${optIndex}`,
                        value: option,
                        disabled: true,
                    }));
                }
                return transformed;
            })
            .sort((a, b) => a.order - b.order);
    } catch (error) {
        console.error('Error reading institute defaults for invite picker:', error);
        return getDefaultInviteFields();
    }
};

/**
 * Get default invite fields (fallback)
 */
const getDefaultInviteFields = (): InviteFormCustomField[] => {
    return [
        {
            id: '0',
            type: 'text',
            name: 'Full Name',
            oldKey: true,
            isRequired: true,
            key: 'full_name',
            order: 0,
            status: 'ACTIVE',
        },
        {
            id: '1',
            type: 'text',
            name: 'Email',
            oldKey: true,
            isRequired: true,
            key: 'email',
            order: 1,
            status: 'ACTIVE',
        },
        {
            id: '2',
            type: 'text',
            name: 'Phone Number',
            oldKey: true,
            isRequired: true,
            key: 'phone_number',
            order: 2,
            status: 'ACTIVE',
        },
    ];
};

/**
 * Refresh custom fields for invite list (call this when custom fields are updated)
 */
export const refreshInviteListCustomFields = (): InviteFormCustomField[] => {
    // Clear any cached data if needed
    return getInviteListCustomFields();
};
