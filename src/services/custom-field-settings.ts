import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    GET_CUSTOM_FIELD_LIST_WITH_USAGE,
    GET_INSITITUTE_SETTINGS,
    UPDATE_CUSTOM_FIELD_SETTINGS,
} from '@/constants/urls';

const CUSTOM_FIELD_SETTINGS_KEY = 'CUSTOM_FIELD_SETTING';
const LOCALSTORAGE_KEY = 'custom-field-settings-cache';
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

// Config JSON structure for dropdown options
export interface DropdownOptionConfig {
    id: number;
    value: string;
    label: string;
}

// API Response Types (what we get from GET_INSITITUTE_SETTINGS)
export interface ApiCustomField {
    id: string;
    customFieldId: string;
    instituteId: string;
    groupName: string | null;
    fieldName: string;
    fieldType: 'text' | 'number' | 'dropdown';
    individualOrder: number;
    groupInternalOrder: number | null;
    canBeDeleted: boolean;
    canBeEdited: boolean;
    canBeRenamed: boolean;
    locations: string[];
    status: string;
    config?: string; // JSON string for dropdown options: [{id: number, value: string, label: string}]
}

export interface ApiGroupField {
    id: string;
    customFieldId: string;
    instituteId: string;
    groupName: string;
    fieldName: string;
    fieldType: string;
    individualOrder: number;
    groupInternalOrder: number;
    canBeDeleted: boolean;
    canBeEdited: boolean;
    canBeRenamed: boolean;
    locations: string[];
    status: string;
    config?: string; // JSON string for dropdown options: [{id: number, value: string, label: string}]
}

export interface ApiCustomFieldResponse {
    key: string;
    name: string;
    data: {
        data: {
            groupNames: string[] | null;
            customFieldsNames: string[];
            currentCustomFieldsAndGroups: ApiCustomField[];
            customGroup: Record<string, ApiGroupField>;
            compulsoryCustomFields: string[];
            fixedCustomFields: string[];
            allCustomFields: string[];
            fixedFieldRenameDtos: Array<{
                key: string;
                defaultValue: string;
                customValue: string;
                order: number;
                visibility: boolean;
            }>;
            customFieldLocations: string[];
        };
    };
}

export interface ApiCustomFieldUsageItem {
    custom_field: {
        id: string; // uuid
        fieldKey: string;
        fieldName: string;
        fieldType: string;
        instituteId: string;
        status: string;
        config?: string;
    };
    enroll_invite_count: number;
    audience_count: number;
    default?: boolean;
}

export type ApiCustomFieldUsageResponse = ApiCustomFieldUsageItem[];

// API Request Types (what we send to UPDATE_CUSTOM_FIELD_SETTINGS)
// Note: The API expects snake_case field names
export interface ApiCustomFieldRequest {
    custom_fields_and_groups: ApiCustomField[];
    custom_group: Record<string, ApiGroupField>;
    custom_fields_names: string[];
    compulsory_custom_fields: string[];
    fixed_custom_fields: string[];
    all_custom_fields: string[];
    custom_field_locations: string[];
    group_names?: string[];
    fixed_field_rename_dtos: Array<{
        key: string;
        defaultValue: string;
        customValue: string;
        order: number;
        visibility: boolean;
    }>;
}

// System Field (for fixedFieldRenameDtos)
export interface SystemField {
    key: string;
    defaultValue: string;
    customValue: string;
    order: number;
    visibility: boolean;
}

export interface CustomFieldUsage {
    enrollInviteCount: number;
    audienceCount: number;
    isDefault: boolean;
}

// Field Visibility Interface
export interface FieldVisibility {
    campaign: boolean;
    learnersList: boolean;
    learnerEnrollment: boolean;
    enrollRequestList: boolean;
    inviteList: boolean;
    assessmentRegistration: boolean;
    liveSessionRegistration: boolean;
    learnerProfile: boolean;
    enquiry: boolean;
}

// Custom Field (fully editable)
export interface CustomField {
    id: string; // uuid
    name: string;
    type: 'text' | 'dropdown' | 'number';
    options?: string[]; // for dropdown
    required: boolean;
    visibility: FieldVisibility;
    order: number;
    canBeDeleted: boolean;
    canBeEdited: boolean;
    canBeRenamed: boolean;
    groupName: string | null;
    usage?: CustomFieldUsage;
}

// Type for creating new custom fields (without ID - backend will assign)
export interface NewCustomField {
    name: string;
    type: 'text' | 'dropdown' | 'number';
    options?: string[];
    visibility: FieldVisibility;
    required: boolean;
    order?: number;
}

export interface FixedField {
    id: string; // customFieldId from API
    name: string;
    type: 'text' | 'dropdown' | 'number';
    options?: string[];
    visibility: FieldVisibility;
    required: boolean;
    canBeDeleted: boolean;
    canBeEdited: boolean;
    canBeRenamed: boolean;
    order: number;
    groupName: string | null; // Comma-separated group names if field is in multiple groups
    usage?: CustomFieldUsage;
}

export interface FieldGroup {
    id: string;
    name: string;
    fields: GroupField[];
    order: number;
}

export interface GroupField {
    id: string; // customFieldId from API
    name: string;
    type: 'text' | 'dropdown' | 'number';
    options?: string[];
    visibility: FieldVisibility;
    required: boolean;
    canBeDeleted: boolean;
    canBeEdited: boolean;
    canBeRenamed: boolean;
    order: number;
    groupInternalOrder: number;
    groupName: string | null; // Comma-separated group names if field is in multiple groups
}

// Type for creating new group fields (without ID - backend will assign)
export interface NewGroupField {
    name: string;
    type: 'text' | 'dropdown' | 'number';
    options?: string[];
    visibility: FieldVisibility;
    required: boolean;
    groupInternalOrder: number;
}

export interface CustomFieldSettingsData {
    systemFields: SystemField[]; // System fields from fixedFieldRenameDtos
    fixedFields: FixedField[];
    instituteFields: CustomField[];
    customFields: CustomField[];
    fieldGroups: FieldGroup[];
    lastUpdated?: string;
    version?: number;
}

interface CachedCustomFieldSettings {
    data: CustomFieldSettingsData;
    timestamp: number;
    instituteId: string;
}

// Location mapping dictionary
const LOCATION_TO_VISIBILITY_MAP: Record<string, keyof FieldVisibility> = {
    Campaign: 'campaign',
    "Learner's List": 'learnersList',
    "Learner's Enrollment": 'learnerEnrollment',
    'Enroll Request List': 'enrollRequestList',
    'Invite List': 'inviteList',
    'Assessment Registration Form': 'assessmentRegistration',
    'Live Session Registration Form': 'liveSessionRegistration',
    'Learner Profile': 'learnerProfile',
    Enquiry: 'enquiry',
};

