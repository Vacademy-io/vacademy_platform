import { useRef, useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Download,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_USERS } from '@/constants/urls';
import { fetchLeadStatuses } from '@/hooks/use-lead-statuses';
import {
    submitBulkAudienceLead,
    type BulkSubmitLeadResponse,
    type BulkSubmitLeadResultItem,
} from '../../-services/bulk-submit-audience-lead';
import { type SubmitLeadRequest } from '../../-services/submit-audience-lead';
import {
    type CustomFieldConfig,
    type CounsellorOption,
    type OwnerResolution,
    type StatusResolution,
    parseCustomFieldsFromJson,
    generateCsvTemplate,
    buildHeaderToFieldIdMap,
    extractUserInfoFromRow,
    validateRow,
    getMissingMandatoryColumns,
    detectOwnerHeader,
    detectStatusHeader,
    buildCounsellorResolver,
    buildStatusResolver,
    resolveOwner,
    resolveStatus,
} from '../../-utils/lead-bulk-import-utils';
import { useGetCampaignById } from '../../-hooks/useGetCampaignById';

const BATCH_SIZE = 1000;

/** Institute counsellors/admins, including email so owners resolve by email or name. */
async function fetchCounsellorOptions(instituteId: string): Promise<CounsellorOption[]> {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: { instituteId, pageNumber: 0, pageSize: 500 },
        data: { roles: ['COUNSELLOR', 'ADMIN', 'TEACHER'], status: ['ACTIVE'] },
    });
    const raw = Array.isArray(response.data) ? response.data : response.data?.content || [];
    return raw.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        full_name: (u.full_name as string) || '',
        email: (u.email as string) || undefined,
    }));
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

type Step = 'upload' | 'preview' | 'results';

interface ParsedRow {
    raw: Record<string, string>;
    /** Custom-field validation errors. Owner/status errors are merged in at resolve time. */
    baseErrors: string[];
    isDuplicate: boolean;
}

interface ResolvedRow extends ParsedRow {
    owner: OwnerResolution;
    status: StatusResolution;
    errors: string[];
}

interface LeadBulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string;
    campaignName: string;
    instituteId: string;
    customFields?: CustomFieldConfig[];
    onSuccess?: () => void;
}

// Large cap to support migrations (e.g. tens of thousands of leads). Rows are submitted
// to the backend in batches of BATCH_SIZE rather than one giant request.
const MAX_ROWS = 100000;

