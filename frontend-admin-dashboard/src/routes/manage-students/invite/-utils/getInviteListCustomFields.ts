import { getFieldsForLocation } from '@/lib/custom-fields/utils';

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
 * Get custom fields for Invite List location from localStorage
 * Transforms them into the format expected by the invite form
 */
export const getInviteListCustomFields = (): InviteFormCustomField[] => {
    try {
        // Get custom fields for "Invite List" location
        const customFields = getFieldsForLocation('Invite List');

        if (!customFields || customFields.length === 0) {
            return getDefaultInviteFields();
        }

        // Transform custom fields to invite form format
        const transformedFields: InviteFormCustomField[] = customFields.map((field, index) => {
            const isOldKey = false;
            const fieldKey = generateKeyFromName(field.name);

            const transformedField: InviteFormCustomField = {
                id: String(index), // Use index as string ID for form
                type: mapFieldType(field.type || 'text'),
                name: field.name,
                oldKey: isOldKey,
                isRequired: field.required || false,
                key: fieldKey,
                order: index,
                _id: field.id, // Store the actual custom field ID from localStorage
                status: 'ACTIVE',
            };

            // Add options if it's a dropdown field
            if (field.type === 'dropdown' && field.options && field.options.length > 0) {
                transformedField.options = field.options.map((option, optIndex) => ({
                    id: `${index}_option_${optIndex}`,
                    value: option,
                    disabled: true,
                }));
            }

            return transformedField;
        });

        return transformedFields;
    } catch (error) {
        console.error('❌ Error getting invite list custom fields:', error);
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
