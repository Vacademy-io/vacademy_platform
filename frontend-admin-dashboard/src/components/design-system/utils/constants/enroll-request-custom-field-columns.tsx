import { ColumnDef, Row } from '@tanstack/react-table';
import { StudentTable } from '@/types/student-table-types';
import { getFieldsForLocation, FieldForLocation } from '@/lib/custom-fields/utils';
import { useClickHandlers } from './table-column-data';
import { convertToUpperCase } from '@/utils/customFields';

/**
 * Component to render custom field cell value for enroll request
 */
const EnrollRequestCustomFieldCell = ({
    row,
    customFieldId,
}: {
    row: Row<StudentTable>;
    customFieldId: string;
}) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();

    // Get the value from custom_fields object using the customFieldId as key
    const value = row.original.custom_fields?.[customFieldId] ?? '-';

    return (
        <div
            onClick={() => handleClick(customFieldId, row)}
            onDoubleClick={(e) => handleDoubleClick(e, customFieldId, row)}
            className="cursor-pointer"
        >
            {value}
        </div>
    );
};

/**
 * Generate dynamic column definitions for custom fields that are visible in Enroll Request
 *
 * This function:
 * 1. Gets custom fields configured for "Enroll Request" from storage
 * 2. Creates a column definition for each custom field
 * 3. Maps customFieldId from student.custom_fields to the field name from settings
 *
 * @returns Array of column definitions for custom fields
 */
export const generateEnrollRequestCustomFieldColumns = (): ColumnDef<StudentTable>[] => {
    try {
        // Get all fields that should be visible in Enroll Request
        const customFields = getFieldsForLocation('Enroll Request List');

        if (!customFields || customFields.length === 0) {
            return [];
        }

        // Create a column definition for each custom field
        return customFields
            .filter((field) => field.id && field.name) // Only include fields with valid id and name
            .map((field: FieldForLocation) => ({
                accessorKey: field.id,
                id: field.id,
                size: 180,
                minSize: 120,
                maxSize: 300,
                header: convertToUpperCase(field.name), // Use the field name from settings as the column header
                cell: ({ row }: { row: Row<StudentTable> }) => (
                    <EnrollRequestCustomFieldCell row={row} customFieldId={field.id} />
                ),
                enableHiding: true,
                // Add metadata to help identify custom field columns
                meta: {
                    isCustomField: true,
                    customFieldId: field.id,
                    customFieldType: field.type,
                },
            }));
    } catch (error) {
        console.error('Error generating enroll request custom field columns:', error);
        return [];
    }
};

/**
 * Get column width classes for enroll request custom field columns
 *
 * @returns Record of column IDs to width classes
 */
export const getEnrollRequestCustomFieldColumnWidths = (): Record<string, string> => {
    try {
        const customFields = getFieldsForLocation('Enroll Request');

        if (!customFields || customFields.length === 0) {
            return {};
        }

        const widths: Record<string, string> = {};

        customFields.forEach((field) => {
            // Use the custom field ID as the key
            widths[field.id] = 'min-w-[180px]';
        });

        return widths;
    } catch (error) {
        console.error('Error generating enroll request custom field column widths:', error);
        return {};
    }
};