const VISIBILITY_TO_LOCATION_MAP: Record<keyof FieldVisibility, string> = {
    campaign: 'Campaign',
    learnersList: "Learner's List",
    learnerEnrollment: "Learner's Enrollment",
    enrollRequestList: 'Enroll Request List',
    inviteList: 'Invite List',
    assessmentRegistration: 'Assessment Registration Form',
    liveSessionRegistration: 'Live Session Registration Form',
    learnerProfile: 'Learner Profile',
    enquiry: 'Enquiry',
};

// System field identifiers (fieldName from API)
const SYSTEM_FIELD_NAMES = ['name', 'email', 'username', 'password', 'batch', 'phone'];

/**
 * Convert options array (UI format) to config JSON string (API format)
 * @param options - Array of option strings from the UI
 * @returns JSON string with format: [{id: number, value: string, label: string}]
 */
export const optionsToConfigJson = (options?: string[]): string | undefined => {
    if (!options || options.length === 0) {
        return undefined;
    }

    const config: DropdownOptionConfig[] = options.map((option, index) => ({
        id: index + 1,
        value: option,
        label: option,
    }));

    return JSON.stringify(config);
};

/**
 * Convert config JSON string (API format) to options array (UI format)
 * @param configJson - JSON string from API with format: [{id: number, value: string, label: string}]
 * @returns Array of option strings for the UI
 */
export const configJsonToOptions = (configJson?: string): string[] | undefined => {
    if (!configJson) {
        return undefined;
    }

    try {
        const config: DropdownOptionConfig[] = JSON.parse(configJson);
        return config.map((item) => item.value);
    } catch (error) {
        console.error('❌ [DEBUG] Error parsing config JSON:', error);
        return undefined;
    }
};

/**
 * Default system fields based on table columns
 * Used when API returns empty fixedFieldRenameDtos (first time setup)
 */
export const DEFAULT_SYSTEM_FIELDS: SystemField[] = [
    {
        key: 'FULL_NAME',
        defaultValue: 'Full Name',
        customValue: 'Full Name',
        order: 1,
        visibility: true,
    },
    {
        key: 'USERNAME',
        defaultValue: 'Username',
        customValue: 'Username',
        order: 2,
        visibility: true,
    },
    {
        key: 'PACKAGE_SESSION_ID',
        defaultValue: 'Batch',
        customValue: 'Batch',
        order: 3,
        visibility: true,
    },
    {
        key: 'INSTITUTE_ENROLLMENT_ID',
        defaultValue: 'Enrollment Number',
        customValue: 'Enrollment Number',
        order: 4,
        visibility: true,
    },
    {
        key: 'LINKED_INSTITUTE_NAME',
        defaultValue: 'College/School',
        customValue: 'College/School',
        order: 5,
        visibility: true,
    },
    { key: 'GENDER', defaultValue: 'Gender', customValue: 'Gender', order: 6, visibility: true },
    {
        key: 'MOBILE_NUMBER',
        defaultValue: 'Mobile Number',
        customValue: 'Mobile Number',
        order: 7,
        visibility: true,
    },
    { key: 'EMAIL', defaultValue: 'Email ID', customValue: 'Email ID', order: 8, visibility: true },
    {
        key: 'FATHER_NAME',
        defaultValue: "Father/Male Guardian's Name",
        customValue: "Father/Male Guardian's Name",
        order: 9,
        visibility: true,
    },
    {
        key: 'MOTHER_NAME',
        defaultValue: "Mother/Female Guardian's Name",
        customValue: "Mother/Female Guardian's Name",
        order: 10,
        visibility: true,
    },
    {
        key: 'PARENTS_MOBILE_NUMBER',
        defaultValue: "Father/Male Guardian's Mobile Number",
        customValue: "Father/Male Guardian's Mobile Number",
        order: 11,
        visibility: true,
    },
    {
        key: 'PARENTS_EMAIL',
        defaultValue: "Father/Male Guardian's Email ID",
        customValue: "Father/Male Guardian's Email ID",
        order: 12,
        visibility: true,
    },
    {
        key: 'PARENTS_TO_MOTHER_MOBILE_NUMBER',
        defaultValue: "Mother/Female Guardian's Mobile Number",
        customValue: "Mother/Female Guardian's Mobile Number",
        order: 13,
        visibility: true,
    },
    {
        key: 'PARENTS_TO_MOTHER_EMAIL',
        defaultValue: "Mother/Female Guardian's Email ID",
        customValue: "Mother/Female Guardian's Email ID",
        order: 14,
        visibility: true,
    },
    { key: 'CITY', defaultValue: 'City', customValue: 'City', order: 15, visibility: true },
    { key: 'REGION', defaultValue: 'State', customValue: 'State', order: 16, visibility: true },
    {
        key: 'ATTENDANCE',
        defaultValue: 'Attendance',
        customValue: 'Attendance',
        order: 17,
        visibility: false,
    },
    {
        key: 'COUNTRY',
        defaultValue: 'Country',
        customValue: 'Country',
        order: 18,
        visibility: false,
    },
    {
        key: 'PLAN_TYPE',
        defaultValue: 'Plan Type',
        customValue: 'Plan Type',
        order: 19,
        visibility: false,
    },
    {
        key: 'AMOUNT_PAID',
        defaultValue: 'Amount Paid',
        customValue: 'Amount Paid',
        order: 20,
        visibility: false,
    },
    {
        key: 'PREFFERED_BATCH',
        defaultValue: 'Preferred Batch',
        customValue: 'Preferred Batch',
        order: 21,
        visibility: false,
    },
    {
        key: 'EXPIRY_DATE',
        defaultValue: 'Session Expiry',
        customValue: 'Session Expiry',
        order: 22,
        visibility: true,
    },
    { key: 'STATUS', defaultValue: 'Status', customValue: 'Status', order: 23, visibility: true },
];

// Mapping Functions

/**
 * Convert API locations array to UI visibility object
 */
const mapLocationsToVisibility = (locations: string[]): FieldVisibility => {
    const visibility: FieldVisibility = {
        campaign: false,
        learnersList: false,
        learnerEnrollment: false,
        enrollRequestList: false,
        inviteList: false,
        assessmentRegistration: false,
        liveSessionRegistration: false,
        learnerProfile: false,
        enquiry: false,
    };

    locations.forEach((location) => {
        const visibilityKey = LOCATION_TO_VISIBILITY_MAP[location];
        if (visibilityKey) {
            visibility[visibilityKey] = true;
        }
    });

    return visibility;
};

/**
 * Convert UI visibility object to API locations array
 */
const mapVisibilityToLocations = (visibility: FieldVisibility): string[] => {
    const locations: string[] = [];

    Object.entries(visibility).forEach(([key, value]) => {
        if (value) {
            const location = VISIBILITY_TO_LOCATION_MAP[key as keyof FieldVisibility];
            if (location) {
                locations.push(location);
            }
        }
    });

    return locations;
};

