import { ColumnDef } from '@tanstack/react-table';
import { SystemField } from '@/services/custom-field-settings';

/**
 * Map system field keys to their corresponding column accessorKeys in myColumns
 */
const SYSTEM_FIELD_KEY_TO_ACCESSOR: Record<string, string> = {
    FULL_NAME: 'full_name',
    USERNAME: 'username',
    PACKAGE_SESSION_ID: 'package_session_id',
    INSTITUTE_ENROLLMENT_ID: 'institute_enrollment_id',
    LINKED_INSTITUTE_NAME: 'linked_institute_name',
    GENDER: 'gender',
    MOBILE_NUMBER: 'mobile_number',
    EMAIL: 'email',
    FATHER_NAME: 'father_name',
    MOTHER_NAME: 'mother_name',
    PARENTS_MOBILE_NUMBER: 'parents_mobile_number',
    PARENTS_EMAIL: 'parents_email',
    PARENTS_TO_MOTHER_MOBILE_NUMBER: 'parents_to_mother_mobile_number',
    PARENTS_TO_MOTHER_EMAIL: 'parents_to_mother_email',
    CITY: 'city',
    REGION: 'region',
    ATTENDANCE: 'attendance',
    COUNTRY: 'country',
    PLAN_TYPE: 'plan_type',
    AMOUNT_PAID: 'amount_paid',
    PREFFERED_BATCH: 'preffered_batch',
    EXPIRY_DATE: 'expiry_date',
    STATUS: 'status',
};

/**
 * Get system fields from localStorage custom field settings
 */
export const getSystemFieldsFromStorage = (): SystemField[] => {
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
        console.error('❌ Error loading system fields from storage:', error);
        return [];
    }
};

/**
 * Get column visibility based on system fields
 * Returns a map of accessorKey -> visibility boolean
 */
export const getSystemFieldColumnVisibility = (): Record<string, boolean> => {
    const systemFields = getSystemFieldsFromStorage();
    const visibility: Record<string, boolean> = {};

    // If no system fields, return empty (will use defaults)
    if (systemFields.length === 0) {
        return visibility;
    }

    // Set visibility based on system fields
    systemFields.forEach((field) => {
        const accessorKey = SYSTEM_FIELD_KEY_TO_ACCESSOR[field.key];
        if (accessorKey) {
            visibility[accessorKey] = field.visibility;
        }
    });

    return visibility;
};

/**
 * Get ordered system field accessorKeys based on their order property
 * Returns array of accessorKeys in the correct order
 */
export const getOrderedSystemFieldAccessors = (): string[] => {
    const systemFields = getSystemFieldsFromStorage();

    if (systemFields.length === 0) {
        return [];
    }

    // Sort by order property
    const sortedFields = [...systemFields].sort((a, b) => a.order - b.order);

    // Map to accessorKeys and filter out any that don't have a mapping
    const orderedAccessors = sortedFields
        .map((field) => SYSTEM_FIELD_KEY_TO_ACCESSOR[field.key])
        .filter((accessor): accessor is string => !!accessor);

    return orderedAccessors;
};

/**
 * Get custom display names for system fields
 * Returns a map of accessorKey -> custom display name
 */
export const getSystemFieldCustomNames = (): Record<string, string> => {
    const systemFields = getSystemFieldsFromStorage();
    const customNames: Record<string, string> = {};

    systemFields.forEach((field) => {
        const accessorKey = SYSTEM_FIELD_KEY_TO_ACCESSOR[field.key];
        if (accessorKey) {
            // Use customValue if it differs from defaultValue, otherwise use defaultValue
            customNames[accessorKey] = field.customValue || field.defaultValue;
        }
    });

    return customNames;
};

/**
 * Reorder columns based on system field order
 * Takes original columns and returns them reordered according to systemFields
 */
export const reorderColumnsBySystemFields = <T,>(columns: ColumnDef<T>[]): ColumnDef<T>[] => {
    const orderedAccessors = getOrderedSystemFieldAccessors();

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
 * Apply custom names to column headers
 * Modifies column definitions to use custom display names from system fields
 */
export const applySystemFieldCustomNames = <T,>(columns: ColumnDef<T>[]): ColumnDef<T>[] => {
    const customNames = getSystemFieldCustomNames();

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
 * Main function to process columns with system field settings
 * Applies custom names, reorders columns, and prepares visibility settings
 */
export const processColumnsWithSystemFields = <T,>(
    columns: ColumnDef<T>[]
): {
    columns: ColumnDef<T>[];
    visibility: Record<string, boolean>;
} => {
    // Step 1: Apply custom names
    let processedColumns = applySystemFieldCustomNames(columns);

    // Step 2: Reorder columns
    processedColumns = reorderColumnsBySystemFields(processedColumns);

    // Step 3: Get visibility settings
    const visibility = getSystemFieldColumnVisibility();

    return {
        columns: processedColumns,
        visibility,
    };
};
