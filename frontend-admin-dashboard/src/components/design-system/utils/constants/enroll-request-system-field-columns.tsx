import { ColumnDef } from '@tanstack/react-table';
import { SystemField } from '@/services/custom-field-settings';

/**
 * Map system field keys to their corresponding column accessorKeys in enrollRequestColumns
 * This mapping is specific to enroll request table columns
 */
const ENROLL_REQUEST_SYSTEM_FIELD_KEY_TO_ACCESSOR: Record<string, string> = {
    FULL_NAME: 'full_name',
    EMAIL: 'email',
    USERNAME: 'username',
    PASSWORD: 'password',
    MOBILE_NUMBER: 'mobile_number',
    PREFFERED_BATCH: 'preferred_batch',
    PAYMENT_STATUS: 'payment_status',
    APPROVAL_STATUS: 'approval_status',
    PAYMENT_OPTION: 'payment_option',
    AMOUNT: 'amount',
    OTHER_CUSTOM_FIELDS: 'other_custom_fields',
    SOURCE: 'source',
    TYPE: 'type',
    TYPE_ID: 'type_id',
    LEVEL_ID: 'level_id',
};

/**
 * Get system fields from localStorage custom field settings
 */
export const getEnrollRequestSystemFieldsFromStorage = (): SystemField[] => {
    try {
        const cached = localStorage.getItem('custom-field-settings-cache');
        if (!cached) {
            return [];
        }

        const cachedData = JSON.parse(cached);
        const systemFields = cachedData.data?.systemFields;

        if (!systemFields || !Array.isArray(systemFields)) {
            return [];
        }

        return systemFields;
    } catch (error) {
        console.error('❌ Error loading enroll request system fields from storage:', error);
        return [];
    }
};

/**
 * Get column visibility based on system fields for enroll request
 * Returns a map of accessorKey -> visibility boolean
 */
export const getEnrollRequestSystemFieldColumnVisibility = (): Record<string, boolean> => {
    const systemFields = getEnrollRequestSystemFieldsFromStorage();
    const visibility: Record<string, boolean> = {};

    // If no system fields, return empty (will use defaults)
    if (systemFields.length === 0) {
        return visibility;
    }

    // Set visibility based on system fields
    systemFields.forEach((field) => {
        const accessorKey = ENROLL_REQUEST_SYSTEM_FIELD_KEY_TO_ACCESSOR[field.key];
        if (accessorKey) {
            visibility[accessorKey] = field.visibility;
        }
    });
    return visibility;
};

/**
 * Get ordered system field accessorKeys based on their order property
 * Returns array of accessorKeys in the correct order for enroll request
 */
export const getOrderedEnrollRequestSystemFieldAccessors = (): string[] => {
    const systemFields = getEnrollRequestSystemFieldsFromStorage();

    if (systemFields.length === 0) {
        return [];
    }

    // Sort by order property
    const sortedFields = [...systemFields].sort((a, b) => a.order - b.order);

    // Map to accessorKeys and filter out any that don't have a mapping
    const orderedAccessors = sortedFields
        .map((field) => ENROLL_REQUEST_SYSTEM_FIELD_KEY_TO_ACCESSOR[field.key])
        .filter((accessor): accessor is string => !!accessor);

    return orderedAccessors;
};

/**
 * Get custom display names for system fields in enroll request
 * Returns a map of accessorKey -> custom display name
 */
export const getEnrollRequestSystemFieldCustomNames = (): Record<string, string> => {
    const systemFields = getEnrollRequestSystemFieldsFromStorage();
    const customNames: Record<string, string> = {};

    systemFields.forEach((field) => {
        const accessorKey = ENROLL_REQUEST_SYSTEM_FIELD_KEY_TO_ACCESSOR[field.key];
        if (accessorKey) {
            // Use customValue if it differs from defaultValue, otherwise use defaultValue
            customNames[accessorKey] = field.customValue || field.defaultValue;
        }
    });

    return customNames;
};

/**
 * Reorder columns based on system field order for enroll request
 * Takes original columns and returns them reordered according to systemFields
 */
export const reorderEnrollRequestColumnsBySystemFields = <T,>(
    columns: ColumnDef<T>[]
): ColumnDef<T>[] => {
    const orderedAccessors = getOrderedEnrollRequestSystemFieldAccessors();

    // If no system fields, return original columns
    if (orderedAccessors.length === 0) {
        return columns;
    }

    // Separate special columns that should stay at the beginning
    const specialColumns = columns.filter((col) => col.id === 'checkbox' || col.id === 'details');

    // Separate options column that should stay at the end
    const optionsColumn = columns.find((col) => col.id === 'options');

    // Get all other columns
    const regularColumns = columns.filter(
        (col) => col.id !== 'checkbox' && col.id !== 'details' && col.id !== 'options'
    );

    // Create a map of accessorKey to column for quick lookup
    const columnMap = new Map<string, ColumnDef<T>>();
    regularColumns.forEach((col) => {
        const accessorKey = 'accessorKey' in col ? (col.accessorKey as string) : col.id;
        if (accessorKey) {
            columnMap.set(accessorKey, col);
        }
    });

    // Build reordered columns based on system field order
    const reorderedRegularColumns: ColumnDef<T>[] = [];
    const usedAccessors = new Set<string>();

    // First, add columns in system field order
    orderedAccessors.forEach((accessor) => {
        const column = columnMap.get(accessor);
        if (column) {
            reorderedRegularColumns.push(column);
            usedAccessors.add(accessor);
        }
    });

    // Then, add any remaining columns that weren't in system fields
    regularColumns.forEach((col) => {
        const accessorKey = 'accessorKey' in col ? (col.accessorKey as string) : col.id;
        if (accessorKey && !usedAccessors.has(accessorKey)) {
            reorderedRegularColumns.push(col);
        }
    });

    // Combine: special columns + reordered regular columns + options column
    const finalColumns = [...specialColumns, ...reorderedRegularColumns];
    if (optionsColumn) {
        finalColumns.push(optionsColumn);
    }

    return finalColumns;
};

/**
 * Apply custom names to column headers for enroll request
 * Modifies column definitions to use custom display names from system fields
 */
export const applyEnrollRequestSystemFieldCustomNames = <T,>(
    columns: ColumnDef<T>[]
): ColumnDef<T>[] => {
    const customNames = getEnrollRequestSystemFieldCustomNames();

    // If no custom names, return original columns
    if (Object.keys(customNames).length === 0) {
        return columns;
    }

    return columns.map((col) => {
        const accessorKey = 'accessorKey' in col ? (col.accessorKey as string) : null;

        if (accessorKey && customNames[accessorKey]) {
            // Clone the column and update the header
            // Keep function headers as is, only replace string headers
            return {
                ...col,
                header: typeof col.header === 'function' ? col.header : customNames[accessorKey],
            } as ColumnDef<T>;
        }

        return col;
    });
};

/**
 * Main function to process enroll request columns with system field settings
 * Applies custom names, reorders columns, and prepares visibility settings
 */
export const processEnrollRequestColumnsWithSystemFields = <T,>(
    columns: ColumnDef<T>[]
): {
    columns: ColumnDef<T>[];
    visibility: Record<string, boolean>;
} => {
    // Step 1: Apply custom names
    let processedColumns = applyEnrollRequestSystemFieldCustomNames(columns);
    // Step 2: Reorder columns
    processedColumns = reorderEnrollRequestColumnsBySystemFields(processedColumns);
    // Step 3: Get visibility settings
    const visibility = getEnrollRequestSystemFieldColumnVisibility();

    return {
        columns: processedColumns,
        visibility,
    };
};