/**
 * Convert API field to UI fixed field
 */
const mapApiFieldToFixedField = (apiField: ApiCustomField): FixedField => {
    return {
        id: apiField.customFieldId,
        name: apiField.fieldName,
        type: apiField.fieldType as 'text' | 'dropdown' | 'number',
        visibility: mapLocationsToVisibility(apiField.locations),
        required: true, // System fields are typically required
        canBeDeleted: apiField.canBeDeleted,
        canBeEdited: apiField.canBeEdited,
        canBeRenamed: apiField.canBeRenamed,
        order: apiField.individualOrder,
        groupName: apiField.groupName,
    };
};

/**
 * Convert API field to UI custom field
 */
const mapApiFieldToCustomField = (apiField: ApiCustomField): CustomField => {
    return {
        id: apiField.customFieldId,
        name: apiField.fieldName,
        type: apiField.fieldType as 'text' | 'dropdown' | 'number',
        options: configJsonToOptions(apiField.config), // Convert config JSON to options array
        visibility: mapLocationsToVisibility(apiField.locations),
        required: false, // Will be determined by compulsoryCustomFields
        canBeDeleted: apiField.canBeDeleted,
        canBeEdited: apiField.canBeEdited,
        canBeRenamed: apiField.canBeRenamed,
        order: apiField.individualOrder,
        groupName: apiField.groupName,
    };
};

/**
 * Convert API group field to UI group field
 */
const mapApiGroupFieldToGroupField = (
    apiGroupField: ApiGroupField | ApiCustomField
): GroupField => {
    return {
        id: apiGroupField.customFieldId,
        name: apiGroupField.fieldName,
        type: apiGroupField.fieldType as 'text' | 'dropdown' | 'number',
        options: configJsonToOptions(apiGroupField.config), // Convert config JSON to options array
        visibility: mapLocationsToVisibility(apiGroupField.locations),
        required: false, // Will be determined by compulsoryCustomFields
        canBeDeleted: apiGroupField.canBeDeleted,
        canBeEdited: apiGroupField.canBeEdited,
        canBeRenamed: apiGroupField.canBeRenamed,
        order: apiGroupField.individualOrder,
        groupInternalOrder: apiGroupField.groupInternalOrder || 0,
        groupName: apiGroupField.groupName,
    };
};

/**
 * Convert API response to UI format
 */
const mapApiResponseToUI = (apiResponse: ApiCustomFieldResponse): CustomFieldSettingsData => {
    const systemFields: SystemField[] = [];
    const fixedFields: FixedField[] = [];
    const instituteFields: CustomField[] = [];
    const customFields: CustomField[] = [];
    const fieldGroups: FieldGroup[] = [];

    // CRITICAL FIX: The actual data is nested under apiResponse.data.data
    const actualData = apiResponse.data?.data;

    if (!actualData) {
        console.error('❌ [DEBUG] No nested data found in API response');
        return {
            systemFields: DEFAULT_SYSTEM_FIELDS,
            fixedFields,
            instituteFields,
            customFields,
            fieldGroups,
            lastUpdated: new Date().toISOString(),
            version: 1,
        };
    }

    // Process fixedFieldRenameDtos to get system fields
    const fixedFieldRenameDtos = actualData.fixedFieldRenameDtos || [];

    if (fixedFieldRenameDtos.length > 0) {
        // Use the fixedFieldRenameDtos from API
        fixedFieldRenameDtos.forEach((dto) => {
            systemFields.push({
                key: dto.key,
                defaultValue: dto.defaultValue,
                customValue: dto.customValue,
                order: dto.order,
                visibility: dto.visibility,
            });
        });
    } else {
        // First time setup - use default system fields
        systemFields.push(...DEFAULT_SYSTEM_FIELDS);
    }

    // Safety check: ensure currentCustomFieldsAndGroups exists and is an array
    const fields = actualData.currentCustomFieldsAndGroups || [];
    const fixedCustomFields = actualData.fixedCustomFields || [];
    const compulsoryCustomFields = actualData.compulsoryCustomFields || [];
    const customGroupData = actualData.customGroup || {};

    // Process individual fields AND build groups from fields with groupName
    const groupsMap = new Map<string, FieldGroup>();

    fields.forEach((apiField: ApiCustomField) => {
        const isSystemField = SYSTEM_FIELD_NAMES.includes(apiField.fieldName.toLowerCase());
        const isFixedField = fixedCustomFields.includes(apiField.customFieldId);
        const isRequired = compulsoryCustomFields.includes(apiField.customFieldId);

        // Add field to individual lists (fixed or custom)
        if (isSystemField || isFixedField) {
            const fixedField = mapApiFieldToFixedField(apiField);
            fixedField.required = isRequired;
            fixedFields.push(fixedField);
        } else {
            const customField = mapApiFieldToCustomField(apiField);
            customField.required = isRequired;
            customFields.push(customField);
        }

        // Also process fields that belong to groups
        if (apiField.groupName) {
            // Split group names by comma and trim whitespace to handle multi-group fields
            const groupNames = apiField.groupName
                .split(',')
                .map((name) => name.trim())
                .filter((name) => name.length > 0);

            groupNames.forEach((groupName) => {
                if (!groupsMap.has(groupName)) {
                    groupsMap.set(groupName, {
                        id: groupName,
                        name: groupName,
                        fields: [],
                        order: 0,
                    });
                }

                const group = groupsMap.get(groupName)!;
                const mappedGroupField = mapApiGroupFieldToGroupField(apiField);
                mappedGroupField.required = isRequired;

                group.fields.push(mappedGroupField);

                // Update group order to minimum field order
                if (group.order === 0 || apiField.individualOrder < group.order) {
                    group.order = apiField.individualOrder;
                }
            });
        }
    });

    // Also process customGroup data (if it exists)
    Object.entries(customGroupData).forEach(([, apiGroupField]) => {
        const groupField = apiGroupField as ApiGroupField;
        const groupName = groupField.groupName;

        if (!groupsMap.has(groupName)) {
            groupsMap.set(groupName, {
                id: groupName,
                name: groupName,
                fields: [],
                order: 0,
            });
        }

        const group = groupsMap.get(groupName)!;

        // Check if this field is already in the group (to avoid duplicates)
        const fieldExists = group.fields.some((f) => f.id === groupField.customFieldId);
        if (!fieldExists) {
            const mappedGroupField = mapApiGroupFieldToGroupField(groupField);
            mappedGroupField.required = compulsoryCustomFields.includes(groupField.customFieldId);
            group.fields.push(mappedGroupField);

            // Update group order to minimum field order
            if (group.order === 0 || mappedGroupField.order < group.order) {
                group.order = mappedGroupField.order;
            }
        }
    });

    fieldGroups.push(...Array.from(groupsMap.values()));

    // Sort fields by order
    fixedFields.sort((a, b) => a.order - b.order);
    customFields.sort((a, b) => a.order - b.order);
    fieldGroups.sort((a, b) => a.order - b.order);
    fieldGroups.forEach((group) => {
        group.fields.sort((a, b) => a.groupInternalOrder - b.groupInternalOrder);
    });

    // Sort system fields by order
    systemFields.sort((a, b) => a.order - b.order);

    return {
        systemFields,
        fixedFields,
        instituteFields,
        customFields,
        fieldGroups,
        lastUpdated: new Date().toISOString(),
        version: 1,
    };
};

