import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useState, useEffect } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Command, CommandInput, CommandList } from '@/components/ui/command';
import { LevelType } from '@/schemas/student/student-list/institute-schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MyButton } from '@/components/design-system/button';
import ReportRecipientsDialogBox from './reportRecipientsDialogBox';
import { useMutation } from '@tanstack/react-query';
import {
    fetchLearnersReport,
    fetchSlideWiseProgress,
    exportLearnersReport,
} from '../../-services/utils';
import { useLearnerDetails, UserResponse } from '../../-store/useLearnersDetails';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    LearnersReportResponse,
    LEARNERS_REPORTS_COLUMNS,
    learnersReportColumns,
    SlideData,
    SLIDES_WIDTH,
    SlidesColumns,
} from '../../-types/types';
import { MyTable } from '@/components/design-system/table';
import { LineChartComponent } from './lineChart';
import {
    transformLearnersReport,
    transformToChartData,
    formatToTwoDecimalPlaces,
    convertMinutesToTimeFormat,
} from '../../-services/helper';
import dayjs from 'dayjs';
import { useSearch } from '@tanstack/react-router';
import { Route } from '@/routes/study-library/reports';
import { toast } from 'sonner';

const formSchema = z
    .object({
        course: z.string().min(1, 'Course is required'),
        session: z.string().min(1, 'Session is required'),
        level: z.string().min(1, 'Level is required'),
        student: z.string().min(1, 'Student is required'),
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

export default function TimelineReports() {
    const {
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage2,
        getPackageSessionId,
    } = useInstituteDetailsStore();
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const courseList = getCourseFromPackage();
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [studentList, setStudentList] = useState<UserResponse>([]);
    const [reportData, setReportData] = useState<LearnersReportResponse>();
    const [slideData, setSlideData] = useState<SlideData[]>();
    const [searchTerm, setSearchTerm] = useState('');
    const filteredStudents = studentList.filter((student) =>
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const search = useSearch({ from: Route.id });

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            course: '',
            session: '',
            level: '',
            student: '',
            startDate: '',
            endDate: '',
        },
    });

    const selectedCourse = watch('course');
    const selectedSession = watch('session');
    const selectedLevel = watch('level');
    const selectedStudent = watch('student');
    const startDate = watch('startDate');
    const endDate = watch('endDate');

    useEffect(() => {
        if (selectedCourse) {
            setSessionList(getSessionFromPackage({ courseId: selectedCourse }));
            setValue('session', '');
        } else {
            setSessionList([]);
            setStudentList([]);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (selectedSession === '') {
            setValue('level', '');
            setLevelList([]);
            setStudentList([]);
        } else if (selectedCourse && selectedSession) {
            setLevelList(
                getLevelsFromPackage2({ courseId: selectedCourse, sessionId: selectedSession })
            );
        }
    }, [selectedSession]);

    const { data } = useLearnerDetails(
        // const { data, isLoading, error } = useLearnerDetails(
        getPackageSessionId({
            courseId: selectedCourse,
            sessionId: selectedSession,
            levelId: selectedLevel,
        }) || '',
        INSTITUTE_ID || ''
    );
    useEffect(() => {
        if (data) {
            setStudentList(data);
        }
    }, [data]);

    const onSubmit = (data: FormValues) => {
        generateReportMutation.mutate(
            {
                start_date: data.startDate,
                end_date: data.endDate,
                package_session_id:
                    getPackageSessionId({
                        courseId: data.course,
                        sessionId: data.session,
                        levelId: data.level,
                    }) || '',
                user_id: data.student,
            },
            {
                onSuccess: (data) => {
                    setReportData(data);
                },
                onError: (error) => {
                    console.error('Error:', error);
                },
            }
        );
        generateSlideMutation.mutate(
            {
                start_date: data.startDate,
                end_date: data.endDate,
                package_session_id:
                    getPackageSessionId({
                        courseId: data.course,
                        sessionId: data.session,
                        levelId: data.level,
                    }) || '',
                user_id: data.student,
            },
            {
                onSuccess: (data) => {
                    setSlideData(data);
                },
                onError: (error) => {
                    console.error('Error:', error);
                },
            }
        );
        // api call
    };

    const getBatchReportDataPDF = useMutation({
        mutationFn: () =>
            exportLearnersReport({
                startDate: startDate,
                endDate: endDate,
                packageSessionId:
                    getPackageSessionId({
                        courseId: selectedCourse,
                        sessionId: selectedSession,
                        levelId: selectedLevel,
                    }) || '',
                userId: selectedStudent,
            }),
        onSuccess: async (response) => {
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `learners_report.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Learners Report PDF exported successfully');
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleExportPDF = () => {
        getBatchReportDataPDF.mutate();
    };

    const tableData = {
        content: reportData ? transformLearnersReport(reportData) : [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: true,
    };
    const generateReportMutation = useMutation({ mutationFn: fetchLearnersReport });
    const generateSlideMutation = useMutation({ mutationFn: fetchSlideWiseProgress });
    const { isPending, error } = generateReportMutation;
    const isExporting = getBatchReportDataPDF.isPending;

    return (
        <div className="mt-10 flex flex-col gap-10">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex flex-row items-center justify-between">
                    <div>
                        <div>Course</div>
                        <Select
                            onValueChange={(value) => {
                                setValue('course', value);
                            }}
                            {...register('course')}
                            defaultValue={search.studentReport ? search.studentReport.courseId : ''}
                        >
                            <SelectTrigger className="h-[40px] w-[320px]">
                                <SelectValue placeholder="Select a Course" />
                            </SelectTrigger>
                            <SelectContent>
                                {courseList?.map((course) => (
                                    <SelectItem key={course.id} value={course.id}>
                                        {course.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <div>Session</div>
                        <Select
                            onValueChange={(value) => {
                                setValue('session', value);
                            }}
                            {...register('session')}
                            defaultValue={
                                search.studentReport ? search.studentReport.sessionId : ''
                            }
                            disabled={!sessionList.length}
                            value={selectedSession}
                        >
                            <SelectTrigger className="h-[40px] w-[320px]">
                                <SelectValue placeholder="Select a Session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessionList?.map((session) => (
                                    <SelectItem key={session.id} value={session.id}>
                                        {session.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <div>Level</div>
                        <Select
                            onValueChange={(value) => {
                                setValue('level', value);
                            }}
                            defaultValue={search.studentReport ? search.studentReport.levelId : ''}
                            value={selectedLevel}
                            disabled={!levelList.length}
                            {...register('level')}
                        >
                            <SelectTrigger className="h-[40px] w-[320px]">
                                <SelectValue placeholder="Select a Level" />
                            </SelectTrigger>
                            <SelectContent>
                                {levelList?.map((level) => (
                                    <SelectItem key={level.id} value={level.id}>
                                        {level.level_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <div>Learner Name</div>
                    <Select
                        onValueChange={(value) => {
                            setValue('student', value);
                        }}
                        {...register('student')}
                        defaultValue=""
                        disabled={!studentList.length}
                    >
                        <SelectTrigger className="h-[40px] w-[320px]">
                            <SelectValue placeholder="Select Student" />
                        </SelectTrigger>
                        <SelectContent>
                            <Command>
                                {/* Search Input */}
                                <CommandInput
                                    placeholder="Search Student..."
                                    value={searchTerm}
                                    onValueChange={setSearchTerm}
                                />
                                <CommandList>
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents?.map((student, index) => (
                                            <SelectItem
                                                key={index}
                                                value={student.user_id}
                                                onSelect={() =>
                                                    setValue('student', student.user_id)
                                                }
                                            >
                                                {student.full_name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-gray-500">No students found</div>
                                    )}
                                </CommandList>
                            </Command>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-row items-end justify-between gap-4">
                    <div>
                        <div>Start Date</div>
                        <input
                            className="h-[40px] w-[320px] rounded-md border px-3 py-[10px]"
                            type="date"
                            {...register('startDate')}
                        />
                    </div>
                    <div>
                        <div>End Date</div>
                        <input
                            className="h-[40px] w-[320px] rounded-md border px-3 py-[10px]"
                            type="date"
                            {...register('endDate')}
                        />
                    </div>
                    <div>
                        <MyButton buttonType="secondary">Generate Report</MyButton>
                    </div>
                </div>

                {/* Error Message at One Place */}
                {Object.keys(errors).length > 0 && (
                    <div className="mt-4 text-red-500">
                        <h4 className="font-semibold">Please fix the following errors:</h4>
                        <ul className="ml-4 list-disc">
                            {Object.entries(errors)?.map(([key, error]) => (
                                <li key={key}>{error.message}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </form>
            {isPending && <DashboardLoader height="10vh" />}
            {reportData && <div className="border"></div>}
            {reportData && (
                <div className="flex flex-col gap-10">
                    <div className="flex flex-row justify-between gap-10">
                        <div className="flex flex-col gap-6">
                            <div className="text-h3 text-primary-500">
                                {studentList.find((s) => s.user_id === selectedStudent)?.full_name}
                            </div>
                            <div>{`Date ${startDate} - ${endDate}`}</div>
                        </div>
                        <div className="flex flex-row gap-10">
                            <ReportRecipientsDialogBox userId={selectedStudent} />
                            <MyButton
                                buttonType="secondary"
                                onClick={() => {
                                    handleExportPDF();
                                }}
                            >
                                {isExporting ? <DashboardLoader size={20} /> : 'Export'}
                            </MyButton>
                        </div>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">Course Completed</div>
                            <div>
                                {`${formatToTwoDecimalPlaces(
                                    reportData?.learner_progress_report?.percentage_course_completed
                                )} %`}
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">Daily Time spent (Avg)</div>
                            <div>
                                {convertMinutesToTimeFormat(
                                    reportData?.learner_progress_report?.avg_time_spent_in_minutes
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">Concentration score (Avg)</div>
                            <div>
                                {`${formatToTwoDecimalPlaces(
                                    reportData?.learner_progress_report
                                        ?.percentage_concentration_score || 0
                                )} %`}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">Course Completed by batch</div>
                            <div>
                                {`${formatToTwoDecimalPlaces(
                                    reportData?.batch_progress_report?.percentage_course_completed
                                )} %`}
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">
                                Daily Time spent by batch (Avg)
                            </div>
                            <div>
                                {convertMinutesToTimeFormat(
                                    reportData?.batch_progress_report?.avg_time_spent_in_minutes
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">
                                Concentration score of batch (Avg)
                            </div>
                            <div>
                                {`${formatToTwoDecimalPlaces(
                                    reportData?.batch_progress_report
                                        ?.percentage_concentration_score || 0
                                )} %`}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="text-h3 font-[600] text-primary-500">
                            Daily Learning Performance
                        </div>
                        <div className="flex h-[570px] w-full flex-row gap-6">
                            <LineChartComponent
                                chartData={transformToChartData(reportData)}
                            ></LineChartComponent>
                            <div className="h-full w-[35%]">
                                <MyTable
                                    data={tableData}
                                    columns={learnersReportColumns}
                                    isLoading={isPending}
                                    error={error}
                                    columnWidths={LEARNERS_REPORTS_COLUMNS}
                                    currentPage={0}
                                    scrollable={true}
                                    className="!h-full"
                                ></MyTable>
                            </div>
                        </div>
                    </div>
                    {slideData && (
                        <div className="flex flex-col gap-6">
                            <div className="text-h3 font-[600] text-primary-500">
                                Learning Timeline
                            </div>
                            {slideData?.map((slide, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                    <div className="flex flex-row gap-1 font-[600]">
                                        Date:{' '}
                                        <div className="text-primary-500">
                                            {dayjs(slide.date).format('DD-MM-YYYY')}
                                        </div>
                                    </div>
                                    <MyTable
                                        data={{
                                            content: slide.slide_details?.map((slide) => ({
                                                study_slide: slide.slide_title,
                                                subject: slide.subject_name,
                                                module: slide.module_name,
                                                chapter: slide.chapter_name,
                                                concentration_score: `${slide.concentration_score.toFixed(
                                                    2
                                                )} %`, // Formatting as string
                                                time_spent: convertMinutesToTimeFormat(
                                                    parseFloat(slide.time_spent)
                                                ),
                                            })),
                                            total_pages: 0,
                                            page_no: 0,
                                            page_size: 10,
                                            total_elements: 0,
                                            last: true,
                                        }}
                                        columns={SlidesColumns}
                                        isLoading={isPending}
                                        error={error}
                                        columnWidths={SLIDES_WIDTH}
                                        currentPage={0}
                                        // className="!h-full"
                                    ></MyTable>
                                </div>
                            ))}
                            {/* <MyPagination
                                currentPage={currPage}
                                totalPages={totalPage}
                                onPageChange={setCurrPage}
                            ></MyPagination> */}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
