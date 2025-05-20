import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
import { useState, useEffect, useRef } from "react";
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
import { LineChartComponent } from "./lineChart";
import { MyTable } from "@/components/design-system/table";
import { useMutation } from "@tanstack/react-query";
import { fetchBatchReport, fetchLeaderboardData, exportBatchReport } from "../../-services/utils";
import {
    DailyLearnerTimeSpent,
    BatchReportResponse,
    activityLogColumns,
    CONCENTRATION_SCORE,
    leaderBoardColumns,
    LEADERBOARD_WIDTH,
    LeaderBoardColumnType,
} from "../../-types/types";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import dayjs from "dayjs";
import { MyPagination } from "@/components/design-system/pagination";
import { formatToTwoDecimalPlaces, convertMinutesToTimeFormat } from "../../-services/helper";
import { usePacageDetails } from "../../-store/usePacageDetails";
import { toast } from "sonner";

const formSchema = z
    .object({
        course: z.string().min(1, "Course is required"),
        session: z.string().min(1, "Session is required"),
        level: z.string().min(1, "Level is required"),
        startDate: z.string().min(1, "Start Date is required"),
        endDate: z.string().min(1, "End Date is required"),
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
                "The difference between Start Date and End Date should be less than one month.",
            path: ["startDate"],
        },
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
    const [defaultSessionLevels, setDefaultSessionLevels] = useState(false);

    const selectRef = useRef<HTMLDivElement | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            course: "",
            session: "",
            level: "",
            startDate: "",
            endDate: "",
        },
    });

    const selectedCourse = watch("course");
    const selectedSession = watch("session");
    const selectedLevel = watch("level");
    const startDate = watch("startDate");
    const endDate = watch("endDate");

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
    useEffect(() => {
        if (sessionList?.length === 1 && sessionList[0]?.id === "DEFAULT") {
            setValue("session", "DEFAULT");
            setValue("level", "DEFAULT");
            setDefaultSessionLevels(true);
        } else {
            setDefaultSessionLevels(false);
            setValue("session", "select level");
            selectRef.current = null;
            setValue("level", "select level");
        }
    }, [sessionList]);

    useEffect(() => {
        leaderboardMutation.mutate(
            {
                body: {
                    start_date: startDate,
                    end_date: endDate,
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
                    console.error("Error:", error);
                    setLoading(false);
                },
            },
        );
    }, [currPage]);

    const getBatchReportDataPDF = useMutation({
        mutationFn: () =>
            exportBatchReport({
                startDate: startDate,
                endDate: endDate,
                packageSessionId:
                    getPackageSessionId({
                        courseId: selectedCourse,
                        sessionId: selectedSession,
                        levelId: selectedLevel,
                    }) || "",
                userId: "",
            }),
        onSuccess: async (response) => {
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `batch_report.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Batch Report PDF exported successfully");
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
        generateReportMutation.mutate(
            {
                start_date: data.startDate,
                end_date: data.endDate,
                // package_session_id: "aec81215-33b6-4af7-9b7e-ebee99e9d18b",
                package_session_id:
                    getPackageSessionId({
                        courseId: data.course,
                        sessionId: data.session,
                        levelId: data.level,
                    }) || "",
            },
            {
                onSuccess: (data) => {
                    setReportData(data);
                    setLoading(false);
                },
                onError: (error) => {
                    console.error("Error:", error);
                    setLoading(false);
                },
            },
        );
        leaderboardMutation.mutate(
            {
                body: {
                    start_date: data.startDate,
                    end_date: data.endDate,
                    package_session_id:
                        getPackageSessionId({
                            courseId: data.course,
                            sessionId: data.session,
                            levelId: data.level,
                        }) || "",
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
                    console.error("Error:", error);
                    setLoading(false);
                },
            },
        );
        setPacageSessionId(
            getPackageSessionId({
                courseId: data.course,
                sessionId: data.session,
                levelId: data.level,
            }) || "",
        );
        // api call
    };

    const convertFormat = (data: DailyLearnerTimeSpent[] | undefined) => {
        if (!data) return []; // Return an empty array if data is undefined

        return data.map((item) => ({
            date: dayjs(item.activity_date).format("DD/MM/YYYY"),
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
        <div className="mt-10 flex flex-col gap-10">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex flex-row items-center justify-between">
                    <div>
                        <div>
                            Course <span className="text-red-600">*</span>
                        </div>
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

                    {!defaultSessionLevels && (
                        <div>
                            <div>
                                Session <span className="text-red-600">*</span>
                            </div>
                            <Select
                                // value={watch("session") === "" ? null : watch("session")}
                                onValueChange={(value) => {
                                    setValue("session", value);
                                }}
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
                    )}

                    {!defaultSessionLevels && (
                        <div>
                            <div>
                                Level <span className="text-red-600">*</span>
                            </div>
                            <Select
                                onValueChange={(value) => {
                                    setValue("level", value);
                                }}
                                defaultValue=""
                                value={selectedLevel}
                                disabled={!levelList.length}
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
                    )}
                </div>

                <div className="flex flex-row items-end justify-between gap-4">
                    <div>
                        <div>
                            Start Date <span className="text-red-600">*</span>
                        </div>
                        <input
                            className="h-[40px] w-[320px] rounded-md border px-3 py-[10px]"
                            type="date"
                            {...register("startDate")}
                        />
                    </div>
                    <div>
                        <div>
                            End Date <span className="text-red-600">*</span>
                        </div>
                        <input
                            className="h-[40px] w-[320px] rounded-md border px-3 py-[10px]"
                            type="date"
                            {...register("endDate")}
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
                            {Object.entries(errors).map(([key, error]) => (
                                <li key={key}>{error.message}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </form>
            {loading && <DashboardLoader height="10vh" />}
            {reportData && !loading && <div className="border"></div>}
            {reportData && !loading && (
                <div className="flex flex-col gap-10">
                    <div className="flex flex-row justify-between gap-10">
                        <div className="flex flex-col gap-6">
                            <div className="text-h3 text-primary-500">
                                {courseList.find((c) => c.id === selectedCourse)?.name}
                            </div>
                            <div>{`Date ${startDate} - ${endDate}`}</div>
                        </div>
                        <MyButton
                            buttonType="secondary"
                            onClick={() => {
                                handleExportPDF();
                            }}
                        >
                            {isExporting ? <DashboardLoader size={20} /> : "Export"}
                        </MyButton>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">Course Completed by batch</div>
                            <div>{`${formatToTwoDecimalPlaces(
                                reportData?.percentage_course_completed,
                            )} %`}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">
                                Daily Time spent by batch (Avg)
                            </div>
                            <div>
                                {convertMinutesToTimeFormat(reportData?.avg_time_spent_in_minutes)}
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="text-h3 font-[600]">
                                Concentration score of batch (Avg)
                            </div>
                            <div>{`${formatToTwoDecimalPlaces(
                                reportData?.percentage_concentration_score || 0,
                            )} %`}</div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="text-h3 font-[600] text-primary-500">
                            Daily Learning Performance
                        </div>
                        <div className="flex h-[570px] w-full flex-row gap-6">
                            <LineChartComponent
                                chartData={convertChartData(reportData.daily_time_spent)}
                            />
                            <div className="h-full w-[30%]">
                                <MyTable
                                    data={tableData}
                                    columns={activityLogColumns}
                                    isLoading={isPending}
                                    error={error}
                                    columnWidths={CONCENTRATION_SCORE}
                                    currentPage={0}
                                    scrollable={true}
                                    className="!h-full"
                                ></MyTable>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="text-h3 font-[600] text-primary-500">Leaderboard</div>
                        <MyTable
                            data={leaderBoardData}
                            columns={leaderBoardColumns}
                            isLoading={isPending}
                            error={error}
                            columnWidths={LEADERBOARD_WIDTH}
                            currentPage={0}
                            // className="!h-full"
                        ></MyTable>
                        <MyPagination
                            currentPage={currPage}
                            totalPages={totalPage}
                            onPageChange={setCurrPage}
                        ></MyPagination>
                    </div>
                </div>
            )}
        </div>
    );
}