/**
 * Store original API data for preserving during save operations
 */
let originalApiData: ApiCustomFieldResponse['data']['data'] | null = null;

/**
 * Set the original API data (called after successful GET request)
 */
export const setOriginalApiData = (apiData: ApiCustomFieldResponse['data']['data']): void => {
    originalApiData = apiData;
};

/**
 * Convert UI field back to API field, preserving original API structure
 */
const preserveApiField = (
    uiField: CustomField | FixedField,
    originalApiField: ApiCustomField
): ApiCustomField => {
    const configJson =
        'options' in uiField ? optionsToConfigJson(uiField.options) : originalApiField.config;

    return {
        ...originalApiField, // Preserve all original API data
        fieldName: uiField.name, // Update name if changed
        individualOrder: uiField.order, // Update order if changed
        locations: mapVisibilityToLocations(uiField.visibility), // Update visibility
        groupName: uiField.groupName || null, // Update groupName
        config: configJson,
    };
};

/**
 * Convert UI group field back to API group field, preserving original structure
 */
const preserveApiGroupField = (
    uiField: GroupField,
    originalApiField: ApiGroupField
): ApiGroupField => {
    return {
        ...originalApiField, // Preserve all original API data
        fieldName: uiField.name, // Update name if changed
        individualOrder: uiField.order, // Update order if changed
        groupInternalOrder: uiField.groupInternalOrder, // Update group order if changed
        groupName: uiField.groupName || originalApiField.groupName, // Update groupName
        locations: mapVisibilityToLocations(uiField.visibility), // Update visibility
        config: optionsToConfigJson(uiField.options), // Convert options to config JSON
    };
};

/**
 * Create API field for new custom field (without backend ID)
 */
const createNewApiField = (
    customField: CustomField,
    instituteId: string
): Omit<ApiCustomField, 'id'> => {
    return {
        customFieldId: '', // Backend will assign this
        instituteId,
        groupName: customField.groupName || null,
        fieldName: customField.name,
        fieldType: customField.type,
        individualOrder: customField.order,
        groupInternalOrder: null,
        canBeDeleted: true,
        canBeEdited: true,
        canBeRenamed: true,
        locations: mapVisibilityToLocations(customField.visibility),
        status: 'ACTIVE',
        config: optionsToConfigJson(customField.options), // Convert options to config JSON
    };
};

/**
 * Create API group field for new group field (without backend ID)
 */
const createNewApiGroupField = (
    groupField: GroupField,
    instituteId: string,
    groupName: string
): Omit<ApiGroupField, 'id'> => {
    return {
        customFieldId: '', // Backend will assign this
        instituteId,
        groupName,
        fieldName: groupField.name,
        fieldType: groupField.type,
        individualOrder: groupField.order,
        groupInternalOrder: groupField.groupInternalOrder,
        canBeDeleted: true,
        canBeEdited: true,
        canBeRenamed: true,
        locations: mapVisibilityToLocations(groupField.visibility),
        status: 'ACTIVE',
        config: optionsToConfigJson(groupField.options), // Convert options to config JSON
    };
};

/**
 * Create a fresh API request structure when no original data is available
 * This is used for first-time saves or when the original API data is missing
 */
const mapUIToApiRequestFresh = (
    uiData: CustomFieldSettingsData,
    instituteId: string
): ApiCustomFieldRequest => {
    const currentCustomFieldsAndGroups: ApiCustomField[] = [];
    const customGroup: Record<string, ApiGroupField> = {};
    const customFieldsNames: string[] = [];
    const compulsoryCustomFields: string[] = [];
    const fixedCustomFields: string[] = [];
    const allCustomFields: string[] = [];
    const groupNames: string[] = [];

    // Process fixed fields
    uiData.fixedFields.forEach((fixedField) => {
        // For fresh saves, we create new API field structures
        const apiField: ApiCustomField = {
            id: '', // Backend will assign
            customFieldId: fixedField.id,
            instituteId,
            groupName: fixedField.groupName || null,
            fieldName: fixedField.name,
            fieldType: 'text', // Fixed fields are typically text
            individualOrder: fixedField.order,
            groupInternalOrder: null,
            canBeDeleted: fixedField.canBeDeleted,
            canBeEdited: fixedField.canBeEdited,
            canBeRenamed: fixedField.canBeRenamed,
            locations: mapVisibilityToLocations(fixedField.visibility),
            status: 'ACTIVE',
        };
        currentCustomFieldsAndGroups.push(apiField);

        customFieldsNames.push(fixedField.name);
        fixedCustomFields.push(fixedField.id);
        allCustomFields.push(fixedField.id);

        if (fixedField.required) {
            compulsoryCustomFields.push(fixedField.id);
        }
    });

    // Process institute fields
    uiData.instituteFields.forEach((instituteField) => {
        const apiField: ApiCustomField = {
            id: '', // Backend will assign
            customFieldId: instituteField.id,
            instituteId,
            groupName: instituteField.groupName || null,
            fieldName: instituteField.name,
            fieldType: instituteField.type,
            individualOrder: instituteField.order,
            groupInternalOrder: null,
            canBeDeleted: instituteField.canBeDeleted,
            canBeEdited: instituteField.canBeEdited,
            canBeRenamed: instituteField.canBeRenamed,
            locations: mapVisibilityToLocations(instituteField.visibility),
            status: 'ACTIVE',
            config: optionsToConfigJson(instituteField.options), // Convert options to config JSON
        };
        currentCustomFieldsAndGroups.push(apiField);

        customFieldsNames.push(instituteField.name);
        allCustomFields.push(instituteField.id);

        if (instituteField.required) {
            compulsoryCustomFields.push(instituteField.id);
        }
    });

    // Process custom fields
    uiData.customFields.forEach((customField) => {
        const apiField: ApiCustomField = {
            id: '', // Backend will assign
            customFieldId: isTempField(customField) ? '' : customField.id, // Empty for new fields
            instituteId,
            groupName: customField.groupName || null,
            fieldName: customField.name,
            fieldType: customField.type,
            individualOrder: customField.order,
            groupInternalOrder: null,
            canBeDeleted: customField.canBeDeleted,
            canBeEdited: customField.canBeEdited,
            canBeRenamed: customField.canBeRenamed,
            locations: mapVisibilityToLocations(customField.visibility),
            status: 'ACTIVE',
            config: optionsToConfigJson(customField.options), // Convert options to config JSON
        };
        currentCustomFieldsAndGroups.push(apiField);

        customFieldsNames.push(customField.name);

        // Only add to allCustomFields if it's not a temp field
        if (!isTempField(customField)) {
            allCustomFields.push(customField.id);
        }

        if (customField.required) {
            const fieldId = isTempField(customField) ? customField.name : customField.id;
            compulsoryCustomFields.push(fieldId);
        }
    });

    // Process field groups
    uiData.fieldGroups.forEach((fieldGroup) => {
        groupNames.push(fieldGroup.name);

        fieldGroup.fields.forEach((groupField) => {
            const groupKey = `${fieldGroup.name}_${groupField.id}`;

            const apiGroupField: ApiGroupField = {
                id: '', // Backend will assign
                customFieldId: isTempField(groupField) ? '' : groupField.id, // Empty for new fields
                instituteId,
                groupName: fieldGroup.name,
                fieldName: groupField.name,
                fieldType: groupField.type,
                individualOrder: groupField.order,
                groupInternalOrder: groupField.groupInternalOrder,
                canBeDeleted: groupField.canBeDeleted,
                canBeEdited: groupField.canBeEdited,
                canBeRenamed: groupField.canBeRenamed,
                locations: mapVisibilityToLocations(groupField.visibility),
                status: 'ACTIVE',
            };
            customGroup[groupKey] = apiGroupField;

            customFieldsNames.push(groupField.name);

            // Only add to allCustomFields if it's not a temp field
            if (!isTempField(groupField)) {
                allCustomFields.push(groupField.id);
            }

            if (groupField.required) {
                const fieldId = isTempField(groupField) ? groupField.name : groupField.id;
                compulsoryCustomFields.push(fieldId);
            }
        });
    });

    // Map system fields to fixed_field_rename_dtos
    // Use DEFAULT_SYSTEM_FIELDS if systemFields is not provided
    const fixed_field_rename_dtos = (uiData.systemFields || DEFAULT_SYSTEM_FIELDS).map((field) => ({
        key: field.key,
        defaultValue: field.defaultValue,
        customValue: field.customValue,
        order: field.order,
        visibility: field.visibility,
    }));

    const result: ApiCustomFieldRequest = {
        custom_fields_and_groups: currentCustomFieldsAndGroups,
        custom_group: customGroup,
        custom_fields_names: customFieldsNames,
        compulsory_custom_fields: compulsoryCustomFields,
        fixed_custom_fields: fixedCustomFields,
        all_custom_fields: allCustomFields,
        custom_field_locations: Object.values(VISIBILITY_TO_LOCATION_MAP),
        group_names: groupNames.length > 0 ? groupNames : undefined,
        fixed_field_rename_dtos,
    };

    return result;
};

