import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useState, useEffect } from 'react';
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
import { fetchSubjectWiseProgress, exportBatchSubjectWiseReport } from '../../-services/utils';
import {
    SubjectProgressResponse,
    SubjectOverviewBatchColumns,
    SUBJECT_OVERVIEW_BATCH_WIDTH,
    SubjectOverviewBatchColumnType,
} from '../../-types/types';
import { useMutation } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyTable } from '@/components/design-system/table';
import { usePacageDetails } from '../../-store/usePacageDetails';
import { formatToTwoDecimalPlaces, convertMinutesToTimeFormat } from '../../-services/helper';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { toast } from 'sonner';

const formSchema = z.object({
    course: z.string().min(1, 'Course is required'),
    session: z.string().min(1, 'Session is required'),
    level: z.string().min(1, 'Level is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProgressReports() {
    const {
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage2,
        getPackageSessionId,
    } = useInstituteDetailsStore();
    const { setPacageSessionId, setCourse, setSession, setLevel, pacageSessionId } = usePacageDetails();
    const courseList = getCourseFromPackage();
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [subjectReportData, setSubjectReportData] = useState<SubjectProgressResponse>();
    const tableState = { columnVisibility: { module_id: false, user_id: false } };
    const { register, handleSubmit, setValue, watch, trigger } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            course: '',
            session: '',
            level: '',
        },
    });
    const selectedCourse = watch('course');
    const selectedSession = watch('session');
    const selectedLevel = watch('level');
    const transformToSubjectOverview = (
        data: SubjectProgressResponse
    ): SubjectOverviewBatchColumnType[] => {
        return data.flatMap((subject) => {
            return subject.modules.map((module, index) => ({
                subject: subject.subject_name, // Show subject name in every row
                module: module.module_name,
                module_id: module.module_id,
                module_completed_by_batch: `${formatToTwoDecimalPlaces(
                    module.module_completion_percentage_by_batch
                )}%`,
                average_time_spent_by_batch: convertMinutesToTimeFormat(
                    module.avg_time_spent_minutes_by_batch ?? 0
                ),
            }));
        });
    };

    const subjectWiseData = {
        content: subjectReportData ? transformToSubjectOverview(subjectReportData) : [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: false,
    };

    const SubjectWiseMutation = useMutation({
        mutationFn: fetchSubjectWiseProgress,
    });
    const { isPending, error } = SubjectWiseMutation;

    const getBatchProgressReportPDF = useMutation({
        mutationFn: () =>
            exportBatchSubjectWiseReport({
                startDate: '',
                endDate: '',
                packageSessionId: pacageSessionId || '',
            }),
        onSuccess: async (response) => {
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `subject-wise-batch-progress-report.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Subject-wise Batch Progress Report PDF exported successfully');
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleExportPDF = () => {
        getBatchProgressReportPDF.mutate();
    };

    const isExporting = getBatchProgressReportPDF.isPending;

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

    const onSubmit = (data: FormValues) => {
        // api call
        SubjectWiseMutation.mutate(
            {
                packageSessionId:
                    getPackageSessionId({
                        courseId: data.course,
                        sessionId: data.session,
                        levelId: data.level,
                    }) || '',
            },
            {
                onSuccess: (data) => {
                    setSubjectReportData(data);
                },
                onError: (error) => {
                    console.error('Error:', error);
                },
            }
        );
        setCourse(courseList.find((course) => (course.id = data.course))?.name || '');
        setSession(sessionList.find((course) => (course.id = data.session))?.name || '');
        setLevel(levelList.find((course) => (course.id = data.level))?.level_name || '');
        setPacageSessionId(
            getPackageSessionId({
                courseId: data.course,
                sessionId: data.session,
                levelId: data.level,
            }) || ''
        );
    };

    return (
        <div className="space-y-6">
            {/* Modern Filter Card */}
            <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Course, Session, Level Row */}
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

                        <div>
                            <label className="text-xs font-medium text-neutral-700 mb-1 block">
                                {getTerminology(ContentTerms.Session, SystemTerms.Session)}
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <Select
                                onValueChange={(value) => setValue('session', value)}
                                {...register('session')}
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

                        <div>
                            <label className="text-xs font-medium text-neutral-700 mb-1 block">
                                {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <Select
                                onValueChange={(value) => {
                                    setValue('level', value);
                                    trigger('level');
                                }}
                                defaultValue=""
                                value={selectedLevel}
                                disabled={!levelList.length}
                                {...register('level')}
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
                    </div>

                    {/* Generate Button Row */}
                    <div className="flex justify-start">
                        <MyButton 
                            type="submit" 
                            buttonType="primary" 
                            className="h-9 px-4 text-sm font-medium focus:!bg-primary-600 focus:!border-primary-600 focus:!text-white active:!bg-primary-600 active:!border-primary-600 active:!text-white focus:!outline-none focus:!ring-0"
                        >
                            Generate Report
                        </MyButton>
                    </div>
                </form>
            </div>
            
            {isPending && <DashboardLoader />}
            
            {subjectReportData && (
                <div className="space-y-6">
                    {/* Report Header */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-primary-600">
                                    {courseList.find((course) => course.id === selectedCourse)?.name || ''}
                                </h3>
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
                    
                    {/* Report Content */}
                    <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                        <div className="space-y-4">
                            <h4 className="text-base font-semibold text-primary-600">
                                {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}-wise Overview
                            </h4>
                            <div className="!min-w-full overflow-x-auto [&_table]:!w-full [&_table]:!min-w-full [&_td]:!whitespace-nowrap [&_th]:!whitespace-nowrap">
                                <MyTable
                                    data={subjectWiseData}
                                    columns={SubjectOverviewBatchColumns}
                                    isLoading={isPending}
                                    error={error}
                                    currentPage={0}
                                    tableState={tableState}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
