import { ColumnDef, Row } from '@tanstack/react-table';
import { StudentTable } from '@/types/student-table-types';
import { useClickHandlers } from './table-column-data';
import { convertToUpperCase } from '@/utils/customFields';
import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';

// Live list of every custom field defined for the institute. The Learner's List
// table includes columns for ALL of them; per-role visibility is the single
// source of truth and is handled via display-settings (LearnerListColumnsCard).
// The institute-wide `visibility.learnersList` flag on each custom field is
// intentionally ignored here.
type LearnerListCustomField = { id: string; name: string; type?: string };

const getAllCustomFieldsForLearnerList = (): LearnerListCustomField[] => {
    const cache = getCustomFieldSettingsFromCache();
    if (!cache) return [];
    const all = [
        ...cache.instituteFields,
        ...cache.customFields,
        ...cache.fieldGroups.flatMap((g) => g.fields),
    ];
    // Deduplicate by id in case the same field appears in multiple buckets.
    const byId = new Map<string, LearnerListCustomField>();
    for (const f of all) {
        if (!f.id) continue;
        if (!byId.has(f.id)) byId.set(f.id, { id: f.id, name: f.name, type: f.type });
    }
    return Array.from(byId.values());
};

/**
 * Component to render custom field cell value
 */
const formatCustomFieldValue = (value: string, fieldType?: string): string => {
    if (!value || value === '-') return '-';
    switch (fieldType) {
        case 'checkbox':
            return value === 'true' ? 'Yes' : 'No';
        case 'date':
            try {
                return new Date(value).toLocaleDateString();
            } catch {
                return value;
            }
        case 'multi_select':
            try {
                const arr = JSON.parse(value);
                return Array.isArray(arr) ? arr.join(', ') : value;
            } catch {
                return value;
            }
        default:
            return value;
    }
};

const CustomFieldCell = ({
    row,
    customFieldId,
    fieldType,
}: {
    row: Row<StudentTable>;
    customFieldId: string;
    fieldType?: string;
}) => {
    const { handleClick, handleDoubleClick } = useClickHandlers();

    const rawValue = row.original.custom_fields?.[customFieldId] ?? '-';
    const displayValue = formatCustomFieldValue(String(rawValue), fieldType);

    if (fieldType === 'file' && rawValue && rawValue !== '-') {
        return (
            <a
                href={String(rawValue)}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer text-primary-500 underline"
                onClick={(e) => e.stopPropagation()}
            >
                View File
            </a>
        );
    }

    return (
        <div
            onClick={() => handleClick(customFieldId, row)}
            onDoubleClick={(e) => handleDoubleClick(e, customFieldId, row)}
            className="cursor-pointer"
        >
            {displayValue}
        </div>
    );
};

/**
 * Generate dynamic column definitions for custom fields that are visible in Learner's List
 *
 * This function:
 * 1. Gets custom fields configured for "Learner's List" from storage
 * 2. Creates a column definition for each custom field
 * 3. Maps customFieldId from student.custom_fields to the field name from settings
 *
 * @returns Array of column definitions for custom fields
 */
export const generateCustomFieldColumns = (): ColumnDef<StudentTable>[] => {
    try {
        // Include ALL institute custom fields — per-role visibility is enforced via
        // display-settings (LearnerListColumnsCard) which feeds the columnVisibility
        // map. The legacy institute-wide `visibility.learnersList` flag is ignored here.
        const customFields = getAllCustomFieldsForLearnerList();

        if (customFields.length === 0) {
            return [];
        }

        return customFields
            .filter((field) => field.id && field.name)
            .map((field) => ({
                accessorKey: field.id,
                id: field.id,
                size: 180,
                minSize: 120,
                maxSize: 300,
                header: convertToUpperCase(field.name),
                cell: ({ row }: { row: Row<StudentTable> }) => (
                    <CustomFieldCell row={row} customFieldId={field.id} fieldType={field.type} />
                ),
                enableHiding: true,
                meta: {
                    isCustomField: true,
                    customFieldId: field.id,
                    customFieldType: field.type,
                },
            }));
    } catch (error) {
        console.error('Error generating custom field columns:', error);
        return [];
    }
};

/**
 * Get column width classes for custom field columns
 *
 * @returns Record of column IDs to width classes
 */
export const getCustomFieldColumnWidths = (): Record<string, string> => {
    try {
        const customFields = getAllCustomFieldsForLearnerList();
        if (customFields.length === 0) return {};

        const widths: Record<string, string> = {};
        customFields.forEach((field) => {
            widths[field.id] = 'min-w-[180px]';
        });
        return widths;
    } catch (error) {
        console.error('Error generating custom field column widths:', error);
        return {};
    }
};
