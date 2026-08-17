import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { Export, Warning } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    getResultExportColumns,
    handleExportResultCSV,
    ResultExportCustomFieldColumn,
} from '../-services/assessment-details-services';

interface AssessmentExportCsvDialogProps {
    assessmentId: string;
    instituteId: string | undefined;
    assessmentType: string;
}

const labelForCustomField = (field: ResultExportCustomFieldColumn) =>
    field.field_name?.trim() || field.field_key?.trim() || field.column_label;

/**
 * Export CSV for the submissions tab. The dialog lists every column the file can
 * carry — the fixed result columns plus the registration-form fields external
 * participants filled in when registering for a public assessment — all ticked
 * by default, so the exported sheet includes that data unless the admin opts out.
 */
export const AssessmentExportCsvDialog = ({
    assessmentId,
    instituteId,
    assessmentType,
}: AssessmentExportCsvDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedBaseColumns, setSelectedBaseColumns] = useState<string[]>([]);
    const [selectedCustomFieldIds, setSelectedCustomFieldIds] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const columnsQuery = useQuery({
        queryKey: ['RESULT_EXPORT_COLUMNS', instituteId, assessmentId],
        queryFn: () => getResultExportColumns(instituteId, assessmentId),
        enabled: open,
    });

    const baseColumns = useMemo(
        () => columnsQuery.data?.base_columns ?? [],
        [columnsQuery.data?.base_columns]
    );
    const customFields = useMemo(
        () => columnsQuery.data?.custom_fields ?? [],
        [columnsQuery.data?.custom_fields]
    );

    // Every column starts ticked, on each open — the common case is "give me the
    // whole sheet", and a cached column list would otherwise reopen the dialog
    // with the previous export's unticked boxes.
    useEffect(() => {
        if (!open || !columnsQuery.data) return;
        setSelectedBaseColumns(baseColumns);
        setSelectedCustomFieldIds(customFields.map((field) => field.id));
    }, [open, columnsQuery.data, baseColumns, customFields]);

    const toggleBaseColumn = (column: string, checked: boolean) => {
        setSelectedBaseColumns((prev) =>
            checked ? [...prev, column] : prev.filter((item) => item !== column)
        );
    };

    const toggleCustomField = (fieldId: string, checked: boolean) => {
        setSelectedCustomFieldIds((prev) =>
            checked ? [...prev, fieldId] : prev.filter((item) => item !== fieldId)
        );
    };

    const allSelected =
        selectedBaseColumns.length === baseColumns.length &&
        selectedCustomFieldIds.length === customFields.length;

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedBaseColumns([]);
            setSelectedCustomFieldIds([]);
            return;
        }
        setSelectedBaseColumns(baseColumns);
        setSelectedCustomFieldIds(customFields.map((field) => field.id));
    };

    const selectedColumnCount = selectedBaseColumns.length + selectedCustomFieldIds.length;

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const data = await handleExportResultCSV(
                instituteId,
                assessmentId,
                assessmentType,
                // Column list unavailable → fall back to the full sheet rather
                // than exporting an empty selection.
                columnsQuery.isError ? undefined : selectedCustomFieldIds
            );
            if (!data) {
                toast.error('No data returned. Please try again.');
                return;
            }
            const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
            // Keep the backend's column order, minus whatever the admin unticked.
            // Custom-field columns are already filtered server-side, so only the
            // fixed result columns need dropping here.
            const headers = (parsed.meta.fields ?? []).filter(
                (header) => !baseColumns.includes(header) || selectedBaseColumns.includes(header)
            );
            // unparse(rows, { columns }) yields "" for an empty row set, so an
            // assessment with no submissions would download a blank file instead
            // of the header row telling the admin the sheet is simply empty.
            const csv = parsed.data.length
                ? Papa.unparse(parsed.data, { columns: headers })
                : Papa.unparse({ fields: headers, data: [] });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `results_${assessmentId}_${new Date().toLocaleDateString()}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Results exported successfully.');
            setOpen(false);
        } catch {
            toast.error('Failed to export CSV. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={setOpen}
            heading="Export CSV"
            dialogWidth="max-w-lg"
            trigger={
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="font-medium"
                >
                    <Export size={16} />
                    Export
                </MyButton>
            }
        >
            <div className="flex flex-col gap-4">
                {columnsQuery.isLoading && <DashboardLoader />}

                {columnsQuery.isError && (
                    <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-caption text-danger-600">
                        <Warning size={16} className="mt-0.5 shrink-0" />
                        <span>
                            Could not load the column list. You can still export the standard result
                            columns.
                        </span>
                    </div>
                )}

                {!columnsQuery.isLoading && !columnsQuery.isError && (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-body text-neutral-600">
                                Choose the columns to include in the file.
                            </p>
                            {(baseColumns.length > 0 || customFields.length > 0) && (
                                <button
                                    type="button"
                                    className="text-caption font-medium text-primary-500 hover:text-primary-600"
                                    onClick={handleSelectAll}
                                >
                                    {allSelected ? 'Clear all' : 'Select all'}
                                </button>
                            )}
                        </div>

                        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto pr-1">
                            {baseColumns.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-caption font-semibold uppercase text-neutral-500">
                                        Result columns
                                    </p>
                                    {baseColumns.map((column) => (
                                        <label
                                            key={column}
                                            className="flex cursor-pointer items-center gap-2"
                                        >
                                            <Checkbox
                                                checked={selectedBaseColumns.includes(column)}
                                                onCheckedChange={(checked) =>
                                                    toggleBaseColumn(column, checked === true)
                                                }
                                            />
                                            <span className="text-body text-neutral-600">
                                                {column}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <p className="text-caption font-semibold uppercase text-neutral-500">
                                    Registration form fields
                                </p>
                                {customFields.length === 0 ? (
                                    <p className="text-caption text-neutral-400">
                                        This assessment collects no extra details at registration.
                                    </p>
                                ) : (
                                    customFields.map((field) => (
                                        <label
                                            key={field.id}
                                            className="flex cursor-pointer items-center gap-2"
                                        >
                                            <Checkbox
                                                checked={selectedCustomFieldIds.includes(field.id)}
                                                onCheckedChange={(checked) =>
                                                    toggleCustomField(field.id, checked === true)
                                                }
                                            />
                                            <span className="text-body text-neutral-600">
                                                {labelForCustomField(field)}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}

                {!columnsQuery.isLoading && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="primary"
                        disable={
                            isExporting || (!columnsQuery.isError && selectedColumnCount === 0)
                        }
                        onClick={handleExport}
                    >
                        {isExporting ? 'Exporting…' : 'Export CSV'}
                    </MyButton>
                )}
            </div>
        </MyDialog>
    );
};

export default AssessmentExportCsvDialog;
