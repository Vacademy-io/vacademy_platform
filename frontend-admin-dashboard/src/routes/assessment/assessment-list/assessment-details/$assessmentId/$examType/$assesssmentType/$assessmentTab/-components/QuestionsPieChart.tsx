import { Pie, PieChart } from "recharts";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { DotOutline } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetOverviewData } from "../-services/assessment-details-services";
import { Route } from "..";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { convertToLocalDateTime, getInstituteId } from "@/constants/helper";
import { useInstituteQuery } from "@/services/student-list-section/getInstituteDetails";
import { getSubjectNameById } from "@/routes/assessment/question-papers/-utils/helper";
import { AssessmentOverviewDataInterface } from "@/types/assessment-overview";
import AssessmentStudentLeaderboard from "./AssessmentStudentLeaderboard";

const chartConfig = {
    ongoing: {
        label: "Ongoing",
        color: "hsl(var(--chart-2))",
    },
    pending: {
        label: "Pending",
        color: "hsl(var(--chart-3))",
    },
    attempted: {
        label: "Attempted",
        color: "hsl(var(--chart-4))",
    },
} satisfies ChartConfig;

export function AssessmentDetailsPieChart({
    assessmentOverviewData,
}: {
    assessmentOverviewData: AssessmentOverviewDataInterface;
}) {
    const chartData = [
        {
            browser: "ongoing",
            visitors: assessmentOverviewData.total_ongoing,
            fill: "#97D4B4",
        },
        {
            browser: "pending",
            visitors:
                assessmentOverviewData.total_participants -
                (assessmentOverviewData.total_ongoing + assessmentOverviewData.total_attempted),
            fill: "#FAD6AE",
        },
        {
            browser: "attempted",
            visitors: assessmentOverviewData.total_attempted,
            fill: "#E5F5EC",
        },
    ];
    return (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px]">
            <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={chartData} dataKey="visitors" nameKey="browser" />
            </PieChart>
        </ChartContainer>
    );
}

export function QuestionsPieChart() {
    const instituteId = getInstituteId();
    const { assessmentId, examType } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data, isLoading } = useSuspenseQuery(
        handleGetOverviewData({ assessmentId, instituteId }),
    );

    if (isLoading) return <DashboardLoader />;
    return (
        <div className="mt-8 flex w-full gap-16">
            {/* Assessment Overview Pie Chart Graph */}
            <div className="flex w-1/2 flex-col gap-8">
                <div className="flex justify-between text-[14px]">
                    <div className="flex flex-col gap-6">
                        <p>
                            <span className="font-normal text-black">Created on: </span>
                            <span>
                                {convertToLocalDateTime(data.assessment_overview_dto.created_on)}
                            </span>
                        </p>
                        {(examType === "EXAM" || examType === "SURVEY") && (
                            <>
                                <p>
                                    <span className="font-normal text-black">
                                        Start Date and Time:{" "}
                                    </span>
                                    <span>
                                        {convertToLocalDateTime(
                                            data.assessment_overview_dto.start_date_and_time,
                                        )}
                                    </span>
                                </p>
                                <p>
                                    <span className="font-normal text-black">
                                        End Date and Time:{" "}
                                    </span>
                                    <span>
                                        {convertToLocalDateTime(
                                            data.assessment_overview_dto.end_date_and_time,
                                        )}
                                    </span>
                                </p>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-6">
                        <p>
                            <span className="font-normal text-black">Subject: </span>
                            <span>
                                {getSubjectNameById(
                                    instituteDetails?.subjects || [],
                                    data.assessment_overview_dto.subject_id || "",
                                )}
                            </span>
                        </p>
                        {(examType === "EXAM" || examType === "MOCK") && (
                            <p>
                                <span className="font-normal text-black">Duration: </span>
                                {data.assessment_overview_dto.duration_in_min >= 60 ? (
                                    <span>
                                        {(
                                            data.assessment_overview_dto.duration_in_min / 60
                                        ).toFixed(2)}{" "}
                                        hrs
                                    </span>
                                ) : (
                                    <span>{data.assessment_overview_dto.duration_in_min} min</span>
                                )}
                            </p>
                        )}
                        <p>
                            <span className="font-normal text-black">Total Participants: </span>
                            <span>{data.assessment_overview_dto.total_participants}</span>
                        </p>
                    </div>
                </div>
                <div className="flex justify-evenly">
                    <div className="flex flex-col text-center">
                        <p className="text-neutral-500">Avg. Duration</p>
                        <p className="text-center text-3xl font-semibold text-primary-500">
                            {(
                                Math.floor(data.assessment_overview_dto.average_duration) / 60
                            ).toFixed(2)}{" "}
                            min
                        </p>
                    </div>
                    <div className="flex flex-col">
                        <p className="text-neutral-500">Avg. Marks</p>
                        <p className="text-center text-3xl font-semibold text-primary-500">
                            {data.assessment_overview_dto.average_marks.toFixed(2)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center">
                    <AssessmentDetailsPieChart
                        assessmentOverviewData={data.assessment_overview_dto}
                    />
                    <div className="flex flex-col">
                        <div className="flex items-center">
                            <DotOutline size={40} weight="fill" className="text-success-400" />
                            <p className="text-[14px]">
                                Ongoing ({data.assessment_overview_dto.total_ongoing})
                            </p>
                        </div>
                        <div className="flex items-center">
                            <DotOutline size={40} weight="fill" className="text-primary-200" />
                            <p className="text-[14px]">
                                Pending (
                                {data.assessment_overview_dto.total_participants -
                                    (data.assessment_overview_dto.total_ongoing +
                                        data.assessment_overview_dto.total_attempted)}
                                )
                            </p>
                        </div>
                        <div className="flex items-center">
                            <DotOutline size={40} weight="fill" className="text-success-100" />
                            <p className="text-[14px]">
                                Attempted ({data.assessment_overview_dto.total_attempted})
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Assessment Student Leaderboard */}
            <AssessmentStudentLeaderboard />
        </div>
    );
}
