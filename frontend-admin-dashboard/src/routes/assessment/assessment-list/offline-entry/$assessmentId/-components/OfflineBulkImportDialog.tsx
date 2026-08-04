import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
    CheckCircle,
    Download,
    FileZip,
    UploadSimple,
    WarningCircle,
    XCircle,
} from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { Form } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/use-file-upload';
import { ensureFileHasExtension } from '@/lib/file-download';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    openZipFile,
    type ZipHandle,
} from '@/components/common/study-library/bulk-content-uploading/zip-parser';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { StudentRow } from './StudentSelector';
import {
    bulkImportOfflineEntries,
    fetchBatchLearners,
} from '../-services/offline-entry-services';
import {
    OfflineBulkImportEntry,
    OfflineBulkImportResult,
} from '../-utils/types';
import {
    buildErrorCsv,
    buildManifestCsv,
    buildSampleZip,
    downloadTextFile,
    findManifestPath,
    MANIFEST_COLUMNS,
    parseManifest,
    type ManifestRow,
    type ParsedManifest,
} from '../-utils/bulk-manifest';

type Step = 'PICK' | 'PREVIEW' | 'DONE';

interface RowFailure {
    line: number;
    username: string;
    errors: string[];
}

// A preview of 500 scanned sheets doesn't need 500 rendered rows; problem rows
// are always shown in full since those are the ones that need reading.
const MAX_PREVIEW_ROWS = 100;

const readableError = (error: unknown, fallback: string): string => {
    // Backend rejections carry the admin-facing text in `ex` (ErrorInfo shape).
    const backendMessage = (error as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
    if (backendMessage) return backendMessage;
    if ((error as { message?: string })?.message === 'Network Error') {
        return 'Could not reach the server. Check your connection and try again.';
    }
    return error instanceof Error && error.message ? error.message : fallback;
};

interface OfflineBulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assessmentId: string;
    instituteId: string;
    /** The assessment's batches — the source of the username match set. */
    packageSessionIds: string[];
    /** Lets the caller refresh the student list once marks land. */
    onImported?: () => void;
}

interface ZipForm {
    zip: FileList | null;
}

