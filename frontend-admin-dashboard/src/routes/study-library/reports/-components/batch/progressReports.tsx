import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { useState, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LevelType } from "@/schemas/student/student-list/institute-schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MyButton } from "@/components/design-system/button";
import { fetchSubjectWiseProgress } from "../../-services/utils";
import {
    SubjectProgressResponse,
    SubjectOverviewBatchColumns,
    SUBJECT_OVERVIEW_BATCH_WIDTH,
    SubjectOverviewBatchColumnType,
} from "../../-types/types";
import { useMutation } from "@tanstack/react-query";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { MyTable } from "@/components/design-system/table";
import { usePacageDetails } from "../../-store/usePacageDetails";

const formSchema = z.object({
    course: z.string().min(1, "Course is required"),
    session: z.string().min(1, "Session is required"),
    level: z.string().min(1, "Level is required"),
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
    const courseList = getCourseFromPackage();
    const [sessionList, setSessionList] = useState<{ id: string; name: string }[]>([]);
    const [levelList, setLevelList] = useState<LevelType[]>([]);
    const [subjectReportData, setSubjectReportData] = useState<SubjectProgressResponse>();
    const tableState = { columnVisibility: { module_id: false, user_id: false } };
    const { register, handleSubmit, setValue, watch, trigger } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            course: "",
            session: "",
            level: "",
        },
    });
    const selectedCourse = watch("course");
    const selectedSession = watch("session");
    const selectedLevel = watch("level");
    const transformToSubjectOverview = (
        data: SubjectProgressResponse,
    ): SubjectOverviewBatchColumnType[] => {
        return data.flatMap((subject) => {
            return subject.modules.map((module, index) => ({
                subject: index === 0 ? subject.subject_name : "", // Only first row gets the subject name
                module: module.module_name,
                module_id: module.module_id,
                module_completed_by_batch: `${module.module_completion_percentage}%`,
                average_time_spent_by_batch: `${module.avg_time_spent_minutes.toFixed(2)} min`,
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

    useEffect(() => {
        if (selectedCourse) {
            setSessionList(getSessionFromPackage({ courseId: selectedCourse }));
            setValue("session", "");
        } else {
            setSessionList([]);
        }
    }, [selectedCourse]);

    useEffect(() => {
        if (selectedSession === "") {
            setValue("level", "");
            setLevelList([]);
        } else if (selectedCourse && selectedSession) {
            setLevelList(
                getLevelsFromPackage2({ courseId: selectedCourse, sessionId: selectedSession }),
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
                    }) || "",
            },
            {
                onSuccess: (data) => {
                    setSubjectReportData(data);
                },
                onError: (error) => {
                    console.error("Error:", error);
                },
            },
        );
        setCourse(courseList.find((course) => (course.id = data.course))?.name || "");
        setSession(sessionList.find((course) => (course.id = data.session))?.name || "");
        setLevel(levelList.find((course) => (course.id = data.level))?.level_name || "");
        setPacageSessionId(
            getPackageSessionId({
                courseId: data.course,
                sessionId: data.session,
                levelId: data.level,
            }) || "",
        );
    };

    return (
        <div className="mt-10 flex flex-col gap-10">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex flex-row items-center justify-between">
                    <div>
                        <div>Course</div>
                        <Select
                            onValueChange={(value) => {
                                setValue("course", value);
                            }}
                            {...register("course")}
                            defaultValue=""
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
                                setValue("session", value);
                            }}
                            {...register("session")}
                            defaultValue=""
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
                                setValue("level", value);
                                trigger("level");
                            }}
                            defaultValue=""
                            value={selectedLevel}
                            disabled={!levelList.length}
                            {...register("level")}
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

                <div className="flex flex-row items-end justify-between gap-4">
                    <div>
                        <MyButton buttonType="secondary">Generate Report</MyButton>
                    </div>
                </div>
                {/* <FormMessage/> */}
            </form>
            {isPending && <DashboardLoader height="10vh" />}
            {subjectReportData && !isPending && <div className="border"></div>}
            {subjectReportData && (
                <div className="flex flex-col gap-10">
                    <div className="flex flex-row justify-between gap-10">
                        <div className="flex flex-col gap-6">
                            <div className="text-h3 text-primary-500">
                                {courseList.find((course) => (course.id = selectedCourse))?.name}
                            </div>
                        </div>
                        <MyButton buttonType="secondary">Export</MyButton>
                    </div>
                    <div className="flex flex-col justify-between gap-6">
                        <div className="text-h3 text-primary-500">Subject-wise Overview</div>
                        <MyTable
                            data={subjectWiseData}
                            columns={SubjectOverviewBatchColumns}
                            isLoading={isPending}
                            error={error}
                            columnWidths={SUBJECT_OVERVIEW_BATCH_WIDTH}
                            currentPage={0}
                            tableState={tableState}
                        ></MyTable>
                    </div>
                </div>
            )}
        </div>
    );
}
