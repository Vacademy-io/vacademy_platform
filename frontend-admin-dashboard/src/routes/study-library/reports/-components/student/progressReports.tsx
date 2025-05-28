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
import { useLearnerDetails, UserResponse } from '../../-store/useLearnersDetails';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { MyTable } from '@/components/design-system/table';
import {
    SubjectProgressResponse,
    SubjectOverviewColumns,
    SUBJECT_OVERVIEW_WIDTH,
    SubjectOverviewColumnType,
} from '../../-types/types';
import {
    fetchLearnersSubjectWiseProgress,
    exportLearnersSubjectReport,
} from '../../-services/utils';
import { useMutation } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { usePacageDetails } from '../../-store/usePacageDetails';
import { convertMinutesToTimeFormat } from '../../-services/helper';
import { useSearch } from '@tanstack/react-router';
import { Route } from '@/routes/study-library/reports';
import { toast } from 'sonner';

const formSchema = z.object({
    course: z.string().min(1, 'Course is required'),
    session: z.string().min(1, 'Session is required'),
    level: z.string().min(1, 'Level is required'),
    student: z.string().min(1, 'Level is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProgressReports() {
    const {
        getCourseFromPackage,
        getSessionFromPackage,
        getLevelsFromPackage2,
        getPackageSessionId,
    } = useInstituteDetailsStore();
    const { setPacageSessionId, setCourse, setSession, setLevel } = usePacageDetails();

    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const courseList = getCourseFromPackage();
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [studentList, setStudentList] = useState<UserResponse>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [subjectReportData, setSubjectReportData] = useState<SubjectProgressResponse>();
    const tableState = { columnVisibility: { module_id: false, user_id: false } };
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
        },
    });

    const selectedCourse = watch('course');
    const selectedSession = watch('session');
    const selectedLevel = watch('level');
    const selectedStudent = watch('student');

    const { data } = useLearnerDetails(
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

    const SubjectWiseMutation = useMutation({
        mutationFn: fetchLearnersSubjectWiseProgress,
    });
    const { isPending, error } = SubjectWiseMutation;

    const onSubmit = (data: FormValues) => {
        SubjectWiseMutation.mutate(
            {
                packageSessionId:
                    getPackageSessionId({
                        courseId: data.course,
                        sessionId: data.session,
                        levelId: data.level,
                    }) || '',
                userId: data.student,
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

    const getBatchReportDataPDF = useMutation({
        mutationFn: () =>
            exportLearnersSubjectReport({
                startDate: '',
                endDate: '',
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

    const transformToSubjectOverview = (
        data: SubjectProgressResponse,
        user_id: string
    ): SubjectOverviewColumnType[] => {
        return data.flatMap((subject) =>
            subject.modules.map((module) => ({
                subject: subject.subject_name,
                module: module.module_name,
                module_id: module.module_id,
                module_completed: `${module.module_completion_percentage}%`,
                module_completed_by_batch: `${module.module_completion_percentage}%`,
                average_time_spent: `${convertMinutesToTimeFormat(module.avg_time_spent_minutes)}`,
                average_time_spent_by_batch: `${convertMinutesToTimeFormat(
                    module.avg_time_spent_minutes
                )}`,
                user_id,
            }))
        );
    };

    const subjectWiseData = {
        content: subjectReportData
            ? transformToSubjectOverview(subjectReportData, watch('student'))
            : [],
        total_pages: 0,
        page_no: 0,
        page_size: 10,
        total_elements: 0,
        last: false,
    };
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
                                {courseList.map((course) => (
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
                                console.log('here');
                                setValue('session', value);
                            }}
                            defaultValue={
                                search.studentReport ? search.studentReport.sessionId : ''
                            }
                            value={selectedSession}
                            disabled={!sessionList.length}
                        >
                            <SelectTrigger className="h-[40px] w-[320px]">
                                <SelectValue placeholder="Select a Session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessionList.map((session) => (
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
                                {levelList.map((level) => (
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
                                        filteredStudents.map((student, index) => (
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
                        <MyButton buttonType="secondary">Generate Report</MyButton>
                    </div>
                </div>

                {/* Error Message at One Place */}
                {Object.keys(errors).length > 0 && (
                    <div className="mt-4 text-red-500">
                        <h4 className="font-semibold">Please fix the following errors:</h4>
                        <ul className="ml-4 list-disc">
                            {Object.entries(errors).map(([key, error]) => (
                                <li key={key}>{error.message}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </form>
            {isPending && <DashboardLoader height="10vh" />}
            {subjectReportData && <div className="border"></div>}
            {subjectReportData && !isPending && (
                <div className="flex flex-col gap-10">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-row justify-between gap-10">
                            <div className="flex flex-col gap-6">
                                <div className="text-h3 text-primary-500">
                                    {
                                        studentList.find((s) => s.user_id === selectedStudent)
                                            ?.full_name
                                    }
                                </div>
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
                            <div>
                                Course:{' '}
                                {courseList.find((course) => course.id === selectedCourse)?.name}
                            </div>
                            <div>
                                Session:{' '}
                                {
                                    sessionList.find((session) => session.id === selectedSession)
                                        ?.name
                                }
                            </div>
                            <div>
                                Level:{' '}
                                {levelList.find((level) => level.id === selectedLevel)?.level_name}
                            </div>
                        </div>
                        <div className="flex flex-col justify-between gap-6">
                            <div className="text-h3 text-primary-500">Subject-wise Overview</div>
                            <MyTable
                                data={subjectWiseData}
                                columns={SubjectOverviewColumns}
                                isLoading={isPending}
                                error={error}
                                columnWidths={SUBJECT_OVERVIEW_WIDTH}
                                currentPage={0}
                                tableState={tableState}
                            ></MyTable>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
