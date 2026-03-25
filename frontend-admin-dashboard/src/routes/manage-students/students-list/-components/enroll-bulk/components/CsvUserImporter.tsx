import { useRef, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { UploadSimple, DownloadSimple } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { NewUserRow, CustomFieldValue } from '../../../-types/bulk-assign-types';
import {
    getCustomFieldSettingsFromCache,
    CustomField,
} from '@/services/custom-field-settings';

// ─── System field definitions ───────────────────────────────────
// These map 1-to-1 with the backend NewUserDTO snake_case field names.
// Order follows the manual enrollment form's systemFieldKeyMapping.

interface CsvColumnDef {
    /** CSV header / NewUserRow key */
    csvKey: string;
    /** Label shown in template */
    label: string;
    /** Is the column mandatory? */
    required: boolean;
    /** Sample value for the template row */
    sample: string;
    /** System field key from cache (UPPER) — used to filter by visibility */
    systemKey?: string;
}

// Always-present core columns (not controlled by visibility)
const CORE_COLUMNS: CsvColumnDef[] = [
    { csvKey: 'email', label: 'Email', required: true, sample: 'student@example.com' },
    { csvKey: 'full_name', label: 'Full Name', required: true, sample: 'John Doe' },
    { csvKey: 'mobile_number', label: 'Mobile Number', required: false, sample: '+91 9876543210', systemKey: 'MOBILE_NUMBER' },
    { csvKey: 'username', label: 'Username', required: false, sample: '' },
    { csvKey: 'password', label: 'Password', required: false, sample: '' },
];

// Optional system columns — included ONLY if visible in the institute's custom field settings
const OPTIONAL_SYSTEM_COLUMNS: CsvColumnDef[] = [
    { csvKey: 'gender', label: 'Gender', required: false, sample: 'MALE', systemKey: 'GENDER' },
    { csvKey: 'date_of_birth', label: 'Date of Birth', required: false, sample: '2000-01-15', systemKey: 'DATE_OF_BIRTH' },
    { csvKey: 'address_line', label: 'Address', required: false, sample: '', systemKey: 'ADDRESS_LINE' },
    { csvKey: 'city', label: 'City', required: false, sample: '', systemKey: 'CITY' },
    { csvKey: 'region', label: 'State/Region', required: false, sample: '', systemKey: 'REGION' },
    { csvKey: 'pin_code', label: 'PIN Code', required: false, sample: '', systemKey: 'PIN_CODE' },
    { csvKey: 'linked_institute_name', label: 'College/School', required: false, sample: '', systemKey: 'LINKED_INSTITUTE_NAME' },
    { csvKey: 'fathers_name', label: "Father's Name", required: false, sample: '', systemKey: 'FATHER_NAME' },
    { csvKey: 'mothers_name', label: "Mother's Name", required: false, sample: '', systemKey: 'MOTHER_NAME' },
    { csvKey: 'parents_mobile_number', label: "Father's Mobile", required: false, sample: '', systemKey: 'PARENTS_MOBILE_NUMBER' },
    { csvKey: 'parents_email', label: "Father's Email", required: false, sample: '', systemKey: 'PARENTS_EMAIL' },
    { csvKey: 'parents_to_mother_mobile_number', label: "Mother's Mobile", required: false, sample: '', systemKey: 'PARENTS_TO_MOTHER_MOBILE_NUMBER' },
    { csvKey: 'parents_to_mother_email', label: "Mother's Email", required: false, sample: '', systemKey: 'PARENTS_TO_MOTHER_EMAIL' },
];

interface Props {
    onImport: (rows: NewUserRow[]) => void;
}

export const CsvUserImporter = ({ onImport }: Props) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<NewUserRow[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // ─── Build dynamic column list from institute settings ────
    const { allColumns, customFieldColumns } = useMemo(() => {
        const settings = getCustomFieldSettingsFromCache();

        // Determine which system fields are visible
        const visibleSystemKeys = new Set<string>();
        if (settings?.systemFields) {
            for (const sf of settings.systemFields) {
                if (sf.visibility) visibleSystemKeys.add(sf.key);
            }
        }

        // Core columns are always included
        const cols: CsvColumnDef[] = [...CORE_COLUMNS];

        // Add optional system columns if they're visible (or if no settings exist, include all)
        for (const col of OPTIONAL_SYSTEM_COLUMNS) {
            if (!settings?.systemFields || !col.systemKey || visibleSystemKeys.has(col.systemKey)) {
                cols.push(col);
            }
        }

        // Add custom fields visible in learner enrollment
        const cfCols: { csvKey: string; customFieldId: string; label: string; required: boolean }[] = [];
        if (settings?.customFields) {
            const enrollmentFields = settings.customFields.filter(
                (cf: CustomField) => cf.visibility?.learnerEnrollment === true
            );
            for (const cf of enrollmentFields) {
                const safeKey = `cf_${cf.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
                cfCols.push({
                    csvKey: safeKey,
                    customFieldId: cf.id,
                    label: cf.name,
                    required: cf.required,
                });
                cols.push({
                    csvKey: safeKey,
                    label: cf.name,
                    required: cf.required,
                    sample: '',
                });
            }
        }

        return { allColumns: cols, customFieldColumns: cfCols };
    }, []);

    const REQUIRED_HEADERS = allColumns.filter((c) => c.required).map((c) => c.csvKey);

    // ─── Download template ────
    const handleDownloadTemplate = () => {
        const headers = allColumns.map((c) => c.csvKey);
        const sampleRow = allColumns.map((c) => c.sample);
        const csv = [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bulk_enroll_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Parse CSV ────
    const parseFile = (file: File) => {
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                const errs: string[] = [];
                const rows: NewUserRow[] = [];

                // Check required headers
                const headers = result.meta.fields || [];
                REQUIRED_HEADERS.forEach((h) => {
                    if (!headers.includes(h)) errs.push(`Missing required column: "${h}"`);
                });

                if (errs.length > 0) {
                    setErrors(errs);
                    setPreview([]);
                    return;
                }

                // Build a map of csvKey → customFieldId for custom field columns
                const cfMap = new Map(customFieldColumns.map((c) => [c.csvKey, c.customFieldId]));

                result.data.forEach((row, i) => {
                    const rowNum = i + 2;
                    if (!row.email?.trim()) {
                        errs.push(`Row ${rowNum}: email is required`);
                        return;
                    }
                    if (!row.full_name?.trim()) {
                        errs.push(`Row ${rowNum}: full_name is required`);
                        return;
                    }

                    // Build custom field values from CSV columns
                    const customFieldValues: CustomFieldValue[] = [];
                    for (const [csvKey, cfId] of cfMap.entries()) {
                        const val = row[csvKey]?.trim();
                        if (val) {
                            customFieldValues.push({ custom_field_id: cfId, value: val });
                        }
                    }

                    rows.push({
                        email: row.email.trim(),
                        full_name: row.full_name.trim(),
                        mobile_number: row.mobile_number?.trim() || undefined,
                        username: row.username?.trim() || undefined,
                        password: row.password?.trim() || undefined,
                        gender: row.gender?.trim() || undefined,
                        date_of_birth: row.date_of_birth?.trim() || undefined,
                        address_line: row.address_line?.trim() || undefined,
                        city: row.city?.trim() || undefined,
                        region: row.region?.trim() || undefined,
                        pin_code: row.pin_code?.trim() || undefined,
                        fathers_name: row.fathers_name?.trim() || undefined,
                        mothers_name: row.mothers_name?.trim() || undefined,
                        parents_mobile_number: row.parents_mobile_number?.trim() || undefined,
                        parents_email: row.parents_email?.trim() || undefined,
                        parents_to_mother_mobile_number:
                            row.parents_to_mother_mobile_number?.trim() || undefined,
                        parents_to_mother_email: row.parents_to_mother_email?.trim() || undefined,
                        linked_institute_name: row.linked_institute_name?.trim() || undefined,
                        custom_field_values: customFieldValues.length > 0 ? customFieldValues : undefined,
                    });
                });

                setErrors(errs);
                setPreview(rows);
            },
        });
    };

    const handleFile = (file: File | undefined) => {
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            setErrors(['Please upload a .csv file']);
            return;
        }
        parseFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const handleConfirm = () => {
        if (preview.length === 0) return;
        onImport(preview);
        setPreview([]);
        setErrors([]);
    };

    // Count how many extra columns (beyond email/full_name) are in the template
    const extraColCount = allColumns.length - 2;

    return (
        <div className="flex flex-col gap-4">
            {/* Template download */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-neutral-700">Download Template</p>
                    <p className="text-xs text-neutral-400">
                        Fill in the template and re-upload. Required columns:{' '}
                        <code className="text-primary-600">email, full_name</code>
                        {extraColCount > 0 && (
                            <span>
                                {' '}
                                + {extraColCount} optional
                                {customFieldColumns.length > 0 && (
                                    <span className="text-primary-500">
                                        {' '}
                                        (incl. {customFieldColumns.length} custom field
                                        {customFieldColumns.length !== 1 ? 's' : ''})
                                    </span>
                                )}
                            </span>
                        )}
                    </p>
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="default"
                    onClick={handleDownloadTemplate}
                >
                    <DownloadSimple size={14} className="mr-1" />
                    Template
                </MyButton>
            </div>

            {/* Drop zone */}
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-10 transition-colors ${isDragging ? 'border-primary-400 bg-primary-50' : 'border-neutral-300 bg-white hover:border-primary-300 hover:bg-primary-50/50'}`}
            >
                <UploadSimple size={28} className="text-neutral-400" />
                <p className="text-sm font-medium text-neutral-600">
                    Drag & drop a CSV file here
                </p>
                <p className="text-xs text-neutral-400">or click to browse</p>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                />
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
                    {errors.map((e, i) => (
                        <p key={i} className="text-xs text-danger-600">
                            ❌ {e}
                        </p>
                    ))}
                </div>
            )}

            {/* Preview */}
            {preview.length > 0 && errors.length === 0 && (
                <div className="rounded-lg border border-success-200 bg-success-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-success-700">
                            ✅ {preview.length} valid row{preview.length !== 1 ? 's' : ''} detected
                        </p>
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            layoutVariant="default"
                            onClick={handleConfirm}
                        >
                            Add {preview.length} learner{preview.length !== 1 ? 's' : ''}
                        </MyButton>
                    </div>
                    <div className="max-h-36 overflow-y-auto">
                        {preview.slice(0, 5).map((r, i) => (
                            <p key={i} className="text-xs text-success-600">
                                {r.full_name} — {r.email}
                                {r.custom_field_values && r.custom_field_values.length > 0 && (
                                    <span className="text-success-400">
                                        {' '}
                                        ({r.custom_field_values.length} custom field
                                        {r.custom_field_values.length !== 1 ? 's' : ''})
                                    </span>
                                )}
                            </p>
                        ))}
                        {preview.length > 5 && (
                            <p className="text-xs text-success-400">
                                …and {preview.length - 5} more
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