export function LeadBulkImportDialog({
    open,
    onOpenChange,
    campaignId,
    campaignName,
    instituteId,
    customFields: customFieldsProp = [],
    onSuccess,
}: LeadBulkImportDialogProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch campaign details to get custom fields when not provided via props
    const needsFetch = customFieldsProp.length === 0;
    const { data: fetchedCampaign, isLoading: isFetchingCampaign } = useGetCampaignById({
        instituteId,
        audienceId: campaignId,
        enabled: open && needsFetch,
    });

    const fetchedFields = useMemo(() => {
        if (!fetchedCampaign?.institute_custom_fields) return [];
        return parseCustomFieldsFromJson(JSON.stringify(fetchedCampaign.institute_custom_fields));
    }, [fetchedCampaign]);

    const customFields = customFieldsProp.length > 0 ? customFieldsProp : fetchedFields;

    const [step, setStep] = useState<Step>('upload');
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [headerToFieldId, setHeaderToFieldId] = useState<Map<string, string>>(new Map());
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [ownerHeader, setOwnerHeader] = useState<string | null>(null);
    const [statusHeader, setStatusHeader] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitProgress, setSubmitProgress] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<BulkSubmitLeadResponse | null>(null);
    const [showErrors, setShowErrors] = useState(false);

    // Counsellor + lead-status catalogs, fetched once the dialog opens, used to resolve the
    // optional Lead Owner / Lead Status CSV columns to ids the backend understands.
    const { data: counsellors = [] } = useQuery({
        queryKey: ['bulk-import-counsellors', instituteId],
        queryFn: () => fetchCounsellorOptions(instituteId),
        enabled: open && !!instituteId,
        staleTime: 5 * 60 * 1000,
    });
    const { data: leadStatuses = [] } = useQuery({
        queryKey: ['bulk-import-lead-statuses', instituteId],
        queryFn: fetchLeadStatuses,
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });

    const counsellorResolver = useMemo(() => buildCounsellorResolver(counsellors), [counsellors]);
    const statusResolver = useMemo(() => buildStatusResolver(leadStatuses), [leadStatuses]);
    const defaultStatusLabel = useMemo(
        () => leadStatuses.find((s) => s.is_default)?.label,
        [leadStatuses]
    );

    // Re-resolve owner/status whenever the parsed rows or the catalogs change, so resolution
    // is correct even if the file was uploaded before the catalogs finished loading.
    const resolvedRows = useMemo<ResolvedRow[]>(() => {
        return parsedRows.map((pr) => {
            const owner: OwnerResolution = ownerHeader
                ? resolveOwner(pr.raw[ownerHeader] || '', counsellorResolver)
                : {};
            const status: StatusResolution = statusHeader
                ? resolveStatus(pr.raw[statusHeader] || '', statusResolver)
                : {};
            const errors = [...pr.baseErrors];
            if (owner.error) errors.push(owner.error);
            if (status.error) errors.push(status.error);
            return { ...pr, owner, status, errors };
        });
    }, [parsedRows, ownerHeader, statusHeader, counsellorResolver, statusResolver]);

    const validRows = useMemo(
        () => resolvedRows.filter((r) => r.errors.length === 0 && !r.isDuplicate),
        [resolvedRows]
    );
    const errorRows = useMemo(() => resolvedRows.filter((r) => r.errors.length > 0), [resolvedRows]);
    const duplicateRows = useMemo(() => resolvedRows.filter((r) => r.isDuplicate), [resolvedRows]);

    const resetState = useCallback(() => {
        setStep('upload');
        setParsedRows([]);
        setHeaderToFieldId(new Map());
        setCsvHeaders([]);
        setOwnerHeader(null);
        setStatusHeader(null);
        setIsSubmitting(false);
        setSubmitProgress(null);
        setResult(null);
        setShowErrors(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onOpenChange(false);
    }, [resetState, onOpenChange]);

    // --- Step 1: Download Template ---
    const handleDownloadTemplate = useCallback(() => {
        const csv = generateCsvTemplate(customFields, { statusSample: defaultStatusLabel });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_template.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [customFields, campaignName, defaultStatusLabel]);

    // --- Step 1: Parse CSV ---
    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            Papa.parse<Record<string, string>>(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data;

                    if (data.length === 0) {
                        toast.error('CSV file is empty');
                        return;
                    }

                    if (data.length > MAX_ROWS) {
                        toast.error(`CSV has ${data.length} rows. Maximum allowed is ${MAX_ROWS}.`);
                        return;
                    }

                    const headers = results.meta.fields || [];
                    setCsvHeaders(headers);

                    const fieldMap = buildHeaderToFieldIdMap(headers, customFields);
                    setHeaderToFieldId(fieldMap);

                    // Detect the optional Lead Owner / Lead Status columns (resolved later).
                    setOwnerHeader(detectOwnerHeader(headers));
                    setStatusHeader(detectStatusHeader(headers));

                    // Check for missing mandatory columns
                    const missingCols = getMissingMandatoryColumns(fieldMap, customFields);
                    if (missingCols.length > 0) {
                        toast.warning(
                            `Missing mandatory columns: ${missingCols.join(', ')}. Rows with these fields will show errors.`
                        );
                    }

                    // Validate rows and detect duplicates (owner/status resolution happens in a memo)
                    const seenEmails = new Set<string>();
                    const parsed: ParsedRow[] = data.map((row) => {
                        const baseErrors = validateRow(row, fieldMap, customFields);

                        // Deduplicate by email
                        const { email } = extractUserInfoFromRow(row, fieldMap, customFields);
                        const emailKey = email.trim().toLowerCase();
                        let isDuplicate = false;
                        if (emailKey && seenEmails.has(emailKey)) {
                            isDuplicate = true;
                        } else if (emailKey) {
                            seenEmails.add(emailKey);
                        }

                        return { raw: row, baseErrors, isDuplicate };
                    });

                    setParsedRows(parsed);
                    setStep('preview');
                },
                error: (error) => {
                    toast.error(`Failed to parse CSV: ${error.message}`);
                },
            });
        },
        [customFields]
    );

    // --- Step 2: Submit ---
    const handleSubmit = useCallback(async () => {
        if (validRows.length === 0) {
            toast.error('No valid rows to submit');
            return;
        }

        setIsSubmitting(true);

        try {
            const rows: SubmitLeadRequest[] = validRows.map((pr) => {
                // Build custom_field_values: { fieldId: value }
                const customFieldValues: Record<string, string> = {};
                for (const [header, fieldId] of headerToFieldId) {
                    const value = (pr.raw[header] || '').trim();
                    if (value) {
                        customFieldValues[fieldId] = value;
                    }
                }

                const { email, phone, fullName } = extractUserInfoFromRow(
                    pr.raw,
                    headerToFieldId,
                    customFields
                );

                const row: SubmitLeadRequest = {
                    audience_id: campaignId,
                    source_type: 'AUDIENCE_CAMPAIGN',
                    source_id: campaignId,
                    custom_field_values: customFieldValues,
                    user_dto: {
                        id: '',
                        username: email || '',
                        email: email || '',
                        full_name: fullName || '',
                        mobile_number: phone || '',
                        date_of_birth: null,
                        gender: '',
                        password: '',
                        roles: [],
                        last_login_time: null,
                        root_user: false,
                    },
                };
                if (pr.owner.counsellorId) {
                    row.counsellor_id = pr.owner.counsellorId;
                    row.counsellor_name = pr.owner.counsellorName;
                }
                if (pr.status.leadStatusKey) {
                    row.lead_status_key = pr.status.leadStatusKey;
                }
                return row;
            });

            // Submit in batches so very large imports don't hit a single huge request.
            const batches = chunk(rows, BATCH_SIZE);
            setSubmitProgress({ done: 0, total: batches.length });

            const summary = { total_requested: 0, successful: 0, failed: 0, skipped: 0 };
            const results: BulkSubmitLeadResultItem[] = [];

            for (let b = 0; b < batches.length; b++) {
                const resp = await submitBulkAudienceLead({
                    audience_id: campaignId,
                    rows: batches[b]!,
                });
                summary.total_requested += resp.summary.total_requested;
                summary.successful += resp.summary.successful;
                summary.failed += resp.summary.failed;
                summary.skipped += resp.summary.skipped;
                const offset = b * BATCH_SIZE;
                for (const r of resp.results) {
                    results.push({ ...r, index: r.index + offset });
                }
                setSubmitProgress({ done: b + 1, total: batches.length });
            }

            setResult({ summary, results });
            setStep('results');

            if (summary.failed === 0 && summary.skipped === 0) {
                toast.success(`All ${summary.successful} leads imported successfully!`);
            } else {
                toast.info(
                    `Import complete: ${summary.successful} success, ${summary.failed} failed, ${summary.skipped} skipped`
                );
            }

            queryClient.invalidateQueries({ queryKey: ['campaignUsers'] });
            onSuccess?.();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Failed to submit leads'
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [validRows, headerToFieldId, customFields, campaignId, queryClient, onSuccess]);

    return (
        <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bulk Import CSV — {campaignName}</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to import multiple leads at once.
                    </DialogDescription>
                </DialogHeader>

                {/* ===== STEP 1: UPLOAD ===== */}
                {step === 'upload' && isFetchingCampaign && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="mr-2 size-5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading campaign fields...</span>
                    </div>
                )}
                {step === 'upload' && !isFetchingCampaign && customFields.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                        <p>No custom fields configured for this campaign.</p>
                        <p className="mt-1 text-sm">Add custom fields to the campaign before importing.</p>
                    </div>
                )}
                {step === 'upload' && !isFetchingCampaign && customFields.length > 0 && (
                    <div className="flex flex-col gap-4 py-2">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadTemplate}
                            >
                                <Download className="mr-2 size-4" />
                                Download Template
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                CSV with {customFields.length} field
                                {customFields.length !== 1 ? 's' : ''} + sample row
                            </span>
                        </div>

                        <div
                            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 transition-colors hover:border-primary/50"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Click to upload CSV (max {MAX_ROWS} rows)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className="rounded-md bg-muted/50 p-3">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                                Expected columns:
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {customFields.map((f) => (
                                    <span
                                        key={f.id}
                                        className="inline-flex items-center rounded bg-background px-2 py-0.5 text-xs"
                                    >
                                        {f.fieldName}
                                        {f.isMandatory && (
                                            <span className="ml-0.5 text-red-500">*</span>
                                        )}
                                    </span>
                                ))}
                                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                    Lead Owner (Counsellor Email)
                                </span>
                                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                    Lead Status
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium">Lead Owner</span> and{' '}
                                <span className="font-medium">Lead Status</span> are optional.
                                Owner accepts a counsellor email (or unique name); status accepts a
                                label like{' '}
                                {leadStatuses.length > 0
                                    ? leadStatuses
                                          .slice(0, 4)
                                          .map((s) => s.label)
                                          .join(', ')
                                    : 'New, Contacted, Interested'}
                                . Blank status defaults to{' '}
                                {defaultStatusLabel || 'your default status'}.
                            </p>
                        </div>
                    </div>
                )}

                {/* ===== STEP 2: PREVIEW ===== */}
                {step === 'preview' && (
                    <div className="flex flex-col gap-4 py-2">
                        {/* Summary badges */}
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                                <CheckCircle2 className="size-3" />
                                {validRows.length} valid
                            </span>
                            {errorRows.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                                    <XCircle className="size-3" />
                                    {errorRows.length} errors
                                </span>
                            )}
                            {duplicateRows.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                                    <AlertTriangle className="size-3" />
                                    {duplicateRows.length} duplicates
                                </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                                {parsedRows.length} total rows
                            </span>
                        </div>

                        {/* Column mapping info */}
                        <div className="rounded-md bg-muted/50 p-3">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                                Column mapping ({headerToFieldId.size}/{csvHeaders.length} mapped):
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {csvHeaders.map((h) => {
                                    const isSpecial = h === ownerHeader || h === statusHeader;
                                    const mapped = headerToFieldId.has(h) || isSpecial;
                                    return (
                                        <span
                                            key={h}
                                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                                                isSpecial
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : mapped
                                                      ? 'bg-green-50 text-green-700'
                                                      : 'bg-red-50 text-red-700'
                                            }`}
                                        >
                                            {h} {mapped ? '✓' : '✗'}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Preview table */}
                        <div className="max-h-64 overflow-auto rounded border">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-muted">
                                    <tr>
                                        <th className="px-2 py-1 text-left">#</th>
                                        <th className="px-2 py-1 text-left">Status</th>
                                        {csvHeaders
                                            .filter((h) => headerToFieldId.has(h))
                                            .map((h) => (
                                                <th key={h} className="px-2 py-1 text-left">
                                                    {h}
                                                </th>
                                            ))}
                                        {ownerHeader && (
                                            <th className="px-2 py-1 text-left text-blue-700">
                                                Owner →
                                            </th>
                                        )}
                                        {statusHeader && (
                                            <th className="px-2 py-1 text-left text-blue-700">
                                                Status →
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resolvedRows.slice(0, 100).map((pr, i) => {
                                        const hasError = pr.errors.length > 0;
                                        const rowClass = hasError
                                            ? 'bg-red-50'
                                            : pr.isDuplicate
                                              ? 'bg-yellow-50'
                                              : '';
                                        return (
                                            <tr key={i} className={rowClass}>
                                                <td className="px-2 py-1">{i + 1}</td>
                                                <td className="px-2 py-1">
                                                    {hasError ? (
                                                        <span
                                                            className="cursor-help text-red-600"
                                                            title={pr.errors.join('; ')}
                                                        >
                                                            ✗
                                                        </span>
                                                    ) : pr.isDuplicate ? (
                                                        <span className="text-yellow-600" title="Duplicate email">
                                                            ≈
                                                        </span>
                                                    ) : (
                                                        <span className="text-green-600">✓</span>
                                                    )}
                                                </td>
                                                {csvHeaders
                                                    .filter((h) => headerToFieldId.has(h))
                                                    .map((h) => (
                                                        <td
                                                            key={h}
                                                            className="max-w-[150px] truncate px-2 py-1"
                                                        >
                                                            {pr.raw[h] || ''}
                                                        </td>
                                                    ))}
                                                {ownerHeader && (
                                                    <td className="max-w-40 truncate px-2 py-1">
                                                        {pr.owner.error ? (
                                                            <span
                                                                className="cursor-help text-red-600"
                                                                title={pr.owner.error}
                                                            >
                                                                {pr.raw[ownerHeader] || ''} ✗
                                                            </span>
                                                        ) : (
                                                            <span className="text-neutral-700">
                                                                {pr.owner.counsellorName || '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                                {statusHeader && (
                                                    <td className="max-w-40 truncate px-2 py-1">
                                                        {pr.status.error ? (
                                                            <span
                                                                className="cursor-help text-red-600"
                                                                title={pr.status.error}
                                                            >
                                                                {pr.raw[statusHeader] || ''} ✗
                                                            </span>
                                                        ) : (
                                                            <span className="text-neutral-700">
                                                                {pr.status.leadStatusKey || '—'}
                                                            </span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {resolvedRows.length > 100 && (
                                <p className="px-2 py-1 text-center text-xs text-muted-foreground">
                                    Showing first 100 of {resolvedRows.length} rows
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-between">
                            <Button variant="outline" size="sm" onClick={resetState}>
                                Back
                            </Button>
                            <Button
                                size="sm"
                                disabled={validRows.length === 0 || isSubmitting}
                                onClick={handleSubmit}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        {submitProgress && submitProgress.total > 1
                                            ? `Submitting… batch ${submitProgress.done}/${submitProgress.total}`
                                            : `Submitting ${validRows.length} rows...`}
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 size-4" />
                                        Submit {validRows.length} valid rows
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ===== STEP 3: RESULTS ===== */}
                {step === 'results' && result && (
                    <div className="flex flex-col gap-4 py-2">
                        {/* Summary */}
                        <div className="grid grid-cols-4 gap-3">
                            <SummaryCard
                                label="Total"
                                value={result.summary.total_requested}
                                icon={<FileSpreadsheet className="size-4" />}
                            />
                            <SummaryCard
                                label="Success"
                                value={result.summary.successful}
                                icon={<CheckCircle2 className="size-4 text-green-600" />}
                                className="bg-green-50"
                            />
                            <SummaryCard
                                label="Failed"
                                value={result.summary.failed}
                                icon={<XCircle className="size-4 text-red-600" />}
                                className="bg-red-50"
                            />
                            <SummaryCard
                                label="Skipped"
                                value={result.summary.skipped}
                                icon={<AlertTriangle className="size-4 text-yellow-600" />}
                                className="bg-yellow-50"
                            />
                        </div>

                        {/* Error details (collapsible) */}
                        {(result.summary.failed > 0 || result.summary.skipped > 0) && (
                            <div>
                                <button
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowErrors((v) => !v)}
                                >
                                    {showErrors ? (
                                        <ChevronUp className="size-3" />
                                    ) : (
                                        <ChevronDown className="size-3" />
                                    )}
                                    {showErrors ? 'Hide' : 'Show'} details
                                </button>
                                {showErrors && (
                                    <div className="mt-2 max-h-48 overflow-auto rounded border p-2">
                                        {result.results
                                            .filter((r) => r.status !== 'SUCCESS')
                                            .map((r) => (
                                                <div
                                                    key={r.index}
                                                    className="flex items-start gap-2 border-b py-1 text-xs last:border-0"
                                                >
                                                    <span className="font-mono text-muted-foreground">
                                                        Row {r.index + 1}
                                                    </span>
                                                    <span
                                                        className={
                                                            r.status === 'FAILED'
                                                                ? 'text-red-600'
                                                                : 'text-yellow-600'
                                                        }
                                                    >
                                                        [{r.status}]
                                                    </span>
                                                    <span>{r.message}</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button size="sm" onClick={handleClose}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function SummaryCard({
    label,
    value,
    icon,
    className = '',
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex flex-col items-center gap-1 rounded-lg border p-3 ${className}`}>
            {icon}
            <span className="text-lg font-semibold">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}