export const OfflineBulkImportDialog = ({
    open,
    onOpenChange,
    assessmentId,
    instituteId,
    packageSessionIds,
    onImported,
}: OfflineBulkImportDialogProps) => {
    // Bulk import matches on username, which only the batch-learner listing
    // carries — individually registered participants have no username to match
    // against, so they stay on the one-student-at-a-time flow. Fetched here
    // (unpaginated) rather than taken from the picker, which only holds a page.
    const {
        data: matchableStudents = [],
        isLoading: isLoadingStudents,
        error: studentsError,
    } = useQuery({
        queryKey: ['OFFLINE_BULK_MATCH_STUDENTS', instituteId, packageSessionIds.join(',')],
        queryFn: async (): Promise<StudentRow[]> => {
            if (packageSessionIds.length === 0) return [];
            const data = await fetchBatchLearners(instituteId, packageSessionIds, 0, 5000);
            return (data?.content ?? []).map((learner) => ({
                id: learner.user_id,
                name: learner.full_name,
                email: learner.email,
                username: learner.username,
                mobileNumber: learner.phone_number,
                batchName: '',
                batchId: learner.package_session_id,
                status: 'Registered',
                score: null,
                registrationId: null,
                userId: learner.user_id,
                source: 'batch' as const,
            }));
        },
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });
    const students = matchableStudents;

    const [step, setStep] = useState<Step>('PICK');
    const [zipHandle, setZipHandle] = useState<ZipHandle | null>(null);
    const [zipName, setZipName] = useState('');
    const [manifest, setManifest] = useState<ParsedManifest | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [results, setResults] = useState<OfflineBulkImportResult[]>([]);
    // Errors that must survive on screen — a toast is the wrong home for
    // something the admin has to read and act on.
    const [zipError, setZipError] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    // Rows whose files couldn't be uploaded. Collected instead of thrown so one
    // unreadable scan doesn't strand the other 199 rows' uploads in storage.
    const [uploadFailures, setUploadFailures] = useState<RowFailure[]>([]);
    // Entries whose files ARE already uploaded, kept when the bulk request
    // itself fails so "Retry" re-sends them instead of re-uploading everything.
    const [pendingEntries, setPendingEntries] = useState<OfflineBulkImportEntry[] | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const form = useForm<ZipForm>({ defaultValues: { zip: null } });
    const { uploadFile } = useFileUpload();
    const adminUserId = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken))?.user ?? '';

    const reset = async () => {
        await zipHandle?.close().catch(() => undefined);
        setZipHandle(null);
        setZipName('');
        setManifest(null);
        setResults([]);
        setProgress({ done: 0, total: 0 });
        setZipError(null);
        setImportError(null);
        setUploadFailures([]);
        setPendingEntries(null);
        setStep('PICK');
        form.reset();
    };

    const handleChooseAnotherFile = () => {
        void reset();
    };

    const handleOpenChange = (next: boolean) => {
        if (isBusy) return; // never tear down mid-upload
        onOpenChange(next);
        if (!next) void reset();
    };

    // Both downloads report failure on screen, not just as a toast: a template
    // that silently never downloads looks identical to a browser that blocked it.
    const handleDownloadCsv = () => {
        setZipError(null);
        try {
            downloadTextFile(buildManifestCsv(students), 'manifest.csv', 'text/csv;charset=utf-8;');
        } catch (error) {
            console.error('Failed to build the CSV template:', error);
            setZipError(readableError(error, 'Could not build the CSV template.'));
        }
    };

    const handleDownloadSampleZip = async () => {
        setZipError(null);
        try {
            const blob = await buildSampleZip(students);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'offline-entry-sample.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to build the sample zip:', error);
            setZipError(readableError(error, 'Could not build the sample zip.'));
        }
    };

    const handleZipSelected = async (file: File) => {
        setIsBusy(true);
        setZipError(null);
        try {
            const looksLikeZip =
                file.name.toLowerCase().endsWith('.zip') ||
                file.type === 'application/zip' ||
                file.type === 'application/x-zip-compressed';
            if (!looksLikeZip) {
                throw new Error(
                    `"${file.name}" is not a .zip file. Put manifest.csv and your PDFs into a zip archive and upload that.`
                );
            }
            if (file.size === 0) {
                throw new Error(`"${file.name}" is empty (0 bytes). Re-create the zip and try again.`);
            }

            // Refuse to match against an empty/failed student list — otherwise every
            // row reports "no student with this username" and an outage looks
            // exactly like a file full of bad roll numbers.
            if (studentsError) {
                throw new Error(
                    'The student list could not be loaded, so usernames cannot be matched. Close and reopen this dialog to retry.'
                );
            }
            if (students.length === 0) {
                throw new Error(
                    'This assessment has no batch learners to match against. Bulk import matches students by username from the assessment’s batches.'
                );
            }

            await zipHandle?.close().catch(() => undefined);
            const handle = await openZipFile(file);

            const manifestPath = findManifestPath(handle);
            if (!manifestPath) {
                await handle.close().catch(() => undefined);
                throw new Error(
                    'No manifest.csv found in this zip. Download the sample zip above to see the expected layout.'
                );
            }

            const csvText = await handle.readText(manifestPath);
            if (!csvText.trim()) {
                await handle.close().catch(() => undefined);
                throw new Error(`${manifestPath} is empty. Fill in at least one row and re-zip.`);
            }

            const parsed = parseManifest(csvText, handle, students);
            if (parsed.rows.length === 0 && parsed.fatalErrors.length === 0) {
                await handle.close().catch(() => undefined);
                throw new Error(
                    `${manifestPath} has a header but no data rows. Add a row per student and re-zip.`
                );
            }

            setZipHandle(handle);
            setZipName(file.name);
            setManifest(parsed);
            setStep('PREVIEW');
        } catch (error) {
            console.error('Failed to read the zip:', error);
            setZipError(readableError(error, 'Could not read this zip file.'));
        } finally {
            setIsBusy(false);
        }
    };

    // Uploads every referenced PDF, then sends one bulk request. Files upload
    // row by row so a huge batch never holds more than one PDF in memory.
    const handleImport = async () => {
        if (!zipHandle || !manifest || manifest.validRows.length === 0) return;

        const fileCount = manifest.validRows.reduce(
            (total, row) =>
                total +
                [row.studentPath, row.checkedPath, row.reportPath].filter(Boolean).length,
            0
        );
        setIsBusy(true);
        setImportError(null);

        try {
            let entries = pendingEntries;
            let failures: RowFailure[] = uploadFailures;

            // Skip straight to the send on a retry — the files are already in
            // storage, so re-uploading them would only create duplicates.
            if (entries) {
                // Nothing is uploading this time round; a stale full bar would
                // read as "uploading" while the request is in flight.
                setProgress({ done: 0, total: 0 });
            } else {
                setProgress({ done: 0, total: fileCount });
                failures = [];
                const built: OfflineBulkImportEntry[] = [];
                let uploaded = 0;

                for (const row of manifest.validRows) {
                    const uploadSlot = async (path: string | null) => {
                        if (!path) return undefined;
                        const name = path.split('/').pop() ?? path;
                        const extracted = await zipHandle.extractFile(path, name);
                        const fileId = await uploadFile({
                            file: ensureFileHasExtension(extracted),
                            // The dialog owns the progress bar; letting the uploader
                            // drive the busy flag would clear it after the first file.
                            setIsUploading: () => {},
                            userId: adminUserId,
                            source: instituteId,
                            sourceId: 'ASSESSMENT_OFFLINE_ENTRY',
                        });
                        if (!fileId) throw new Error(`upload of "${name}" returned no file id`);
                        uploaded += 1;
                        setProgress({ done: uploaded, total: fileCount });
                        return fileId as string;
                    };

                    const student = row.student as StudentRow;
                    try {
                        built.push({
                            row_label: `Line ${row.line}`,
                            ...(student.registrationId
                                ? { registration_id: student.registrationId }
                                : {
                                      user_id: student.userId,
                                      full_name: student.name,
                                      email: student.email,
                                      username: student.username,
                                      mobile_number: student.mobileNumber,
                                      batch_id: student.batchId,
                                  }),
                            username: student.username,
                            ...(row.totalMarks !== null ? { total_marks: row.totalMarks } : {}),
                            student_file_id: await uploadSlot(row.studentPath),
                            checked_file_id: await uploadSlot(row.checkedPath),
                            report_file_id: await uploadSlot(row.reportPath),
                        });
                    } catch (rowError) {
                        // Drop just this student. Aborting here would leave every
                        // already-uploaded PDF orphaned in storage with nothing
                        // imported — the admin would have to redo the entire batch.
                        console.error(`Row ${row.line} failed to upload:`, rowError);
                        failures.push({
                            line: row.line,
                            username: row.username,
                            errors: [readableError(rowError, 'file upload failed')],
                        });
                    }
                }

                entries = built;
                setUploadFailures(failures);
                // Bank the uploaded file ids BEFORE the send, so a failed request
                // can be retried without re-uploading (and re-duplicating) files.
                setPendingEntries(built);
            }

            if (entries.length === 0) {
                setImportError(
                    'None of the rows could be uploaded, so nothing was imported. See the problems below.'
                );
                return;
            }

            const response = await bulkImportOfflineEntries(assessmentId, instituteId, { entries });

            // Uploads succeeded and the server accepted them — clear the retry
            // buffer so closing and reopening starts genuinely fresh.
            setPendingEntries(null);
            setResults(response?.results ?? []);
            setStep('DONE');

            const failed = (response?.failure_count ?? 0) + failures.length;
            if (failed > 0) {
                toast.warning(
                    `Imported ${response?.success_count ?? 0} of ${manifest.validRows.length} students — ${failed} failed.`
                );
            } else {
                toast.success(`Imported ${response?.success_count ?? 0} students.`);
            }
            onImported?.();
        } catch (error) {
            console.error('Bulk import failed:', error);
            setImportError(readableError(error, 'Bulk import failed. Please try again.'));
        } finally {
            setIsBusy(false);
        }
    };

    // Every way a row can fail ends up in one file the admin can fix and
    // re-upload: rejected by validation, failed to upload, or rejected by the
    // server. Splitting these across three places would guarantee one gets missed.
    const allFailures = (): RowFailure[] => {
        const invalid = (manifest?.rows ?? [])
            .filter((row) => row.errors.length > 0)
            .map((row) => ({ line: row.line, username: row.username, errors: row.errors }));
        const rejected = results
            .filter((result) => result.status === 'FAILED')
            .map((result) => ({
                line: Number(result.row_label?.replace(/\D/g, '') || 0),
                username: result.username ?? '',
                errors: [result.message ?? 'Import failed'],
            }));
        return [...invalid, ...uploadFailures, ...rejected].sort((a, b) => a.line - b.line);
    };

    const failureCount = allFailures().length;

    // How many PDFs the import will actually upload. Zero here with files sitting
    // in the zip is the failure mode that shipped: marks imported, scans dropped.
    const attachedCount = (manifest?.validRows ?? []).reduce(
        (total, row) =>
            total + [row.studentPath, row.checkedPath, row.reportPath].filter(Boolean).length,
        0
    );

    const handleDownloadErrors = () => {
        const failures = allFailures();
        if (failures.length === 0) {
            toast.info('There are no problems to download.');
            return;
        }
        try {
            downloadTextFile(
                buildErrorCsv(failures),
                'bulk-import-problems.csv',
                'text/csv;charset=utf-8;'
            );
        } catch (error) {
            console.error('Failed to build the problems CSV:', error);
            setImportError(readableError(error, 'Could not build the problems CSV.'));
        }
    };

    const validCount = manifest?.validRows.length ?? 0;

    return (
        <MyDialog
            open={open}
            onOpenChange={handleOpenChange}
            heading="Bulk Offline Data Entry"
            dialogWidth="max-w-4xl"
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        type="button"
                        disable={isBusy}
                        onClick={() => handleOpenChange(false)}
                    >
                        {step === 'DONE' ? 'Close' : 'Cancel'}
                    </MyButton>
                    {step === 'PREVIEW' && (
                        <>
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                type="button"
                                disable={isBusy}
                                onClick={handleChooseAnotherFile}
                            >
                                Choose another file
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                type="button"
                                disable={isBusy || validCount === 0}
                                onAsyncClick={handleImport}
                                loadingText={pendingEntries ? 'Retrying...' : 'Importing...'}
                            >
                                {pendingEntries
                                    ? 'Retry import'
                                    : `Import ${validCount} ${validCount === 1 ? 'student' : 'students'}`}
                            </MyButton>
                        </>
                    )}
                </>
            }
        >
            <div className="flex max-h-screen flex-col gap-4 overflow-y-auto">
                {step === 'PICK' && (
                    <>
                        {studentsError != null && (
                            <ErrorNotice
                                title="Could not load the student list"
                                detail="Usernames can't be matched until it loads. Close and reopen this dialog to retry."
                            />
                        )}
                        {studentsError == null && !isLoadingStudents && students.length === 0 && (
                            <ErrorNotice
                                title="No batch learners in this assessment"
                                detail="Bulk import matches students by username from the assessment's batches. Add batches to the assessment, or enter these students one at a time."
                            />
                        )}
                        {zipError && <ErrorNotice title="That zip couldn't be used" detail={zipError} />}

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <p className="text-body font-medium text-neutral-700">
                                1. Start from a template
                            </p>
                            <p className="mb-3 text-caption text-neutral-500">
                                {isLoadingStudents
                                    ? 'Loading the student list…'
                                    : `Both downloads come pre-filled with the ${students.length} students in this assessment's batches, so you only fill in marks and file names.`}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    type="button"
                                    disable={isLoadingStudents}
                                    onClick={handleDownloadCsv}
                                >
                                    <Download className="size-4" /> Download CSV
                                </MyButton>
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    type="button"
                                    disable={isLoadingStudents}
                                    onAsyncClick={handleDownloadSampleZip}
                                    loadingText="Building..."
                                >
                                    <FileZip className="size-4" /> Download sample zip
                                </MyButton>
                            </div>
                        </div>

                        <div className="rounded-lg border border-neutral-200 p-4">
                            <p className="text-body font-medium text-neutral-700">
                                2. Upload the filled zip
                            </p>
                            <p className="mb-3 text-caption text-neutral-500">
                                The zip must contain <span className="font-medium">manifest.csv</span>{' '}
                                plus your scanned PDFs. PDFs in{' '}
                                <span className="font-medium">answers/</span>,{' '}
                                <span className="font-medium">checked/</span> or{' '}
                                <span className="font-medium">reports/</span> named after a
                                username are picked up automatically. No column is required — a
                                file named after the student identifies them on its own. Nothing is
                                saved until you review the preview.
                            </p>
                            <Form {...form}>
                                <FileUploadComponent
                                    fileInputRef={fileInputRef}
                                    onFileSubmit={(file) => void handleZipSelected(file)}
                                    control={form.control}
                                    name="zip"
                                    // Deliberately no `acceptedFileTypes` — the
                                    // dropzone discards a non-matching file without
                                    // telling anyone, so dragging in a PDF or a .rar
                                    // did nothing at all. handleZipSelected checks
                                    // it and says what was wrong.
                                    isUploading={isBusy}
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 p-8 text-center hover:border-primary-300">
                                        <UploadSimple className="size-8 text-neutral-400" />
                                        <p className="text-body font-medium text-neutral-700">
                                            {isBusy ? 'Reading zip...' : 'Click to upload or drag & drop'}
                                        </p>
                                        <p className="text-caption text-neutral-400">.zip only</p>
                                    </div>
                                </FileUploadComponent>
                            </Form>
                        </div>
                    </>
                )}

                {step === 'PREVIEW' && manifest && (
                    <>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-caption text-neutral-500">{zipName}</span>
                            <span className="flex items-center gap-1 text-caption text-success-600">
                                <CheckCircle className="size-4" /> {validCount} ready
                            </span>
                            <span className="text-caption text-neutral-500">
                                {attachedCount} PDF{attachedCount === 1 ? '' : 's'} to upload
                            </span>
                            {failureCount > 0 && (
                                <>
                                    <span className="flex items-center gap-1 text-caption text-danger-600">
                                        <XCircle className="size-4" /> {failureCount} with problems
                                    </span>
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        type="button"
                                        onClick={handleDownloadErrors}
                                    >
                                        Download problems CSV
                                    </MyButton>
                                </>
                            )}
                        </div>

                        {manifest.fatalErrors.length > 0 && (
                            <ErrorNotice
                                title="This manifest can't be imported"
                                detail={manifest.fatalErrors.join(' ')}
                            />
                        )}

                        {importError && (
                            <ErrorNotice
                                title="Import failed"
                                detail={
                                    pendingEntries
                                        ? `${importError} Your files are already uploaded — "Retry import" re-sends them without uploading again.`
                                        : importError
                                }
                            />
                        )}

                        {uploadFailures.length > 0 && (
                            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
                                <p className="text-caption font-medium text-danger-700">
                                    {uploadFailures.length} row(s) were skipped because their files
                                    could not be uploaded
                                </p>
                                {uploadFailures.slice(0, 5).map((failure) => (
                                    <p key={failure.line} className="text-caption text-danger-600">
                                        Line {failure.line} ({failure.username}):{' '}
                                        {failure.errors.join('; ')}
                                    </p>
                                ))}
                                {uploadFailures.length > 5 && (
                                    <p className="text-caption text-danger-600">
                                        …and {uploadFailures.length - 5} more — see the problems CSV.
                                    </p>
                                )}
                            </div>
                        )}

                        {validCount === 0 && manifest.fatalErrors.length === 0 && (
                            <ErrorNotice
                                title="No rows are ready to import"
                                detail="Every row in manifest.csv has a problem. Fix the issues listed below (or download the problems CSV) and upload the zip again."
                            />
                        )}

                        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3">
                            <WarningCircle className="mt-0.5 size-4 shrink-0 text-warning-600" />
                            <div className="text-caption text-warning-700">
                                {manifest.validRows.some((row) => row.totalMarks !== null) && (
                                    <p>
                                        Rows with a total_marks value will have their result
                                        released to the student.
                                    </p>
                                )}
                                {/* Each import creates a fresh attempt (same as entering a
                                    student by hand), so a full re-upload double-enters
                                    everyone rather than correcting them. */}
                                <p>
                                    Importing adds a new attempt per student. To fix failures,
                                    re-upload only the affected rows — not the whole file.
                                </p>
                            </div>
                        </div>

                        {manifest.unrecognizedHeaders.length > 0 && (
                            <div className="rounded-lg border border-neutral-200 p-3">
                                <p className="text-caption font-medium text-neutral-700">
                                    Ignored column(s): {manifest.unrecognizedHeaders.join(', ')}
                                </p>
                                <p className="mt-1 text-caption text-neutral-400">
                                    Check for a typo if you expected these to be read. Known
                                    columns: {MANIFEST_COLUMNS.join(', ')}.
                                </p>
                            </div>
                        )}

                        {/* Loud, not grey: a zip full of scans that nothing points
                            at means the marks import but every PDF is dropped —
                            exactly the silent failure this warns about. */}
                        {manifest.unreferencedFiles.length > 0 && (
                            <div
                                className={cn(
                                    'rounded-lg border p-3',
                                    attachedCount === 0
                                        ? 'border-warning-200 bg-warning-50'
                                        : 'border-neutral-200'
                                )}
                            >
                                <p
                                    className={cn(
                                        'text-caption font-medium',
                                        attachedCount === 0
                                            ? 'text-warning-700'
                                            : 'text-neutral-700'
                                    )}
                                >
                                    {manifest.unreferencedFiles.length} file(s) in the zip will be
                                    ignored
                                    {attachedCount === 0 &&
                                        ' — no row has a file attached, so only marks would import'}
                                </p>
                                <p className="mt-1 text-caption text-neutral-500">
                                    Name them in manifest.csv, or put them in{' '}
                                    <span className="font-medium">answers/</span>,{' '}
                                    <span className="font-medium">checked/</span> or{' '}
                                    <span className="font-medium">reports/</span> named after the
                                    student&apos;s username.
                                </p>
                                <p className="mt-1 truncate text-caption text-neutral-400">
                                    {manifest.unreferencedFiles.slice(0, 5).join(', ')}
                                    {manifest.unreferencedFiles.length > 5 ? ', …' : ''}
                                </p>
                            </div>
                        )}

                        <PreviewTable rows={manifest.rows} />

                        {isBusy && progress.total > 0 && (
                            <div className="flex flex-col gap-1">
                                <Progress
                                    value={(progress.done / progress.total) * 100}
                                    className="h-2"
                                />
                                <p className="text-caption text-neutral-500">
                                    Uploading {progress.done} of {progress.total} files…
                                </p>
                            </div>
                        )}
                    </>
                )}

                {step === 'DONE' && (
                    <div className="flex flex-col gap-3">
                        {importError && (
                            <ErrorNotice title="Something went wrong" detail={importError} />
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1 text-body text-success-600">
                                <CheckCircle className="size-5" />
                                {results.filter((r) => r.status === 'SUCCESS').length} imported
                            </span>
                            {/* Counts rows the server rejected AND rows whose files
                                never uploaded — the latter never reach the server,
                                so results alone would under-report the damage. */}
                            {failureCount > 0 && (
                                <>
                                    <span className="flex items-center gap-1 text-body text-danger-600">
                                        <XCircle className="size-5" />
                                        {failureCount} not imported
                                    </span>
                                    <MyButton
                                        buttonType="text"
                                        scale="small"
                                        type="button"
                                        onClick={handleDownloadErrors}
                                    >
                                        Download problems CSV
                                    </MyButton>
                                </>
                            )}
                        </div>
                        {uploadFailures.map((failure) => (
                            <p
                                key={`upload-${failure.line}`}
                                className="text-caption text-danger-600"
                            >
                                Line {failure.line} ({failure.username}):{' '}
                                {failure.errors.join('; ')}
                            </p>
                        ))}
                        {results
                            .filter((r) => r.status === 'FAILED')
                            .map((result) => (
                                <p
                                    key={`${result.row_label}-${result.username}`}
                                    className="text-caption text-danger-600"
                                >
                                    {result.row_label} ({result.username}): {result.message}
                                </p>
                            ))}
                    </div>
                )}
            </div>
        </MyDialog>
    );
};

