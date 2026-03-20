import {
    getCustomFieldSettingsFromCache,
    type CustomField,
    type FixedField,
    type GroupField,
    type FieldVisibility,
} from '../../services/custom-field-settings';

// Location mapping for field visibility
const LOCATION_TO_VISIBILITY_KEY: Record<string, keyof FieldVisibility> = {
    "Learner's List": 'learnersList',
    Campaign: 'campaign',
    'Enroll Request List': 'enrollRequestList',
    'Invite List': 'inviteList',
    'Assessment Registration Form': 'assessmentRegistration',
    'Live Session Registration Form': 'liveSessionRegistration',
    'Learner Profile': 'learnerProfile',
    "Learner's Enrollment": 'learnerEnrollment',
};

// Type for fields that can be returned (all field types have common properties we need)
export type FieldForLocation = {
    id: string;
    name: string;
    type?: 'text' | 'dropdown' | 'number';
    options?: string[];
    required: boolean;
    order: number;
    groupName?: string; // For group fields
    groupInternalOrder?: number; // For group fields
    canBeDeleted: boolean;
    canBeEdited: boolean;
    canBeRenamed: boolean;
};

/**
 * Get custom fields for a specific location from stored settings
 *
 * @param location - The location/page where fields should be displayed
 *                   e.g., "Learner's List", "Enroll Request List", "Invite List", etc.
 * @returns Array of fields that are visible for the specified location, sorted by order
 */
export const getFieldsForLocation = (location: string): FieldForLocation[] => {
    try {
        // Get cached settings from storage
        const settings = getCustomFieldSettingsFromCache();

        if (!settings) {
            console.warn(`No custom field settings found in storage for location: ${location}`);
            return [];
        }

        // Get the visibility key for this location
        const visibilityKey = LOCATION_TO_VISIBILITY_KEY[location];

        if (!visibilityKey) {
            console.warn(
                `Unknown location: ${location}. Available locations:`,
                Object.keys(LOCATION_TO_VISIBILITY_KEY)
            );
            return [];
        }

        const fieldsForLocation: FieldForLocation[] = [];

        // Process fixed fields (system fields like name, email, etc.)
        settings.fixedFields.forEach((field: FixedField) => {
            if (field.visibility[visibilityKey]) {
                fieldsForLocation.push({
                    id: field.id,
                    name: field.name,
                    required: field.required,
                    order: field.order,
                    canBeDeleted: field.canBeDeleted,
                    canBeEdited: field.canBeEdited,
                    canBeRenamed: field.canBeRenamed,
                });
            }
        });

        // Process institute fields (custom fields created by institute)
        settings.instituteFields.forEach((field: CustomField) => {
            if (field.visibility[visibilityKey]) {
                fieldsForLocation.push({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    options: field.options,
                    required: field.required,
                    order: field.order,
                    canBeDeleted: field.canBeDeleted,
                    canBeEdited: field.canBeEdited,
                    canBeRenamed: field.canBeRenamed,
                });
            }
        });

        // Process custom fields (user-created fields)
        settings.customFields.forEach((field: CustomField) => {
            if (field.visibility[visibilityKey]) {
                fieldsForLocation.push({
                    id: field.id,
                    name: field.name,
                    type: field.type,
                    options: field.options,
                    required: field.required,
                    order: field.order,
                    canBeDeleted: field.canBeDeleted,
                    canBeEdited: field.canBeEdited,
                    canBeRenamed: field.canBeRenamed,
                });
            }
        });

        // Process field groups (grouped fields)
        settings.fieldGroups.forEach((group) => {
            group.fields.forEach((field: GroupField) => {
                if (field.visibility[visibilityKey]) {
                    fieldsForLocation.push({
                        id: field.id,
                        name: field.name,
                        type: field.type,
                        options: 'options' in field ? field.options : undefined,
                        required: field.required,
                        order: field.order,
                        groupName: group.name,
                        groupInternalOrder: field.groupInternalOrder,
                        canBeDeleted: field.canBeDeleted,
                        canBeEdited: field.canBeEdited,
                        canBeRenamed: field.canBeRenamed,
                    });
                }
            });
        });

        // Sort fields by order (primary) and group internal order (secondary for group fields)
        fieldsForLocation.sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            // If both are group fields with the same order, sort by group internal order
            if (a.groupInternalOrder !== undefined && b.groupInternalOrder !== undefined) {
                return a.groupInternalOrder - b.groupInternalOrder;
            }
            return 0;
        });

        return fieldsForLocation;
    } catch (error) {
        console.error(`Error getting fields for location "${location}":`, error);
        return [];
    }
};

/**
 * Get all available locations that have custom fields configured
 *
 * @returns Array of location names that have at least one field configured
 */
export const getAvailableLocations = (): string[] => {
    try {
        const settings = getCustomFieldSettingsFromCache();

        if (!settings) {
            return [];
        }

        const locationsWithFields = new Set<string>();

        // Check all field types for their visibility settings
        const allFields = [
            ...settings.fixedFields,
            ...settings.instituteFields,
            ...settings.customFields,
            ...settings.fieldGroups.flatMap((group) => group.fields),
        ];

        allFields.forEach((field) => {
            Object.entries(field.visibility).forEach(([visibilityKey, isVisible]) => {
                if (isVisible) {
                    // Find the location name for this visibility key
                    const location = Object.entries(LOCATION_TO_VISIBILITY_KEY).find(
                        ([, vKey]) => vKey === visibilityKey
                    )?.[0];

                    if (location) {
                        locationsWithFields.add(location);
                    }
                }
            });
        });

        return Array.from(locationsWithFields).sort();
    } catch (error) {
        console.error('Error getting available locations:', error);
        return [];
    }
};

/**
 * Get field counts for each location
 *
 * @returns Object with location names as keys and field counts as values
 */
export const getFieldCountsByLocation = (): Record<string, number> => {
    try {
        const locationCounts: Record<string, number> = {};

        // Initialize all locations with 0
        Object.keys(LOCATION_TO_VISIBILITY_KEY).forEach((location) => {
            locationCounts[location] = 0;
        });

        // Count fields for each location
        Object.keys(LOCATION_TO_VISIBILITY_KEY).forEach((location) => {
            locationCounts[location] = getFieldsForLocation(location).length;
        });

        return locationCounts;
    } catch (error) {
        console.error('Error getting field counts by location:', error);
        return {};
    }
};

/**
 * Check if a specific field is visible in a given location
 *
 * @param fieldId - The ID of the field to check
 * @param location - The location to check visibility for
 * @returns Boolean indicating if the field is visible in the location
 */
export const isFieldVisibleInLocation = (fieldId: string, location: string): boolean => {
    try {
        const fieldsForLocation = getFieldsForLocation(location);
        return fieldsForLocation.some((field) => field.id === fieldId);
    } catch (error) {
        console.error(
            `Error checking field visibility for field ${fieldId} in location ${location}:`,
            error
        );
        return false;
    }
};

/**
 * Get required fields for a specific location
 *
 * @param location - The location to get required fields for
 * @returns Array of required fields for the specified location
 */
export const getRequiredFieldsForLocation = (location: string): FieldForLocation[] => {
    try {
        const allFields = getFieldsForLocation(location);
        return allFields.filter((field) => field.required);
    } catch (error) {
        console.error(`Error getting required fields for location "${location}":`, error);
        return [];
    }
};
