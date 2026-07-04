import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useState, useEffect, useRef } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { LevelType } from '@/schemas/student/student-list/institute-schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MyButton } from '@/components/design-system/button';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import DateRangeFilter from '@/components/design-system/date-range-filter';
import { usePacageDetails } from '../../-store/usePacageDetails';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { fetchStudents } from '@/routes/manage-students/students-list/-services/getStudentTable';
import {
    initiateStudentAnalysis,
    getStudentReport,
    getStudentReportFull,
} from '@/services/student-analysis';
import { ComprehensiveReportDialog } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-reports/ComprehensiveReportDialog';
import type { ComprehensiveStudentReport } from '@/types/student-analysis';
import { toast } from 'sonner';
import {
    CheckCircle,
    XCircle,
    CircleNotch,
    Clock,
    Sparkle,
    Eye,
    ArrowClockwise,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// All v2 report modules — batch runs always include everything.
const ALL_MODULES = [
    'attendance',
    'live_classes',
    'academics',
    'activity',
    'progress',
    'certificates',
    'assignments',
    'doubts',
    'login',
];

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000; // 4 min per student before we consider it stuck

const formSchema = z
    .object({
        course: z.string().min(1, 'Course is required'),
        session: z.string().min(1, 'Session is required'),
        level: z.string().min(1, 'Level is required'),
        startDate: z.string().min(1, 'Start Date is required'),
        endDate: z.string().min(1, 'End Date is required'),
    })
    .refine(
        (data) => {
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            return diffInDays <= 30;
        },
        {
            message: 'The difference between Start Date and End Date should be less than one month.',
            path: ['startDate'],
        }
    );

type FormValues = z.infer<typeof formSchema>;

type RowStatus = 'queued' | 'generating' | 'completed' | 'failed';

interface StudentRow {
    userId: string;
    name: string;
    email?: string;
    status: RowStatus;
    processId?: string;
    error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BatchAiAnalysis() {
    const { getCourseFromPackage, getSessionFromPackage, getLevelsFromPackage2, getPackageSessionId } =
        useInstituteDetailsStore();
    const { setPacageSessionId } = usePacageDetails();
    const courseList = getCourseFromPackage();

    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [defaultSessionLevels, setDefaultSessionLevels] = useState(false);

    const [rows, setRows] = useState<StudentRow[]>([]);
    const [running, setRunning] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const stopRef = useRef(false);

    // Report viewer
    const [dialogOpen, setDialogOpen] = useState(false);
    const [viewReport, setViewReport] = useState<ComprehensiveStudentReport | null>(null);
    const [viewProcessId, setViewProcessId] = useState<string | null>(null);
    const [viewName, setViewName] = useState<string | undefined>(undefined);

    const instituteId = (() => {
        const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
        return (tokenData && Object.keys(tokenData.authorities)[0]) || '';
    })();

    const {
        handleSubmit,
        setValue,
        watch,
        clearErrors,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { course: '', session: '', level: '', startDate: '', endDate: '' },
    });

    const selectedCourse = watch('course');
    const selectedSession = watch('session');
    const selectedLevel = watch('level');

    useEffect(() => {
        if (selectedCourse) {
            setSessionList(getSessionFromPackage({ courseId: selectedCourse }));
            setValue('session', '');
        } else {
            setSessionList([]);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (selectedSession === '') {
            setValue('level', '');
            setLevelList([]);
        } else if (selectedCourse && selectedSession) {
            const levels = getLevelsFromPackage2({ courseId: selectedCourse, sessionId: selectedSession });
            setLevelList(levels);
            if (selectedSession !== 'DEFAULT' && levels.length === 1 && levels[0]) {
                setValue('level', levels[0].id);
                clearErrors('level');
            }
        }
    }, [selectedSession]);

    useEffect(() => {
        if (sessionList?.length === 1 && sessionList[0]?.id === 'DEFAULT') {
            setValue('session', 'DEFAULT');
            setValue('level', 'DEFAULT');
            setDefaultSessionLevels(true);
        } else {
            setDefaultSessionLevels(false);
            const onlySession = sessionList?.length === 1 ? sessionList[0] : undefined;
            if (onlySession) {
                setValue('session', onlySession.id);
                clearErrors('session');
            }
        }
    }, [sessionList]);

    const completedCount = rows.filter((r) => r.status === 'completed').length;
    const failedCount = rows.filter((r) => r.status === 'failed').length;
    const doneCount = completedCount + failedCount;
    const progressPct = rows.length > 0 ? Math.round((doneCount / rows.length) * 100) : 0;

    /** Fetch every ACTIVE learner enrolled in the resolved package session (paginated). */
    const fetchAllStudents = async (packageSessionId: string): Promise<StudentRow[]> => {
        const pageSize = 100;
        const collected: StudentRow[] = [];
        let pageNo = 0;
        let totalPages = 1;
        do {
            const res = await fetchStudents({
                pageNo,
                pageSize,
                filters: {
                    institute_ids: [instituteId],
                    package_session_ids: [packageSessionId],
                    statuses: ['ACTIVE'],
                },
            });
            totalPages = res.total_pages ?? 1;
            (res.content ?? []).forEach((s) => {
                if (s.user_id) {
                    collected.push({
                        userId: s.user_id,
                        name: s.full_name || s.user_id,
                        email: s.email,
                        status: 'queued',
                    });
                }
            });
            pageNo += 1;
        } while (pageNo < totalPages);
        return collected;
    };

    /** Poll a single process until it reaches a terminal state (or times out). */
    const pollUntilDone = async (processId: string): Promise<RowStatus> => {
        const start = Date.now();
        while (Date.now() - start < POLL_TIMEOUT_MS) {
            if (stopRef.current) return 'failed';
            try {
                const report = await getStudentReport(processId);
                if (report.status === 'COMPLETED') return 'completed';
                if (report.status === 'FAILED' || report.status === 'ERROR') return 'failed';
            } catch {
                // transient — keep polling
            }
            await sleep(POLL_INTERVAL_MS);
        }
        return 'failed';
    };

    /** Run the queue sequentially: initiate → poll → next. */
    const runQueue = async (queue: StudentRow[], startDate: string, endDate: string, packageSessionId: string) => {
        setRunning(true);
        stopRef.current = false;
        for (let i = 0; i < queue.length; i++) {
            if (stopRef.current) break;
            const row = queue[i];
            if (!row || row.status === 'completed') continue;

            setRows((prev) =>
                prev.map((r) => (r.userId === row.userId ? { ...r, status: 'generating', error: undefined } : r))
            );

            try {
                const res = await initiateStudentAnalysis(
                    {
                        user_id: row.userId,
                        start_date_iso: startDate,
                        end_date_iso: endDate,
                        report_version: 'v2',
                        batch_id: packageSessionId,
                        package_session_id: packageSessionId,
                        include_modules: ALL_MODULES,
                        send_email: false, // bulk run — don't email learners
                    },
                    instituteId
                );
                const processId = res.process_id;
                const finalStatus = await pollUntilDone(processId);
                setRows((prev) =>
                    prev.map((r) =>
                        r.userId === row.userId
                            ? {
                                  ...r,
                                  status: finalStatus,
                                  processId,
                                  error: finalStatus === 'failed' ? 'Generation failed or timed out' : undefined,
                              }
                            : r
                    )
                );
            } catch (e) {
                setRows((prev) =>
                    prev.map((r) =>
                        r.userId === row.userId
                            ? { ...r, status: 'failed', error: 'Could not start generation' }
                            : r
                    )
                );
            }
        }
        setRunning(false);
    };

    const onSubmit = async (data: FormValues) => {
        const packageSessionId =
            getPackageSessionId({
                courseId: data.course || '',
                sessionId: data.session || '',
                levelId: data.level || '',
            }) || '';

        if (!packageSessionId) {
            toast.error('Could not resolve the selected batch. Check course / session / level.');
            return;
        }
        setPacageSessionId(packageSessionId);

        setPreparing(true);
        setRows([]);
        try {
            const students = await fetchAllStudents(packageSessionId);
            if (students.length === 0) {
                toast.error('No active learners found in this batch.');
                setPreparing(false);
                return;
            }
            setRows(students);
            setPreparing(false);
            await runQueue(students, data.startDate, data.endDate, packageSessionId);
            toast.success('Batch report generation finished.');
        } catch {
            toast.error('Failed to load the batch learners.');
            setPreparing(false);
        }
    };

    const handleStop = () => {
        stopRef.current = true;
        toast.info('Stopping after the current learner…');
    };

    const handleRetryFailed = async () => {
        const failed = rows.filter((r) => r.status === 'failed');
        if (failed.length === 0) return;
        // We need the last-used dates + package session; re-read from the form.
        const values = watch();
        const packageSessionId =
            getPackageSessionId({
                courseId: values.course || '',
                sessionId: values.session || '',
                levelId: values.level || '',
            }) || '';
        if (!packageSessionId || !values.startDate || !values.endDate) {
            toast.error('Re-select the batch and date range to retry.');
            return;
        }
        // reset failed rows to queued
        setRows((prev) => prev.map((r) => (r.status === 'failed' ? { ...r, status: 'queued', error: undefined } : r)));
        await runQueue(failed, values.startDate, values.endDate, packageSessionId);
    };

    const handleView = async (row: StudentRow) => {
        if (!row.processId) return;
        try {
            const full = await getStudentReportFull(row.processId);
            if (full.report_version === 'v2' && full.comprehensive_report) {
                setViewReport(full.comprehensive_report);
                setViewProcessId(row.processId);
                setViewName(full.name || `${row.name} — Report`);
                setDialogOpen(true);
            } else {
                toast.error('Report is not ready to view yet.');
            }
        } catch {
            toast.error('Failed to load the report.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Filter card */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                    <Sparkle size={18} className="text-primary-500" weight="fill" />
                    <p className="text-sm font-medium text-neutral-700">
                        Generate an AI report for every active learner in a batch.
                    </p>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-700">
                                {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                                <span className="ml-1 text-danger-500">*</span>
                            </label>
                            <SearchableSelect
                                options={courseList.map((course) => ({
                                    label: convertCapitalToTitleCase(course.name),
                                    value: course.id,
                                }))}
                                value={selectedCourse}
                                onChange={(value) => setValue('course', value)}
                                placeholder={`Select a ${getTerminology(ContentTerms.Course, SystemTerms.Course)}`}
                                searchPlaceholder={`Search ${getTerminology(ContentTerms.Course, SystemTerms.Course)}...`}
                                triggerClassName="h-9 text-sm"
                            />
                        </div>

                        {!defaultSessionLevels && (
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                                    <span className="ml-1 text-danger-500">*</span>
                                </label>
                                <Select
                                    onValueChange={(value) => setValue('session', value)}
                                    value={selectedSession}
                                    disabled={!sessionList.length}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue
                                            placeholder={`Select a ${getTerminology(ContentTerms.Session, SystemTerms.Session)}`}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sessionList.map((session) => (
                                            <SelectItem key={session.id} value={session.id}>
                                                {convertCapitalToTitleCase(session.name)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {!defaultSessionLevels && (
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                                    <span className="ml-1 text-danger-500">*</span>
                                </label>
                                <Select
                                    onValueChange={(value) => setValue('level', value)}
                                    value={selectedLevel}
                                    disabled={!levelList.length}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue
                                            placeholder={`Select a ${getTerminology(ContentTerms.Level, SystemTerms.Level)}`}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {levelList.map((level) => (
                                            <SelectItem key={level.id} value={level.id}>
                                                {convertCapitalToTitleCase(level.level_name)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <DateRangeFilter
                                onChange={(res) => {
                                    if (res) {
                                        const [sDay, sMonth, sYear] = res.startDate.split('/');
                                        const [eDay, eMonth, eYear] = res.endDate.split('/');
                                        setValue('startDate', `${sYear}-${sMonth}-${sDay}`);
                                        setValue('endDate', `${eYear}-${eMonth}-${eDay}`);
                                        clearErrors('startDate');
                                        clearErrors('endDate');
                                    } else {
                                        setValue('startDate', '');
                                        setValue('endDate', '');
                                    }
                                }}
                            />
                        </div>
                        <div className="sm:mb-1">
                            <MyButton
                                type="submit"
                                buttonType="primary"
                                className="h-9 px-4 text-sm font-medium"
                                disabled={running || preparing}
                            >
                                {preparing ? 'Loading learners…' : running ? 'Generating…' : 'Generate AI Reports'}
                            </MyButton>
                        </div>
                    </div>

                    {Object.keys(errors).length > 0 && (
                        <div className="rounded-md border border-danger-200 bg-danger-50 p-3">
                            <div className="text-sm text-danger-800">
                                <p className="mb-1 font-medium">Please fix the following errors:</p>
                                <ul className="space-y-1">
                                    {Object.entries(errors).map(([key, error]) => (
                                        <li key={key} className="text-xs">
                                            • {error.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Progress + results */}
            {rows.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-neutral-800">
                                {doneCount}/{rows.length} done
                            </span>
                            {completedCount > 0 && (
                                <span className="text-xs text-success-600">{completedCount} completed</span>
                            )}
                            {failedCount > 0 && (
                                <span className="text-xs text-danger-600">{failedCount} failed</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {running && (
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    className="h-8 px-3 text-xs"
                                    onClick={handleStop}
                                >
                                    Stop
                                </MyButton>
                            )}
                            {!running && failedCount > 0 && (
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    className="h-8 px-3 text-xs"
                                    onClick={handleRetryFailed}
                                >
                                    <ArrowClockwise size={14} className="mr-1" />
                                    Retry failed
                                </MyButton>
                            )}
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        {/* eslint-disable-next-line -- dynamic progress width (0-100%), not a static style */}
                        <div
                            className="h-full rounded-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>

                    <div className="flex max-h-96 flex-col divide-y divide-neutral-100 overflow-y-auto">
                        {rows.map((row) => (
                            <div key={row.userId} className="flex items-center justify-between gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-neutral-800">{row.name}</p>
                                    {row.email && (
                                        <p className="truncate text-xs text-neutral-400">{row.email}</p>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <StatusBadge status={row.status} />
                                    {row.status === 'completed' && row.processId && (
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => handleView(row)}
                                        >
                                            <Eye size={14} className="mr-1" />
                                            View
                                        </MyButton>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <ComprehensiveReportDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                processId={viewProcessId}
                report={viewReport}
                reportName={viewName}
            />
        </div>
    );
}

function StatusBadge({ status }: { status: RowStatus }) {
    const map: Record<RowStatus, { label: string; cls: string; icon: JSX.Element }> = {
        queued: {
            label: 'Queued',
            cls: 'bg-neutral-100 text-neutral-500',
            icon: <Clock size={12} />,
        },
        generating: {
            label: 'Generating',
            cls: 'bg-primary-50 text-primary-600',
            icon: <CircleNotch size={12} className="animate-spin" />,
        },
        completed: {
            label: 'Completed',
            cls: 'bg-success-50 text-success-700',
            icon: <CheckCircle size={12} weight="fill" />,
        },
        failed: {
            label: 'Failed',
            cls: 'bg-danger-50 text-danger-700',
            icon: <XCircle size={12} weight="fill" />,
        },
    };
    const s = map[status];
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                s.cls
            )}
        >
            {s.icon}
            {s.label}
        </span>
    );
}
