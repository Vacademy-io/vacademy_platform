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
import { LineChartComponent } from './lineChart';
import { MyTable } from '@/components/design-system/table';
import { useMutation } from '@tanstack/react-query';
import { fetchBatchReport, fetchLeaderboardData, exportBatchReport } from '../../-services/utils';
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
import { convertCapitalToTitleCase } from '@/lib/utils';
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

export default function TimelineReports() {
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

    const selectRef = useRef<HTMLDivElement | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        clearErrors,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            course: '',
            session: '',
            level: '',
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
            setLevelList(
                getLevelsFromPackage2({ courseId: selectedCourse, sessionId: selectedSession })
            );
        }
    }, [selectedSession]);
    useEffect(() => {
        if (sessionList?.length === 1 && sessionList[0]?.id === 'DEFAULT') {
            setValue('session', 'DEFAULT');
            setValue('level', 'DEFAULT');
            setDefaultSessionLevels(true);
        } else {
            setDefaultSessionLevels(false);
            setValue('session', 'select level');
            selectRef.current = null;
            setValue('level', 'select level');
        }
    }, [sessionList]);

    useEffect(() => {
        leaderboardMutation.mutate(
            {
                body: {
                    start_date: appliedDateRange?.start || startDate || '',
                    end_date: appliedDateRange?.end || endDate || '',
                    package_session_id: pacageSessionId,
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

    const getBatchReportDataPDF = useMutation({
        mutationFn: () =>
            exportBatchReport({
                startDate: appliedDateRange?.start || startDate || '',
                endDate: appliedDateRange?.end || endDate || '',
                packageSessionId:
                    getPackageSessionId({
                        courseId: selectedCourse || '',
                        sessionId: selectedSession || '',
                        levelId: selectedLevel || '',
                    }) || '',
                userId: '',
            }),
        onSuccess: async (response) => {
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `batch_report.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Batch Report PDF exported successfully');
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleExportPDF = () => {
        getBatchReportDataPDF.mutate();
    };

    const onSubmit = (data: FormValues) => {
        setLoading(true);
        setAppliedDateRange({ start: data.startDate, end: data.endDate });
        generateReportMutation.mutate(
            {
                start_date: data.startDate,
                end_date: data.endDate,
                // package_session_id: "aec81215-33b6-4af7-9b7e-ebee99e9d18b",
                package_session_id:
                    getPackageSessionId({
                        courseId: data.course || '',
                        sessionId: data.session || '',
                        levelId: data.level || '',
                    }) || '',
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
                    package_session_id:
                        getPackageSessionId({
                            courseId: data.course || '',
                            sessionId: data.session || '',
                            levelId: data.level || '',
                        }) || '',
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
        setPacageSessionId(
            getPackageSessionId({
                courseId: data.course || '',
                sessionId: data.session || '',
                levelId: data.level || '',
            }) || ''
        );
        // api call
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
    const isExporting = getBatchReportDataPDF.isPending;

    return (
        <div className="space-y-6">
            {/* Modern Filter Card */}
            <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* First Row - Course, Session, Level */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                            <label className="text-xs font-medium text-neutral-700 mb-1 block">
                                {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <Select
                                onValueChange={(value) => setValue('course', value)}
                                {...register('course')}
                                defaultValue=""
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue
                                        placeholder={`Select a ${getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        )}`}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {courseList.map((course) => (
                                        <SelectItem key={course.id} value={course.id}>
                                            {convertCapitalToTitleCase(course.name)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

                    {/* Second Row - Dates and Generate Button */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end w-full">
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
                                className="h-9 px-4 text-sm font-medium focus:!bg-primary-600 focus:!border-primary-600 focus:!text-white active:!bg-primary-600 active:!border-primary-600 active:!text-white focus:!outline-none focus:!ring-0"
                            >
                                Generate Report
                            </MyButton>
                        </div>
                    </div>

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
                    <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-primary-600">
                                    {courseList.find((c) => c.id === selectedCourse)?.name}
                                </h3>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-neutral-600">Duration:</span>
                                    <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-black">
                                        {dayjs(appliedDateRange?.start || startDate).format('DD MMM YYYY')}
                                    </span>
                                    <span className="text-neutral-400">—</span>
                                    <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-medium text-black">
                                        {dayjs(appliedDateRange?.end || endDate).format('DD MMM YYYY')}
                                    </span>
                                </div>
                            </div>
                            <MyButton
                                buttonType="secondary"
                                onClick={handleExportPDF}
                                className="h-9 px-4 text-sm"
                                disabled={isExporting}
                            >
                                {isExporting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-primary-500"></div>
                                        <span>Exporting...</span>
                                    </div>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Export PDF
                                    </>
                                )}
                            </MyButton>
                        </div>
                    </div>
                    
                    {/* Stats Cards - Improved Design */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-neutral-600">
                                        {getTerminology(ContentTerms.Course, SystemTerms.Course)} Completed by batch
                                    </h4>
                                    <p className="text-2xl font-bold text-primary-600">
                                        {`${formatToTwoDecimalPlaces(
                                            reportData?.percentage_course_completed
                                        )}%`}
                                    </p>
                                </div>
                                <div className="rounded-full bg-primary-100 p-3">
                                    <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-neutral-600">
                                        Daily Time Spent (Avg)
                                    </h4>
                                    <p className="text-2xl font-bold text-primary-600">
                                        {convertMinutesToTimeFormat(reportData?.avg_time_spent_in_minutes)}
                                    </p>
                                </div>
                                <div className="rounded-full bg-blue-100 p-3">
                                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-neutral-600">
                                        Concentration Score (Avg)
                                    </h4>
                                    <p className="text-2xl font-bold text-primary-600">
                                        {`${formatToTwoDecimalPlaces(
                                            reportData?.percentage_concentration_score || 0
                                        )}%`}
                                    </p>
                                </div>
                                <div className="rounded-full bg-green-100 p-3">
                                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Daily Learning Performance - Improved Responsive Layout */}
                    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
                        <div className="border-b border-neutral-200 p-6">
                            <h3 className="text-lg font-semibold text-primary-600">Daily Learning Performance</h3>
                            <p className="text-sm text-neutral-600 mt-1">Track daily progress and activity patterns</p>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                {/* Chart Section - Takes 2/3 on large screens */}
                                <div className="lg:col-span-2">
                                    <div className="min-h-[500px] h-auto w-full overflow-visible rounded-lg border border-neutral-200 bg-white">
                                        <div className="w-full p-6">
                                            <LineChartComponent
                                                chartData={convertChartData(reportData.daily_time_spent)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Table Section - Takes 1/3 on large screens, full width on mobile */}
                                <div className="lg:col-span-1">
                                    <div className="bg-neutral-50 rounded-lg p-4 min-h-[500px]">
                                        <h4 className="text-sm font-medium text-neutral-700 mb-4">Activity Summary</h4>
                                        <div className="h-[450px] overflow-auto">
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
                        </div>
                    </div>
                    
                    {/* Leaderboard - Improved Layout */}
                    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
                        <div className="border-b border-neutral-200 p-6">
                            <h3 className="text-lg font-semibold text-primary-600">Leaderboard</h3>
                            <p className="text-sm text-neutral-600 mt-1">Top performing students in the batch</p>
                        </div>
                        
                        <div className="p-6">
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
