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
import {
    CheckCircle,
    Clock,
    Brain,
    ChartLineUp,
    Trophy,
    Export,
    CalendarBlank,
    CaretDown,
} from '@phosphor-icons/react';
import { METRIC_INFO } from '../metricInfo';
import { ReportHeader, MetricCard, SectionCard } from '../reportUi';
import { LineChartComponent } from './lineChart';
import { MyTable } from '@/components/design-system/table';
import { useMutation } from '@tanstack/react-query';
import { fetchBatchReport, fetchLeaderboardData } from '../../-services/utils';
import { resolveInstituteLogoUrl } from '../live/-utils/instituteLogo';
import { exportBatchLearningPdf } from '../../-utils/exportLearningPdf';
import {
    DailyLearnerTimeSpent,
    BatchReportResponse,
    activityLogColumns,
    CONCENTRATION_SCORE,
    leaderBoardColumns,
    LEADERBOARD_WIDTH,
    LeaderBoardColumnType,
} from '../../-types/types';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import dayjs from 'dayjs';
import { MyPagination } from '@/components/design-system/pagination';
import { formatToTwoDecimalPlaces, convertMinutesToTimeFormat } from '../../-services/helper';
import { usePacageDetails } from '../../-store/usePacageDetails';
import { toast } from 'sonner';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { cn, convertCapitalToTitleCase } from '@/lib/utils';
import DateRangeFilter from '@/components/design-system/date-range-filter';

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
            message:
                'The difference between Start Date and End Date should be less than one month.',
            path: ['startDate'],
        }
    );

type FormValues = z.infer<typeof formSchema>;

interface LeaderBoardData {
    daily_avg_time: number;
    avg_concentration: number;
    rank: number;
    total_time: number;
    user_id: string;
    email: string;
    full_name: string;
}

interface TimelineReportsProps {
    /**
     * When rendered inside a batch-scoped surface (e.g. Course Details → Reports),
     * the batch is already known — the course/session/level picker is hidden and
     * the report is generated for this package session directly.
     */
    fixedPackageSessionId?: string;
    /** Course id backing `fixedPackageSessionId`, used only to title the report. */
    fixedCourseId?: string;
}

