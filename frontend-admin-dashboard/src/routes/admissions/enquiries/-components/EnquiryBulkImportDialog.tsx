import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    submitEnquiryBulkWithLead,
    type BulkSubmitEnquiryRequest,
    type BulkSubmitEnquiryRow,
    type BulkSubmitEnquiryResponse,
} from '../-services/submit-enquiry';
import {
    normalizeGender,
    parseOptionalEnquiryStatus,
    parseOptionalParentRelationWithChild,
    parseOptionalSourceType,
} from './enquiry-bulk-import-utils';
import type { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';

type Step = 1 | 2 | 4;

type ParsedCsvRow = {
    student_name: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    date_of_birth: string;
    parent_name: string;
    parent_email: string;
    parent_mobile: string;
    parent_relation_with_child: 'FATHER' | 'MOTHER' | 'GUARDIAN';
    status: string;
    source_type?: 'WEBSITE' | 'GOOGLE_ADS' | 'FACEBOOK' | 'INSTAGRAM' | 'REFERRAL' | 'OTHER';
};

interface EnquiryBulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audienceId: string;
    onSuccess?: () => void;
}

const REQUIRED_COLUMN_LABELS = [
    'Student Name',
    'Gender',
    'Date of Birth',
    'Parent Name',
    'Parent Email',
    'Parent Mobile',
    'Relation With Child',
] as const;

const HEADER_ALIASES: Record<string, keyof ParsedCsvRow | null> = {
    studentname: 'student_name',
    student_name: 'student_name',
    full_name: 'student_name',
    childname: 'student_name',
    child_name: 'student_name',
    gender: 'gender',
    dateofbirth: 'date_of_birth',
    date_of_birth: 'date_of_birth',
    dob: 'date_of_birth',
    birthday: 'date_of_birth',
    parentname: 'parent_name',
    parent_name: 'parent_name',
    fathername: 'parent_name',
    father_name: 'parent_name',
    mothername: 'parent_name',
    mother_name: 'parent_name',
    parentemail: 'parent_email',
    parent_email: 'parent_email',
    fathersemail: 'parent_email',
    father_email: 'parent_email',
    parentmobile: 'parent_mobile',
    parent_mobile: 'parent_mobile',
    fathersmobile: 'parent_mobile',
    father_mobile: 'parent_mobile',
    status: 'status',
    enquirystatus: 'status',
    enquiry_status: 'status',
    source: 'source_type',
    sourcetype: 'source_type',
    source_type: 'source_type',
    relationwithchild: 'parent_relation_with_child',
    relation_with_child: 'parent_relation_with_child',
    parentrelationwithchild: 'parent_relation_with_child',
    parent_relation_with_child: 'parent_relation_with_child',
};

const REQUIRED_CANONICAL_FIELDS: Array<keyof ParsedCsvRow> = [
    'student_name',
    'gender',
    'date_of_birth',
    'parent_name',
    'parent_email',
    'parent_mobile',
    'parent_relation_with_child',
];

const toAliasKey = (raw: string): string => raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