/**
 * Convert UI format to API request, preserving original API structure when available
 */
const mapUIToApiRequest = (uiData: CustomFieldSettingsData): ApiCustomFieldRequest => {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    // If we don't have original API data, we'll create a fresh structure
    // This can happen on first save or if the data wasn't properly loaded
    if (!originalApiData) {
        console.warn('🚨 [DEBUG] No original API data available - creating fresh structure');
        return mapUIToApiRequestFresh(uiData, instituteId);
    }

    // We have original data, so we can preserve the structure

    // Start with the original data structure and modify only what's changed
    const currentCustomFieldsAndGroups: ApiCustomField[] = [];
    // FIXED: Start with empty customGroup - will be populated with only current groups
    let customGroup: Record<string, ApiGroupField> = {};
    const customFieldsNames: string[] = [];
    const compulsoryCustomFields: string[] = [];
    const fixedCustomFields: string[] = [...(originalApiData.fixedCustomFields || [])];
    const allCustomFields: string[] = [];
    // FIXED: Start with empty groupNames - will be populated with only current group names
    const groupNames: string[] = [];

    // Create a map of original fields for easy lookup
    const originalFieldsMap = new Map<string, ApiCustomField>();
    const originalFields = originalApiData.currentCustomFieldsAndGroups || [];
    originalFields.forEach((field) => {
        originalFieldsMap.set(field.customFieldId, field);
    });

    const originalGroupFieldsMap = new Map<string, ApiGroupField>();
    const originalGroupEntries = originalApiData.customGroup || {};
    Object.entries(originalGroupEntries).forEach(([, field]) => {
        originalGroupFieldsMap.set(field.customFieldId, field);
    });

    // Process fixed fields
    uiData.fixedFields.forEach((fixedField) => {
        const originalField = originalFieldsMap.get(fixedField.id);
        if (originalField) {
            // Existing field - preserve original structure, update only changed data
            const apiField = preserveApiField(fixedField, originalField);
            currentCustomFieldsAndGroups.push(apiField);
        } else {
            console.warn(`Fixed field ${fixedField.id} not found in original data`);
        }

        // Add all field names to customFieldsNames for backend compatibility
        customFieldsNames.push(fixedField.name);
        allCustomFields.push(fixedField.id);

        if (fixedField.required) {
            compulsoryCustomFields.push(fixedField.id);
        }
    });

    // Process institute fields
    uiData.instituteFields.forEach((instituteField) => {
        const originalField = originalFieldsMap.get(instituteField.id);
        if (originalField) {
            // Existing field - preserve original structure
            const apiField = preserveApiField(instituteField, originalField);
            currentCustomFieldsAndGroups.push(apiField);
        } else {
            console.warn(`Institute field ${instituteField.id} not found in original data`);
        }

        // Add all field names to customFieldsNames for backend compatibility
        customFieldsNames.push(instituteField.name);
        allCustomFields.push(instituteField.id);

        if (instituteField.required) {
            compulsoryCustomFields.push(instituteField.id);
        }
    });

    // Process custom fields
    uiData.customFields.forEach((customField) => {
        if (isTempField(customField)) {
            // New field - create new API structure without ID
            const newApiField = createNewApiField(customField, instituteId) as ApiCustomField;
            // For new fields, leave customFieldId empty so backend can assign proper ID
            newApiField.customFieldId = '';
            newApiField.id = ''; // Also ensure id is empty
            currentCustomFieldsAndGroups.push(newApiField);
        } else {
            // Existing field - preserve original structure
            const originalField = originalFieldsMap.get(customField.id);
            if (originalField) {
                const apiField = preserveApiField(customField, originalField);
                currentCustomFieldsAndGroups.push(apiField);
            } else {
                console.warn(`Custom field ${customField.id} not found in original data`);
            }
        }

        customFieldsNames.push(customField.name);
        // For new fields, don't add the temp ID to allCustomFields
        if (!isTempField(customField)) {
            allCustomFields.push(customField.id);
        }

        if (customField.required) {
            // For new fields, use the field name instead of temp ID
            const fieldId = isTempField(customField) ? customField.name : customField.id;
            compulsoryCustomFields.push(fieldId);
        }
    });

    // Process field groups
    const updatedCustomGroup: Record<string, ApiGroupField> = {};

    uiData.fieldGroups.forEach((fieldGroup) => {
        // Add group name to list if it's new
        if (!groupNames.includes(fieldGroup.name)) {
            groupNames.push(fieldGroup.name);
        }

        fieldGroup.fields.forEach((groupField) => {
            const groupKey = `${fieldGroup.name}_${groupField.id}`;

            if (isTempField(groupField)) {
                // New group field
                const newApiGroupField = createNewApiGroupField(
                    groupField,
                    instituteId,
                    fieldGroup.name
                ) as ApiGroupField;
                // For new fields, leave customFieldId empty so backend can assign proper ID
                newApiGroupField.customFieldId = '';
                newApiGroupField.id = '';
                updatedCustomGroup[groupKey] = newApiGroupField;
            } else {
                // Existing group field - preserve original structure
                const originalGroupField = originalGroupFieldsMap.get(groupField.id);
                if (originalGroupField) {
                    const apiGroupField = preserveApiGroupField(groupField, originalGroupField);
                    updatedCustomGroup[groupKey] = apiGroupField;
                } else {
                    console.warn(`Group field ${groupField.id} not found in original data`);
                }
            }

            // For new fields, don't add the temp ID to allCustomFields
            if (!isTempField(groupField)) {
                allCustomFields.push(groupField.id);
            }

            // Add group field names to customFieldsNames for backend compatibility
            customFieldsNames.push(groupField.name);

            if (groupField.required) {
                // For new fields, use the field name instead of temp ID
                const fieldId = isTempField(groupField) ? groupField.name : groupField.id;
                compulsoryCustomFields.push(fieldId);
            }
        });
    });

    // FIXED: Reassign to only include current groups (not merging with old data)
    // This ensures deleted groups are not sent in the payload
    customGroup = updatedCustomGroup;

    // Map system fields to fixed_field_rename_dtos
    // Use DEFAULT_SYSTEM_FIELDS if systemFields is not provided
    const fixed_field_rename_dtos = (uiData.systemFields || DEFAULT_SYSTEM_FIELDS).map((field) => ({
        key: field.key,
        defaultValue: field.defaultValue,
        customValue: field.customValue,
        order: field.order,
        visibility: field.visibility,
    }));

    const result: ApiCustomFieldRequest = {
        custom_fields_and_groups: currentCustomFieldsAndGroups,
        custom_group: customGroup,
        custom_fields_names: customFieldsNames,
        compulsory_custom_fields: compulsoryCustomFields,
        fixed_custom_fields: fixedCustomFields,
        all_custom_fields: allCustomFields,
        custom_field_locations:
            originalApiData.customFieldLocations || Object.values(VISIBILITY_TO_LOCATION_MAP),
        group_names: groupNames.length > 0 ? groupNames : undefined,
        fixed_field_rename_dtos,
    };

    return result;
};