const SlotCell = ({ path, auto }: { path: string | null; auto: boolean }) => (
    <td className="p-2 text-neutral-500" title={path ?? undefined}>
        {path ? (
            <>
                ✓{auto && <span className="ms-1 text-neutral-400">auto</span>}
            </>
        ) : (
            '—'
        )}
    </td>
);

const ErrorNotice = ({ title, detail }: { title: string; detail: string }) => (
    <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3"
    >
        <WarningCircle className="mt-0.5 size-4 shrink-0 text-danger-600" />
        <div>
            <p className="text-caption font-medium text-danger-700">{title}</p>
            <p className="text-caption text-danger-600">{detail}</p>
        </div>
    </div>
);

const PreviewTable = ({ rows }: { rows: ManifestRow[] }) => {
    // Problem rows always render; clean rows are capped so a 500-sheet batch
    // doesn't lock the dialog up just to show 500 identical "Ready" lines.
    const problemRows = rows.filter((row) => row.errors.length > 0);
    const cleanRows = rows.filter((row) => row.errors.length === 0);
    const visible = [...problemRows, ...cleanRows.slice(0, Math.max(0, MAX_PREVIEW_ROWS - problemRows.length))]
        .sort((a, b) => a.line - b.line);
    const hiddenCount = rows.length - visible.length;

    return (
        <div className="flex flex-col gap-1">
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
                {/* w-max + min-w-full: the table keeps its natural width so the wrapper
                    scrolls horizontally on narrow screens instead of squashing columns. */}
                <table className="w-max min-w-full text-caption">
            <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                    <th className="p-2 font-medium">Line</th>
                    <th className="p-2 font-medium">Student</th>
                    <th className="p-2 font-medium">Marks</th>
                    <th className="p-2 font-medium">Answer</th>
                    <th className="p-2 font-medium">Checked</th>
                    <th className="p-2 font-medium">Report</th>
                    <th className="p-2 font-medium">Status</th>
                </tr>
            </thead>
                    <tbody>
                        {visible.map((row) => (
                            <tr
                                key={row.line}
                                className={cn(
                                    'border-t border-neutral-200',
                                    row.errors.length > 0 && 'bg-danger-50'
                                )}
                            >
                                <td className="p-2 text-neutral-500">{row.line}</td>
                                <td className="p-2 text-neutral-700">
                                    {row.student?.name || row.username || '—'}
                                    <span className="block text-neutral-400">{row.username}</span>
                                </td>
                                <td className="p-2 text-neutral-700">{row.totalMarks ?? '—'}</td>
                                {/* "auto" = matched from the zip's folder layout
                                    rather than named in the CSV. */}
                                <SlotCell path={row.studentPath} auto={row.autoMatchedSlots.includes('student')} />
                                <SlotCell path={row.checkedPath} auto={row.autoMatchedSlots.includes('checked')} />
                                <SlotCell path={row.reportPath} auto={row.autoMatchedSlots.includes('report')} />
                                <td className="p-2">
                                    {row.errors.length === 0 ? (
                                        <span className="text-success-600">Ready</span>
                                    ) : (
                                        <span className="text-danger-600">
                                            {row.errors.join('; ')}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hiddenCount > 0 && (
                <p className="text-caption text-neutral-400">
                    Showing {visible.length} of {rows.length} rows — {hiddenCount} more will import
                    without problems.
                </p>
            )}
        </div>
    );
};