export default function TimelineReports({
    fixedPackageSessionId,
    fixedCourseId,
}: TimelineReportsProps = {}) {
    const isBatchFixed = Boolean(fixedPackageSessionId);
    const {
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage2,
        getPackageSessionId,
    } = useInstituteDetailsStore();
    const { setPacageSessionId, pacageSessionId } = usePacageDetails();
    const courseList = getCourseFromPackage();
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [reportData, setReportData] = useState<BatchReportResponse>();
    const [leaderboardData, setleaderboardData] = useState<LeaderBoardData[]>();
    const [loading, setLoading] = useState(false);
    const [currPage, setCurrPage] = useState<number>(0);
    const [totalPage, setTotalPage] = useState<number>(0);
    const [appliedDateRange, setAppliedDateRange] = useState<{start: string, end: string} | null>(null);
    const [defaultSessionLevels, setDefaultSessionLevels] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    // Fixed-batch mode: the date filter collapses away once the default 7-day
    // report has been generated, so the report itself gets the vertical space.
    const [showDateFilter, setShowDateFilter] = useState(false);
    const hasAutoGenerated = useRef(false);
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);

    const selectRef = useRef<HTMLDivElement | null>(null);

    const {
        handleSubmit,
        setValue,
        watch,
        clearErrors,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            // In fixed-batch mode the picker is hidden; seed the three fields so the
            // schema's "required" checks pass — only the date range is user-supplied.
            course: fixedPackageSessionId ?? '',
            session: fixedPackageSessionId ?? '',
            level: fixedPackageSessionId ?? '',
            startDate: '',
            endDate: '',
        },
    });

    const selectedCourse = watch('course');
    const selectedSession = watch('session');
    const selectedLevel = watch('level');
    const startDate = watch('startDate');
    const endDate = watch('endDate');

    useEffect(() => {
        if (isBatchFixed) return;
        if (selectedCourse) {
            setSessionList(getSessionFromPackage({ courseId: selectedCourse }));
            setValue('session', '');
        } else {
            setSessionList([]);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (isBatchFixed) return;
        if (selectedSession === '') {
            setValue('level', '');
            setLevelList([]);
        } else if (selectedCourse && selectedSession) {
            const levels = getLevelsFromPackage2({
                courseId: selectedCourse,
                sessionId: selectedSession,
            });
            setLevelList(levels);
            // Auto-select when the session exposes exactly one (real) level.
            if (selectedSession !== 'DEFAULT' && levels.length === 1 && levels[0]) {
                setValue('level', levels[0].id);
                clearErrors('level');
            }
        }
    }, [selectedSession]);
    useEffect(() => {
        if (isBatchFixed) return;
        if (sessionList?.length === 1 && sessionList[0]?.id === 'DEFAULT') {
            setValue('session', 'DEFAULT');
            setValue('level', 'DEFAULT');
            setDefaultSessionLevels(true);
        } else {
            setDefaultSessionLevels(false);
            const onlySession = sessionList?.length === 1 ? sessionList[0] : undefined;
            if (onlySession) {
                // Auto-select when the course has exactly one (real) session.
                setValue('session', onlySession.id);
                clearErrors('session');
            } else {
                setValue('session', 'select level');
                selectRef.current = null;
                setValue('level', 'select level');
            }
        }
    }, [sessionList]);

    // Auto-select the level whenever the list resolves to exactly one (real)
    // level and none is chosen yet. The [selectedSession] handler above already
    // does this, but on the batch tab the session is itself auto-selected one
    // render later (in the [sessionList] effect), so this guarantees the level
    // fills in too instead of being left on "Select a Level".
    useEffect(() => {
        if (isBatchFixed) return;
        if (!selectedLevel && levelList.length === 1 && levelList[0]) {
            setValue('level', levelList[0].id);
            clearErrors('level');
        }
    }, [levelList, selectedLevel]);

    // Paging the leaderboard. Only meaningful once a report has been generated —
    // before that there is no applied range to page through.
    useEffect(() => {
        if (!appliedDateRange) return;
        leaderboardMutation.mutate(
            {
                body: {
                    start_date: appliedDateRange.start,
                    end_date: appliedDateRange.end,
                    package_session_id: fixedPackageSessionId || pacageSessionId,
                },
                param: { pageNo: currPage, pageSize: 10 },
            },
            {
                onSuccess: (data) => {
                    setTotalPage(data.totalPages);
                    setleaderboardData(data.content);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Error:', error);
                    setLoading(false);
                },
            }
        );
    }, [currPage]);

    // Fixed-batch mode: DateRangeFilter's "7 Days" default populates the form on
    // mount — fire the report once so the tab lands with data already loaded.
    useEffect(() => {
        if (!isBatchFixed || hasAutoGenerated.current) return;
        if (!startDate || !endDate) return;
        hasAutoGenerated.current = true;
        handleSubmit(onSubmit)();
    }, [isBatchFixed, startDate, endDate]);

    const handleDateRangeChange = (res: { startDate: string; endDate: string } | null) => {
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
    };

    const handleExportPDF = async () => {
        if (!reportData) return;
        setIsExporting(true);
        try {
            const logoUrl = await resolveInstituteLogoUrl(instituteDetails?.institute_logo_file_id);
            await exportBatchLearningPdf(
                {
                    instituteName: instituteDetails?.institute_name || 'Vacademy',
                    logoUrl,
                    courseName:
                        courseList.find((c) => c.id === (fixedCourseId || selectedCourse))?.name ||
                        '',
                    dateRange: `${dayjs(appliedDateRange?.start || startDate).format('DD MMM YYYY')} — ${dayjs(
                        appliedDateRange?.end || endDate
                    ).format('DD MMM YYYY')}`,
                },
                reportData,
                (leaderboardData ?? []).map((l) => ({
                    rank: l.rank,
                    full_name: l.full_name,
                    avg_concentration: l.avg_concentration,
                    daily_avg_time: l.daily_avg_time,
                    total_time: l.total_time,
                }))
            );
            toast.success('Batch report exported');
        } catch {
            toast.error('Failed to export PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const onSubmit = (data: FormValues) => {
        const resolvedPackageSessionId =
            fixedPackageSessionId ||
            getPackageSessionId({
                courseId: data.course || '',
                sessionId: data.session || '',
                levelId: data.level || '',
            }) ||
            '';
        setLoading(true);
        setAppliedDateRange({ start: data.startDate, end: data.endDate });
        generateReportMutation.mutate(
            {
                start_date: data.startDate,
                end_date: data.endDate,
                package_session_id: resolvedPackageSessionId,
            },
            {
                onSuccess: (data) => {
                    setReportData(data);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Error:', error);
                    setLoading(false);
                },
            }
        );
        leaderboardMutation.mutate(
            {
                body: {
                    start_date: data.startDate,
                    end_date: data.endDate,
                    package_session_id: resolvedPackageSessionId,
                },
                param: {
                    pageNo: currPage,
                    pageSize: 10,
                },
            },
            {
                onSuccess: (data) => {
                    setTotalPage(data.totalPages);
                    setleaderboardData(data.content);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error('Error:', error);
                    setLoading(false);
                },
            }
        );
        setPacageSessionId(resolvedPackageSessionId);
    };

    const convertFormat = (data: DailyLearnerTimeSpent[] | undefined) => {
        if (!data) return []; // Return an empty array if data is undefined

        return data.map((item) => ({
            date: dayjs(item.activity_date).format('DD/MM/YYYY'),
            timeSpent: convertMinutesToTimeFormat(item.avg_daily_time_minutes),
        }));
    };

    const convertChartData = (data: DailyLearnerTimeSpent[] | undefined) => {
        if (!data) return []; // Return an empty array if data is undefined

        return data.map((item) => ({
            activity_date: item.activity_date,
            avg_daily_time_minutes: item.avg_daily_time_minutes / 60,
        }));
    };

    const transformToLeaderBoard = (data: LeaderBoardData[]): LeaderBoardColumnType[] => {
        return data.map((item) => ({
            rank: item.rank.toString(),
            name: item.full_name,
            score: `${formatToTwoDecimalPlaces(item.avg_concentration.toString())} %`,
            average: convertMinutesToTimeFormat(item.daily_avg_time),
            totalTime: convertMinutesToTimeFormat(item.total_time),
        }));
    };

    const tableData = {
        content: convertFormat(reportData?.daily_time_spent),
        total_pages: totalPage,
        page_no: currPage,
        page_size: 10,
        total_elements: 0,
        last: false,
    };

    const leaderBoardData = {
        content: leaderboardData ? transformToLeaderBoard(leaderboardData) : [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: false,
    };

    const generateReportMutation = useMutation({ mutationFn: fetchBatchReport });
    const leaderboardMutation = useMutation({
        mutationFn: fetchLeaderboardData,
    });
    const { isPending, error } = leaderboardMutation;

    return (
        <div className="space-y-6">
            {/* Modern Filter Card */}
            <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* First Row - Course, Session, Level (hidden when the parent already scopes the batch) */}
                    {!isBatchFixed && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label className="text-xs font-medium text-neutral-700 mb-1 block">
                                {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <SearchableSelect
                                options={courseList.map((course) => ({
                                    label: convertCapitalToTitleCase(course.name),
                                    value: course.id,
                                }))}
                                value={selectedCourse}
                                onChange={(value) => setValue('course', value)}
                                placeholder={`Select a ${getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                )}`}
                                searchPlaceholder={`Search ${getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                )}...`}
                                triggerClassName="h-9 text-sm"
                            />
                        </div>

                        {!defaultSessionLevels && (
                            <div>
                                <label className="text-xs font-medium text-neutral-700 mb-1 block">
                                    {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <Select
                                    onValueChange={(value) => setValue('session', value)}
                                    defaultValue=""
                                    value={selectedSession}
                                    disabled={!sessionList.length}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue
                                            placeholder={`Select a ${getTerminology(
                                                ContentTerms.Session,
                                                SystemTerms.Session
                                            )}`}
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
                                <label className="text-xs font-medium text-neutral-700 mb-1 block">
                                    {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <Select
                                    onValueChange={(value) => setValue('level', value)}
                                    defaultValue=""
                                    value={selectedLevel}
                                    disabled={!levelList.length}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue
                                            placeholder={`Select a ${getTerminology(
                                                ContentTerms.Level,
                                                SystemTerms.Level
                                            )}`}
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
                    )}

                    {/* Second Row - Dates and Generate Button.
                        Batch-scoped: collapsed to a one-line summary, expandable to re-pick. */}
                    {isBatchFixed ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <CalendarBlank className="size-4 text-neutral-400" />
                                    <span className="text-caption text-neutral-500">Range:</span>
                                    <span className="text-body font-medium text-neutral-700">
                                        {startDate && endDate
                                            ? `${dayjs(startDate).format('DD MMM YYYY')} — ${dayjs(endDate).format('DD MMM YYYY')}`
                                            : 'Last 7 days'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowDateFilter((open) => !open)}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-medium text-primary-500 hover:bg-primary-50"
                                    >
                                        {showDateFilter ? 'Hide' : 'Change'}
                                        <CaretDown
                                            className={cn(
                                                'size-3 transition-transform',
                                                showDateFilter && 'rotate-180'
                                            )}
                                        />
                                    </button>
                                </div>
                                <MyButton
                                    type="submit"
                                    buttonType="primary"
                                    className="h-9 px-4 text-body font-medium"
                                >
                                    Generate Report
                                </MyButton>
                            </div>
                            {/* Kept mounted (only visually hidden) so DateRangeFilter's
                                "7 Days" default still seeds the form on first render. */}
                            <div className={cn(!showDateFilter && 'hidden')}>
                                <DateRangeFilter
                                    defaultFilter="7 Days"
                                    onChange={handleDateRangeChange}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end w-full">
                            <div className="flex-1">
                                <DateRangeFilter onChange={handleDateRangeChange} />
                            </div>
                            <div className="sm:mb-1">
                                <MyButton
                                    type="submit"
                                    buttonType="primary"
                                    className="h-9 px-4 text-sm font-medium focus:!bg-primary-600 focus:!border-primary-600 focus:!text-white active:!bg-primary-600 active:!border-primary-600 active:!text-white focus:!outline-none focus:!ring-0"
                                >
                                    Generate Report
                                </MyButton>
                            </div>
                        </div>
                    )}

                    {/* Error Messages */}
                    {Object.keys(errors).length > 0 && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-3">
                            <div className="text-sm text-red-800">
                                <p className="font-medium mb-1">Please fix the following errors:</p>
                                <ul className="space-y-1">
                                    {Object.entries(errors).map(([key, error]) => (
                                        <li key={key} className="text-xs">• {error.message}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </form>
            </div>
            
            {loading && <DashboardLoader />}
            
            {reportData && !loading && (
                <div className="space-y-6">
                    {/* Report Header */}
                    <ReportHeader
                        title={
                            courseList.find((c) => c.id === (fixedCourseId || selectedCourse))
                                ?.name || ''
                        }
                        chips={
                            <>
                                <span className="text-caption text-neutral-500">Duration:</span>
                                <span className="rounded-md bg-primary-50 px-2 py-1 text-caption font-medium text-neutral-700">
                                    {dayjs(appliedDateRange?.start || startDate).format('DD MMM YYYY')}
                                </span>
                                <span className="text-neutral-400">—</span>
                                <span className="rounded-md bg-primary-50 px-2 py-1 text-caption font-medium text-neutral-700">
                                    {dayjs(appliedDateRange?.end || endDate).format('DD MMM YYYY')}
                                </span>
                            </>
                        }
                        actions={
                            <MyButton
                                buttonType="secondary"
                                onClick={handleExportPDF}
                                disable={isExporting}
                                className="h-9 px-4 text-body"
                            >
                                <Export className="mr-1.5 size-4" />
                                {isExporting ? 'Exporting…' : 'Export PDF'}
                            </MyButton>
                        }
                    />
                    
                    {/* KPI cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <MetricCard
                            tone="success"
                            label={`${getTerminology(ContentTerms.Course, SystemTerms.Course)} Completed`}
                            value={`${formatToTwoDecimalPlaces(reportData?.percentage_course_completed)}%`}
                            sub="across the batch"
                            info={METRIC_INFO.courseCompleted}
                            icon={<CheckCircle className="size-5" weight="duotone" />}
                        />
                        <MetricCard
                            tone="primary"
                            label="Daily Time Spent (Avg)"
                            value={convertMinutesToTimeFormat(reportData?.avg_time_spent_in_minutes ?? 0)}
                            info={METRIC_INFO.timeSpentAvg}
                            icon={<Clock className="size-5" weight="duotone" />}
                        />
                        <MetricCard
                            tone="warning"
                            label="Concentration Score (Avg)"
                            value={`${formatToTwoDecimalPlaces(reportData?.percentage_concentration_score || 0)}%`}
                            info={METRIC_INFO.concentration}
                            icon={<Brain className="size-5" weight="duotone" />}
                        />
                    </div>
                    
                    {/* Daily learning performance */}
                    <SectionCard
                        title="Daily Learning Performance"
                        subtitle="Track daily progress and activity patterns"
                        icon={<ChartLineUp className="size-4" />}
                    >
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <div className="h-auto w-full overflow-visible rounded-lg border border-neutral-200 bg-white">
                                    <div className="w-full p-4">
                                        <LineChartComponent
                                            chartData={convertChartData(reportData.daily_time_spent)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-1">
                                <div className="rounded-lg bg-neutral-50 p-4">
                                    <h4 className="mb-4 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                                        Activity Summary
                                    </h4>
                                    <div className="h-96 overflow-auto">
                                        <div className="!min-w-full [&_table]:!w-full [&_table]:!min-w-full [&_td]:!whitespace-nowrap [&_th]:!whitespace-nowrap">
                                            <MyTable
                                                data={tableData}
                                                columns={activityLogColumns}
                                                isLoading={isPending}
                                                error={error}
                                                currentPage={0}
                                                scrollable={true}
                                                className="!h-full"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                    
                    {/* Leaderboard */}
                    <SectionCard
                        title="Leaderboard"
                        subtitle="Top performing students in the batch"
                        icon={<Trophy className="size-4" />}
                        info={METRIC_INFO.leaderboard}
                    >
                        <div className="w-full overflow-hidden">
                            <MyTable
                                data={leaderBoardData}
                                columns={leaderBoardColumns}
                                isLoading={isPending}
                                error={error}
                                currentPage={0}
                                className="w-full !min-w-full [&_table]:!w-full [&_table]:!min-w-full [&_thead]:!w-full [&_tbody]:!w-full [&_tr]:!w-full [&_th]:!px-4 [&_td]:!px-4"
                            />
                        </div>
                        <div className="mt-6 flex justify-center">
                            <MyPagination
                                currentPage={currPage}
                                totalPages={totalPage}
                                onPageChange={setCurrPage}
                            />
                        </div>
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