/**
 * Get cached custom field settings from localStorage
 */
const getCachedSettings = (): CustomFieldSettingsData | null => {
    try {
        const instituteId = getInstituteId();
        if (!instituteId) {
            console.warn('🚨 [DEBUG] Cannot get cached settings: Institute ID not found');
            return null;
        }

        const cached = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!cached) {
            return null;
        }

        const cachedData: CachedCustomFieldSettings = JSON.parse(cached);

        // Check if cache is for the same institute
        if (cachedData.instituteId !== instituteId) {
            console.warn(
                `🚨 [DEBUG] Cache institute ID mismatch: ${cachedData.instituteId} vs ${instituteId}`
            );
            localStorage.removeItem(LOCALSTORAGE_KEY);
            return null;
        }

        // Check if cache has expired
        const now = Date.now();
        const cacheAge = now - cachedData.timestamp;
        const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000; // Convert to milliseconds

        if (cacheAge > expiryTime) {
            console.warn('🚨 [DEBUG] Cache expired, removing from localStorage');
            localStorage.removeItem(LOCALSTORAGE_KEY);
            return null;
        }

        return cachedData.data;
    } catch (error) {
        console.error('❌ [DEBUG] Error reading cached custom field settings:', error);
        localStorage.removeItem(LOCALSTORAGE_KEY);
        return null;
    }
};

/**
 * Save custom field settings to localStorage cache
 */
const setCachedSettings = (settings: CustomFieldSettingsData): void => {
    try {
        const instituteId = getInstituteId();
        if (!instituteId) {
            console.warn('🚨 [DEBUG] Cannot cache settings: Institute ID not found');
            return;
        }

        const cacheData: CachedCustomFieldSettings = {
            data: settings,
            timestamp: Date.now(),
            instituteId,
        };

        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
        console.error('❌ [DEBUG] Error caching custom field settings:', error);
    }
};

/**
 * Clear cached custom field settings
 */
export const clearCustomFieldSettingsCache = (): void => {
    localStorage.removeItem(LOCALSTORAGE_KEY);
};

/**
 * Get custom field settings synchronously from cache only (no API call)
 * Returns null if no cache is available - forces API call
 */
export const getCustomFieldSettingsFromCache = (): CustomFieldSettingsData | null => {
    const cachedSettings = getCachedSettings();
    return cachedSettings; // No fallback to defaults - must use backend data
};

/**
 * Fetch custom field settings from API and update cache
 */
