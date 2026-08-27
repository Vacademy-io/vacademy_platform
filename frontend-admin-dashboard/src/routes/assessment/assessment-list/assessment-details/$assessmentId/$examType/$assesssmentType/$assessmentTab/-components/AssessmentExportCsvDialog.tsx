import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useTranslation } from 'react-i18next';
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
    /** True on the Pending tab: export the learners who never attempted, not the results. */
    notAttempted?: boolean;
    /**
     * The Pending tab's on-screen scope, so the file matches what the admin was looking
     * at when they clicked. Ignored unless notAttempted.
     */
    notAttemptedScope?: { batches: string[]; name: string };
}

const labelForCustomField = (field: ResultExportCustomFieldColumn) =>
    field.field_name?.trim() || field.field_key?.trim() || field.column_label;

/**
 * Export CSV for the submissions tab. The dialog lists every column the file can
 * carry, all ticked by default, so the exported sheet includes that data unless the
 * admin opts out.
 *
 * <p>Which columns are on offer depends on the tab. On Attempted it is the result
 * columns plus the registration-form fields external participants filled in. On
 * Pending it is contact details only — marks, rank and percentage would be blank for
 * a learner who never started, and a zero in a Marks column reads as "sat it and
 * scored nothing".
 */
export const AssessmentExportCsvDialog = ({
    assessmentId,
    instituteId,
    assessmentType,
    notAttempted = false,
    notAttemptedScope,
}: AssessmentExportCsvDialogProps) => {
    const { t } = useTranslation('assessmentExportCsvDialog');
    const [open, setOpen] = useState(false);
    const [selectedBaseColumns, setSelectedBaseColumns] = useState<string[]>([]);
    const [selectedCustomFieldIds, setSelectedCustomFieldIds] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const columnsQuery = useQuery({
        // notAttempted is part of the key: the two sheets offer different columns, so a
        // cached list from the other tab would tick boxes the file will never contain.
        queryKey: ['RESULT_EXPORT_COLUMNS', instituteId, assessmentId, notAttempted],
        queryFn: () => getResultExportColumns(instituteId, assessmentId, notAttempted),
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
                columnsQuery.isError ? undefined : selectedCustomFieldIds,
                notAttempted ? notAttemptedScope ?? { batches: [], name: '' } : undefined
            );
            if (!data) {
                toast.error(t('toasts.noData'));
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
                // Name the file after the sheet: two downloads called results_*.csv, one
                // of which is actually the not-attempted list, is a support ticket.
                `${notAttempted ? 'not_attempted' : 'results'}_${assessmentId}_${new Date().toLocaleDateString()}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(t('toasts.exportSuccess'));
            setOpen(false);
        } catch {
            toast.error(t('toasts.exportFailed'));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={setOpen}
            heading={t('dialog.heading')}
            dialogWidth="max-w-lg"
            trigger={
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="font-medium"
                >
                    <Export size={16} />
                    {t('trigger.label')}
                </MyButton>
            }
        >
            <div className="flex flex-col gap-4">
                {columnsQuery.isLoading && <DashboardLoader />}

                {columnsQuery.isError && (
                    <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-caption text-danger-600">
                        <Warning size={16} className="mt-0.5 shrink-0" />
                        <span>{t('errors.columnsLoadFailed')}</span>
                    </div>
                )}

                {!columnsQuery.isLoading && !columnsQuery.isError && (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-body text-neutral-600">
                                {t('chooseColumns')}
                            </p>
                            {(baseColumns.length > 0 || customFields.length > 0) && (
                                <button
                                    type="button"
                                    className="text-caption font-medium text-primary-500 hover:text-primary-600"
                                    onClick={handleSelectAll}
                                >
                                    {allSelected ? t('clearAll') : t('selectAll')}
                                </button>
                            )}
                        </div>

                        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto pr-1">
                            {baseColumns.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-caption font-semibold uppercase text-neutral-500">
                                        {t('resultColumns.title')}
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
                                    {t('registrationFields.title')}
                                </p>
                                {customFields.length === 0 ? (
                                    <p className="text-caption text-neutral-400">
                                        {t('registrationFields.empty')}
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
                        {isExporting ? t('exporting') : t('exportCsvButton')}
                    </MyButton>
                )}
            </div>
        </MyDialog>
    );
};

export default AssessmentExportCsvDialog;