const normalizeDobToISO = (value: unknown): string | null => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
    const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/;
    let year = 0;
    let month = 0;
    let day = 0;

    const ymdMatch = raw.match(ymd);
    if (ymdMatch) {
        year = Number(ymdMatch[1]);
        month = Number(ymdMatch[2]);
        day = Number(ymdMatch[3]);
    } else {
        const dmyMatch = raw.match(dmy);
        if (!dmyMatch) return null;
        day = Number(dmyMatch[1]);
        month = Number(dmyMatch[2]);
        year = Number(dmyMatch[3]);
    }

    const dt = new Date(year, month - 1, day);
    if (
        Number.isNaN(dt.getTime()) ||
        dt.getFullYear() !== year ||
        dt.getMonth() + 1 !== month ||
        dt.getDate() !== day
    ) {
        return null;
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseBooleanSuccess = (result: unknown): boolean =>
    typeof result === 'object' &&
    result !== null &&
    (((result as { status?: string }).status || '').toUpperCase() === 'SUCCESS' ||
        (result as { success?: boolean }).success === true);

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidMobile = (value: string): boolean => /^\+?[0-9]{7,15}$/.test(value.replace(/\s+/g, ''));

export const EnquiryBulkImportDialog = ({
    open,
    onOpenChange,
    audienceId,
    onSuccess,
}: EnquiryBulkImportDialogProps) => {
    const [step, setStep] = useState<Step>(1);
    const [parseError, setParseError] = useState<string | null>(null);
    const [validRows, setValidRows] = useState<ParsedCsvRow[]>([]);
    const [skippedRowsCount, setSkippedRowsCount] = useState(0);
    const [selectedPackageSessionId, setSelectedPackageSessionId] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { instituteDetails } = useInstituteDetailsStore();

    useQuery({ ...useInstituteQuery(), enabled: open });

    const classOptions = useMemo<{ id: string; label: string }[]>(
        () => {
            const batches = (instituteDetails?.batches_for_sessions ?? []) as BatchForSessionType[];
            return batches.map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}`,
            }));
        },
        [instituteDetails?.batches_for_sessions]
    );

    const resetState = () => {
        setStep(1);
        setParseError(null);
        setValidRows([]);
        setSkippedRowsCount(0);
        setSelectedPackageSessionId('');
    };

    const closeDialog = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
            resetState();
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'Student Name',
            'Gender',
            'Date of Birth',
            'Parent Name',
            'Parent Email',
            'Parent Mobile',
            'Relation With Child',
            'Status',
            'Source',
        ];
        const sample = [
            'John Student',
            'MALE',
            '2015-06-01',
            'Jane Parent',
            'parent@example.com',
            '+919876543210',
            'MOTHER',
            'NEW',
            'WEBSITE',
        ];
        const csv = [headers.join(','), sample.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'enquiry_bulk_import_template.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const parseFile = (file: File) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setParseError('Only .csv files are supported');
            setValidRows([]);
            setSkippedRowsCount(0);
            return;
        }

        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            transform: (v) => (typeof v === 'string' ? v.trim() : v),
            complete: (result) => {
                const incomingHeaders = result.meta.fields || [];
                const mappedColumns = new Map<string, keyof ParsedCsvRow>();

                for (const header of incomingHeaders) {
                    const mapped = HEADER_ALIASES[toAliasKey(header)] || null;
                    if (mapped) {
                        mappedColumns.set(header, mapped);
                    }
                }

                const missingRequired = REQUIRED_CANONICAL_FIELDS.filter(
                    (field) => !Array.from(mappedColumns.values()).includes(field)
                );

                if (missingRequired.length > 0) {
                    const missing = missingRequired
                        .map((field) => REQUIRED_COLUMN_LABELS[REQUIRED_CANONICAL_FIELDS.indexOf(field)])
                        .join(', ');
                    setParseError(`Missing required column(s): ${missing}`);
                    setValidRows([]);
                    setSkippedRowsCount(0);
                    return;
                }

                const parsedRows: ParsedCsvRow[] = [];
                let skipped = 0;

                for (const rawRow of result.data) {
                    const canonicalRow: Partial<Record<keyof ParsedCsvRow, string>> = {};
                    for (const [sourceHeader, canonicalHeader] of mappedColumns.entries()) {
                        canonicalRow[canonicalHeader] = rawRow[sourceHeader];
                    }

                    const studentName = canonicalRow.student_name?.trim() || '';
                    const parentName = canonicalRow.parent_name?.trim() || '';
                    const parentEmail = canonicalRow.parent_email?.trim() || '';
                    const parentMobile = canonicalRow.parent_mobile?.trim() || '';
                    const gender = normalizeGender(canonicalRow.gender);
                    const dobIso = normalizeDobToISO(canonicalRow.date_of_birth);
                    const parentRelationWithChild = parseOptionalParentRelationWithChild(
                        canonicalRow.parent_relation_with_child
                    );

                    if (
                        !studentName ||
                        !parentName ||
                        !parentEmail ||
                        !parentMobile ||
                        !isValidEmail(parentEmail) ||
                        !isValidMobile(parentMobile) ||
                        !gender ||
                        !dobIso ||
                        !parentRelationWithChild
                    ) {
                        skipped += 1;
                        continue;
                    }

                    parsedRows.push({
                        student_name: studentName,
                        parent_name: parentName,
                        parent_email: parentEmail,
                        parent_mobile: parentMobile,
                        parent_relation_with_child: parentRelationWithChild,
                        gender,
                        date_of_birth: dobIso,
                        status: parseOptionalEnquiryStatus(canonicalRow.status),
                        source_type: parseOptionalSourceType(canonicalRow.source_type),
                    });
                }

                setParseError(null);
                setValidRows(parsedRows);
                setSkippedRowsCount(skipped);
            },
            error: (error) => {
                setParseError(error.message || 'Failed to parse CSV');
                setValidRows([]);
                setSkippedRowsCount(0);
            },
        });
    };

    const submitMutation = useMutation({
        mutationFn: (payload: BulkSubmitEnquiryRequest) => submitEnquiryBulkWithLead(payload),
        onSuccess: (response: BulkSubmitEnquiryResponse) => {
            let successCount = 0;
            let failedCount = 0;

            if (response.summary && typeof response.summary === 'object') {
                successCount = Number(response.summary.successful || 0);
                failedCount = Number(response.summary.failed || 0);
            } else if (Array.isArray(response.results)) {
                successCount = response.results.filter(parseBooleanSuccess).length;
                failedCount = response.results.length - successCount;
            } else {
                successCount = validRows.length;
                failedCount = 0;
            }

            toast.success(`Imported ${successCount} enquiry response(s) (${failedCount} failed)`);
            onSuccess?.();
            closeDialog(false);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to import enquiries');
        },
    });

    const handleConfirmSubmit = () => {
        if (validRows.length === 0) return;
        const rows: BulkSubmitEnquiryRow[] = validRows.map((row) => ({
            audience_id: audienceId,
            ...(row.source_type ? { source_type: row.source_type } : {}),
            ...(selectedPackageSessionId
                ? { destination_package_session_id: selectedPackageSessionId }
                : {}),
            parent_name: row.parent_name,
            parent_email: row.parent_email,
            parent_mobile: row.parent_mobile,
            parent_user_dto: {
                full_name: row.parent_name,
                email: row.parent_email,
                mobile_number: row.parent_mobile,
                is_parent: true,
                root_user: true,
            },
            child_user_dto: {
                full_name: row.student_name,
                date_of_birth: row.date_of_birth,
                gender: row.gender,
                is_parent: false,
                root_user: false,
            },
            enquiry: {
                enquiry_status: row.status || 'NEW',
                parent_relation_with_child: row.parent_relation_with_child,
            },
        }));

        submitMutation.mutate({
            audience_id: audienceId,
            rows,
        });
    };

    return (
        <Dialog open={open} onOpenChange={closeDialog}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle>Bulk Import Enquiry Responses</DialogTitle>
                    <DialogDescription>
                        Upload CSV, optionally choose class, preview and confirm import
                    </DialogDescription>
                </DialogHeader>

                <div className="mb-2 flex items-center gap-2 text-xs">
                    {[1, 2, 4].map((s) => (
                        <div
                            key={s}
                            className={`rounded-full px-3 py-1 ${step === s ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'}`}
                        >
                            Step {s}
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div className="text-sm text-neutral-600">
                                Download CSV template and upload filled learner responses
                            </div>
                            <MyButton buttonType="secondary" onClick={handleDownloadTemplate}>
                                Download Template
                            </MyButton>
                        </div>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer rounded-md border-2 border-dashed border-neutral-300 p-8 text-center hover:border-primary-300"
                        >
                            <p className="text-sm">Click to upload `.csv` file</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) parseFile(file);
                                }}
                            />
                        </div>
                        {parseError && (
                            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                {parseError}
                            </div>
                        )}
                        {!parseError && validRows.length > 0 && (
                            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                Valid rows: {validRows.length} | Skipped rows: {skippedRowsCount}
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <p className="text-sm text-neutral-600">
                            Select class (optional). If not selected, class is not sent in payload.
                        </p>
                        <select
                            value={selectedPackageSessionId}
                            onChange={(e) => setSelectedPackageSessionId(e.target.value)}
                            className="w-full rounded-md border p-2 text-sm"
                        >
                            <option value="">No class selected</option>
                            {classOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-4">
                        <div className="text-sm text-neutral-600">
                            Previewing {validRows.length} valid row(s)
                        </div>
                        <div className="max-h-80 overflow-x-auto overflow-y-auto rounded-md border">
                            <table className="w-full min-w-[920px] text-left text-sm">
                                <thead className="bg-neutral-50">
                                    <tr>
                                        <th className="px-3 py-2">Student Name</th>
                                        <th className="px-3 py-2">Gender</th>
                                        <th className="px-3 py-2">Date of Birth</th>
                                        <th className="px-3 py-2">Parent Name</th>
                                        <th className="px-3 py-2">Parent Email</th>
                                        <th className="px-3 py-2">Parent Mobile</th>
                                        <th className="px-3 py-2">Relation</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {validRows.map((row, index) => (
                                        <tr key={`${row.parent_email}-${index}`} className="border-t">
                                            <td className="px-3 py-2">{row.student_name}</td>
                                            <td className="px-3 py-2">{row.gender}</td>
                                            <td className="px-3 py-2">{row.date_of_birth}</td>
                                            <td className="px-3 py-2">{row.parent_name}</td>
                                            <td className="px-3 py-2">{row.parent_email}</td>
                                            <td className="px-3 py-2">{row.parent_mobile}</td>
                                            <td className="px-3 py-2">
                                                {row.parent_relation_with_child}
                                            </td>
                                            <td className="px-3 py-2">{row.status}</td>
                                            <td className="px-3 py-2">{row.source_type || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                    <MyButton
                        buttonType="secondary"
                        disabled={step === 1 || submitMutation.isPending}
                        onClick={() => setStep(step === 4 ? 2 : 1)}
                    >
                        Back
                    </MyButton>
                    <div className="flex items-center gap-2">
                        <MyButton
                            buttonType="secondary"
                            disabled={submitMutation.isPending}
                            onClick={() => closeDialog(false)}
                        >
                            Cancel
                        </MyButton>
                        {step < 4 ? (
                            <MyButton
                                disabled={
                                    submitMutation.isPending ||
                                    (step === 1 && (!!parseError || validRows.length === 0))
                                }
                                onClick={() => setStep(step === 1 ? 2 : 4)}
                            >
                                Next
                            </MyButton>
                        ) : (
                            <MyButton
                                disabled={submitMutation.isPending || validRows.length === 0}
                                onClick={handleConfirmSubmit}
                            >
                                {submitMutation.isPending ? 'Importing...' : 'Confirm Import'}
                            </MyButton>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