const fetchCustomFieldSettingsFromAPI = async (): Promise<CustomFieldSettingsData> => {
    try {
        const instituteId = getInstituteId();

        if (!instituteId) {
            throw new Error('Institute ID not found. Please log in again.');
        }

        const [settingsResponse, usageResponse] = await Promise.all([
            authenticatedAxiosInstance.get<ApiCustomFieldResponse>(GET_INSITITUTE_SETTINGS, {
                params: {
                    instituteId,
                    settingKey: CUSTOM_FIELD_SETTINGS_KEY,
                },
            }),
            authenticatedAxiosInstance.get<ApiCustomFieldUsageResponse>(
                GET_CUSTOM_FIELD_LIST_WITH_USAGE,
                {
                    params: {
                        instituteId,
                    },
                }
            ),
        ]);

        let settings: CustomFieldSettingsData;

        // If we get a successful response with data, map it to UI format
        if (settingsResponse.data && settingsResponse.data.data) {
            const apiData = settingsResponse.data.data.data;

            // Merge usage data into apiData
            if (usageResponse.data && Array.isArray(usageResponse.data)) {
                const existingFieldIds = new Set<string>();

                // Track existing fields from currentCustomFieldsAndGroups
                if (Array.isArray(apiData.currentCustomFieldsAndGroups)) {
                    apiData.currentCustomFieldsAndGroups.forEach((f) =>
                        existingFieldIds.add(f.customFieldId)
                    );
                }

                // Track existing fields from customGroup
                if (apiData.customGroup) {
                    Object.values(apiData.customGroup).forEach((f) =>
                        existingFieldIds.add(f.customFieldId)
                    );
                }

                // Track fixed fields to avoid duplicates
                if (Array.isArray(apiData.fixedCustomFields)) {
                    apiData.fixedCustomFields.forEach((id) => existingFieldIds.add(id));
                }

                usageResponse.data.forEach((usageItem) => {
                    const fieldId = usageItem.custom_field.id;
                    if (!fieldId) return;

                    if (!existingFieldIds.has(fieldId)) {
                        console.log(
                            `[DEBUG] Found new field in usage list: ${usageItem.custom_field.fieldName} (${fieldId})`
                        );

                        // Construct a default ApiCustomField
                        // We default to 'text' if type is unknown or missing, though usageItem should have it
                        const newField: ApiCustomField = {
                            id: '', // Backend internal ID (different from customFieldId usually, but here likely unused or generated)
                            customFieldId: fieldId,
                            instituteId: usageItem.custom_field.instituteId || instituteId,
                            groupName: null,
                            fieldName: usageItem.custom_field.fieldName,
                            fieldType:
                                (usageItem.custom_field.fieldType as
                                    | 'text'
                                    | 'number'
                                    | 'dropdown') || 'text',
                            individualOrder: 999, // Append to end
                            groupInternalOrder: null,
                            canBeDeleted: true,
                            canBeEdited: true, // Assuming editable
                            canBeRenamed: true,
                            locations: [], // Default to no visibility until configured
                            status: usageItem.custom_field.status || 'ACTIVE',
                            config: usageItem.custom_field.config,
                        };

                        // Add to currentCustomFieldsAndGroups
                        if (!apiData.currentCustomFieldsAndGroups) {
                            apiData.currentCustomFieldsAndGroups = [];
                        }
                        apiData.currentCustomFieldsAndGroups.push(newField);

                        // Add to allCustomFields
                        if (!apiData.allCustomFields) {
                            apiData.allCustomFields = [];
                        }
                        apiData.allCustomFields.push(fieldId);

                        // Add to customFieldsNames
                        if (!apiData.customFieldsNames) {
                            apiData.customFieldsNames = [];
                        }
                        apiData.customFieldsNames.push(newField.fieldName);

                        // Add to existing IDs set to prevent double adding if logic changes
                        existingFieldIds.add(fieldId);
                    }
                });
            }

            // Store original API data for preservation during save operations
            setOriginalApiData(apiData);

            // Check if the data has the expected structure
            if (!settingsResponse.data.data.data?.allCustomFields) {
                console.warn('🚨 [DEBUG] API response missing allCustomFields - using empty array');
            }

            settings = mapApiResponseToUI(settingsResponse.data);

            // Attach usage data
            if (usageResponse.data && Array.isArray(usageResponse.data)) {
                const usageMap = new Map<string, CustomFieldUsage>();
                usageResponse.data.forEach((item) => {
                    if (item.custom_field?.id) {
                        usageMap.set(item.custom_field.id, {
                            enrollInviteCount: item.enroll_invite_count,
                            audienceCount: item.audience_count,
                            isDefault: item.default ?? false,
                        });
                    }
                });

                // Attach to instituteFields
                settings.instituteFields.forEach((field) => {
                    if (usageMap.has(field.id)) {
                        field.usage = usageMap.get(field.id);
                    }
                });

                // Attach to customFields
                settings.customFields.forEach((field) => {
                    if (usageMap.has(field.id)) {
                        field.usage = usageMap.get(field.id);
                    }
                });

                // Attach to fixedFields (if applicable, though IDs usually match customFieldId)
                settings.fixedFields.forEach((field) => {
                    if (usageMap.has(field.id)) {
                        field.usage = usageMap.get(field.id);
                    }
                });

                // Attach to group fields
                settings.fieldGroups.forEach((group) => {
                    group.fields.forEach((field) => {
                        if (usageMap.has(field.id)) {
                            // Cast to any because GroupField interface needs update too if we want strict typing there
                            // But since GroupField extends CustomField variants effectively in UI, it might work if Types imply it.
                            // Actually safely casting or adding to interface is better.
                            // Let's assume usage is on the base object.
                            (field as unknown as CustomField).usage = usageMap.get(field.id);
                        }
                    });
                });
            }

            // Validate that we actually got some fields
            const totalFields =
                settings.fixedFields.length +
                settings.customFields.length +
                settings.instituteFields.length;
            if (totalFields === 0) {
                console.warn(
                    '🚨 [DEBUG] No fields found in API response - this may indicate an issue'
                );
            }
        } else {
            // If no data found, throw error - we must have backend data
            throw new Error('No custom field settings found in backend. Please contact support.');
        }

        // Cache the settings - this is critical for the UI to work
        setCachedSettings(settings);

        return settings;
    } catch (error: unknown) {
        console.error('🚨 [DEBUG] Error fetching custom field settings:', error);

        // Check if it's a 510 error (Setting not found) or other error
        const err = error as { response?: { status?: number; data?: { ex?: string } } };
        if (err.response?.status === 510 || err.response?.data?.ex?.includes('Setting not found')) {
            throw new Error(
                'Custom field settings not configured yet. Please contact your administrator to set up field configurations.'
            );
        }

        // For other errors, also throw - no fallback to defaults
        const message = (error as Error)?.message || 'unknown error';
        console.warn('🚨 [DEBUG] Error loading custom field settings:', message);

        // IMPORTANT: Don't use defaults if we have a real API error - this causes UUID issues
        // Instead, throw the error so the UI can handle it properly
        throw new Error(`Failed to load custom field settings: ${message}`);
    }
};

/**
 * Get custom field settings - tries cache first, then API if needed
 */
export const getCustomFieldSettings = async (
    forceRefresh = false
): Promise<CustomFieldSettingsData> => {
    // If forcing refresh, skip cache and fetch from API
    if (forceRefresh) {
        return fetchCustomFieldSettingsFromAPI();
    }

    // Try to get from cache first
    const cachedSettings = getCachedSettings();
    if (cachedSettings) {
        return cachedSettings;
    }

    // If no cache, fetch from API
    return fetchCustomFieldSettingsFromAPI();
};

/**
 * Debug function to validate API request data structure
 */
const validateApiRequest = (apiRequest: ApiCustomFieldRequest): void => {
    // Check for missing IDs in existing fields
    const fieldsWithoutIds = apiRequest.custom_fields_and_groups.filter(
        (field: ApiCustomField) => !field.id && field.customFieldId !== ''
    );
    if (fieldsWithoutIds.length > 0) {
        console.warn('🚨 [DEBUG] Found existing fields without API IDs:', fieldsWithoutIds);
    }

    // Check for new fields (should have empty customFieldId)
};

/**
 * Save custom field settings to API and update cache
 */
export const saveCustomFieldSettings = async (
    settings: CustomFieldSettingsData
): Promise<{ success: boolean; message: string }> => {
    try {
        const instituteId = getInstituteId();

        if (!instituteId) {
            throw new Error('Institute ID not found. Please log in again.');
        }

        // Convert UI data to API format
        const apiRequest = mapUIToApiRequest(settings);

        // Validate the API request structure
        validateApiRequest(apiRequest);

        // Determine if this is a create or update operation
        const cachedSettings = getCachedSettings();
        const isPresent = cachedSettings !== null;

        const requestParams: Record<string, string | boolean> = {
            instituteId,
        };

        // Add isPresent param for updates
        if (isPresent) {
            requestParams.isPresent = true;
        }

        await authenticatedAxiosInstance.post(UPDATE_CUSTOM_FIELD_SETTINGS, apiRequest, {
            params: requestParams,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Update cache with the saved settings
        const updatedSettings = {
            ...settings,
            lastUpdated: new Date().toISOString(),
            version: (settings.version || 0) + 1,
        };
        setCachedSettings(updatedSettings);

        return {
            success: true,
            message: 'Custom field settings saved successfully',
        };
    } catch (error) {
        console.error('Error saving custom field settings:', error);
        throw error;
    }
};

/**
 * Validate custom field settings data structure
 */
export const validateCustomFieldSettings = (settings: CustomFieldSettingsData): boolean => {
    try {
        // Check if all required properties exist
        if (!settings.fixedFields || !Array.isArray(settings.fixedFields)) return false;
        if (!settings.instituteFields || !Array.isArray(settings.instituteFields)) return false;
        if (!settings.customFields || !Array.isArray(settings.customFields)) return false;
        if (!settings.fieldGroups || !Array.isArray(settings.fieldGroups)) return false;

        // Validate each field has required properties
        const validateField = (field: CustomField | FixedField): boolean => {
            return !!(
                field.id &&
                field.name &&
                field.visibility &&
                typeof field.required === 'boolean' &&
                typeof field.order === 'number'
            );
        };

        const validateGroupField = (field: GroupField): boolean => {
            return !!(
                field.id &&
                field.name &&
                field.visibility &&
                typeof field.required === 'boolean' &&
                typeof field.order === 'number' &&
                typeof field.groupInternalOrder === 'number'
            );
        };

        const allFieldsValid = [
            ...settings.fixedFields,
            ...settings.instituteFields,
            ...settings.customFields,
        ].every(validateField);

        const allGroupFieldsValid = settings.fieldGroups.every((group) =>
            group.fields.every(validateGroupField)
        );

        return allFieldsValid && allGroupFieldsValid;
    } catch (error) {
        console.error('Error validating custom field settings:', error);
        return false;
    }
};

/**
 * Export field configuration for backup/import purposes
 */
export const exportCustomFieldSettings = (settings: CustomFieldSettingsData): string => {
    try {
        return JSON.stringify(settings, null, 2);
    } catch (error) {
        console.error('Error exporting custom field settings:', error);
        throw new Error('Failed to export settings');
    }
};

/**
 * Import field configuration from backup
 */
export const importCustomFieldSettings = (jsonString: string): CustomFieldSettingsData => {
    try {
        const imported = JSON.parse(jsonString) as CustomFieldSettingsData;

        if (!validateCustomFieldSettings(imported)) {
            throw new Error('Invalid settings format');
        }

        return imported;
    } catch (error) {
        console.error('Error importing custom field settings:', error);
        throw new Error('Failed to import settings: Invalid format');
    }
};

/**
 * Create a new custom field template (without ID - backend will assign the ID)
 */
export const createNewCustomField = (
    name: string,
    type: 'text' | 'dropdown' | 'number',
    options?: string[]
): NewCustomField => {
    return {
        name,
        type,
        options: type === 'dropdown' ? options || [] : undefined,
        visibility: {
            campaign: false,
            learnersList: false,
            learnerEnrollment: false,
            enrollRequestList: false,
            inviteList: false,
            assessmentRegistration: false,
            liveSessionRegistration: false,
            learnerProfile: false,
            enquiry: false,
        },
        required: false,
        order: 999, // Will be updated when added to settings
    };
};

/**
 * Create a new field group template (without ID - backend will assign the ID)
 */
export const createNewFieldGroup = (name: string): Omit<FieldGroup, 'id'> => {
    return {
        name,
        fields: [],
        order: 999, // Will be updated when added to settings
    };
};

/**
 * Create a temporary custom field for UI purposes (with temporary ID)
 * This should only be used in the UI before saving to backend
 */
export const createTempCustomField = (
    name: string,
    type: 'text' | 'dropdown' | 'number',
    options?: string[]
): CustomField => {
    return {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Temporary ID
        name,
        type,
        options: type === 'dropdown' ? options || [] : undefined,
        visibility: {
            campaign: false,
            learnersList: false,
            learnerEnrollment: false,
            enrollRequestList: false,
            inviteList: false,
            assessmentRegistration: false,
            liveSessionRegistration: false,
            learnerProfile: false,
            enquiry: false,
        },
        required: false,
        canBeDeleted: true,
        canBeEdited: true,
        canBeRenamed: true,
        order: 999, // Will be updated when added to settings
        groupName: null, // Initially not in any group
    };
};

/**
 * Check if a field has a temporary ID (not yet saved to backend)
 */
export const isTempField = (field: CustomField | FixedField | GroupField): boolean => {
    return field.id.startsWith('temp_');
};

/**
 * Convert a temporary field to a new field for API submission
 */
export const tempFieldToNewField = (field: CustomField): NewCustomField => {
    return {
        name: field.name,
        type: field.type,
        options: field.options,
        visibility: field.visibility,
        required: field.required,
        order: field.order,
    };
};

/**
 * Example workflow for creating a new custom field
 * This shows the proper sequence for handling new fields
 */
export const createCustomFieldWorkflow = async (
    name: string,
    type: 'text' | 'dropdown' | 'number',
    options?: string[]
): Promise<CustomField> => {
    // Step 1: Create new field data (no ID)
    const newFieldData = createNewCustomField(name, type, options);

    // Step 2: Send to API to create the field (API will assign ID)
    // TODO: This would be a separate API endpoint like POST /custom-fields
    // const response = await authenticatedAxiosInstance.post('/custom-fields', newFieldData);
    // return response.data; // Returns CustomField with backend-assigned ID

    // For now, we'll simulate the response
    const simulatedBackendResponse: CustomField = {
        id: `backend_${Date.now()}`, // This would come from backend
        ...newFieldData,
        order: newFieldData.order || 999, // Ensure order is defined
        canBeDeleted: true,
        canBeEdited: true,
        canBeRenamed: true,
        groupName: null,
    };

    return simulatedBackendResponse;
};
