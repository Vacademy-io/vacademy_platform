import { TestContent } from "@/types/assessments/schedule-test-list";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DotIcon, DotIconOffline } from "@/svgs";
import { CheckCircle, LockSimple, PauseCircle } from "phosphor-react";
import { convertToLocalDateTime } from "@/constants/helper";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useInstituteQuery } from "@/services/student-list-section/getInstituteDetails";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { ScheduleTestMainDropdownComponent } from "./ScheduleTestDetailsDropdownMenu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getSubjectNameById } from "@/routes/assessment/question-papers/-utils/helper";
import { getBatchNamesByIds } from "@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-utils/helper";
import { ReverseProgressBar } from "@/components/ui/progress";

const ScheduleTestDetails = ({
    scheduleTestContent,
    selectedTab,
    handleRefetchData,
}: {
    scheduleTestContent: TestContent;
    selectedTab: string;
    handleRefetchData: () => void;
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const navigate = useNavigate();
    const { data: instituteDetails, isLoading } = useSuspenseQuery(useInstituteQuery());
    const batchIdsList = getBatchNamesByIds(
        instituteDetails?.batches_for_sessions,
        scheduleTestContent.batch_ids,
    );
    const handleNavigateAssessment = (assessmentId: string) => {
        if (!isDialogOpen) {
            navigate({
                to: "/evaluation/evaluations/assessment-details/$assessmentId/$examType/$assesssmentType",
                params: {
                    assessmentId: assessmentId,
                    examType: scheduleTestContent.play_mode,
                    assesssmentType: scheduleTestContent.assessment_visibility,
                },
            });
        }
    };

    if (isLoading) return <DashboardLoader />;
    return (
        <div
            className="my-6 flex cursor-pointer flex-col gap-4 rounded-xl border bg-neutral-50 p-4"
            onClick={() => handleNavigateAssessment(scheduleTestContent.assessment_id)}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="font-semibold">{scheduleTestContent.name}</h1>
                    <Badge
                        className={`rounded-md border border-neutral-300 ${
                            scheduleTestContent.assessment_visibility === "PRIVATE"
                                ? "bg-primary-50"
                                : "bg-info-50"
                        } py-1.5 shadow-none`}
                    >
                        <LockSimple size={16} className="mr-2" />
                        {scheduleTestContent.assessment_visibility}
                    </Badge>
                    <Badge
                        className={`rounded-md border border-neutral-300 ${
                            scheduleTestContent.play_mode !== "EXAM"
                                ? "bg-neutral-50"
                                : "bg-success-50"
                        } py-1.5 shadow-none`}
                    >
                        {scheduleTestContent.play_mode === "EXAM" ? (
                            <DotIcon className="mr-2" />
                        ) : (
                            <DotIconOffline className="mr-2" />
                        )}
                        {scheduleTestContent.play_mode}
                    </Badge>
                    <Separator orientation="vertical" className="h-8 w-px bg-neutral-300" />
                    <Badge
                        className={`rounded-md border ${
                            scheduleTestContent.status === "PUBLISHED"
                                ? "bg-success-50"
                                : "bg-neutral-100"
                        } border-neutral-300 py-1.5 shadow-none`}
                    >
                        {scheduleTestContent.status === "PUBLISHED" ? (
                            <CheckCircle
                                size={16}
                                weight="fill"
                                className="mr-2 text-success-600"
                            />
                        ) : (
                            <PauseCircle
                                size={16}
                                weight="fill"
                                className="mr-2 text-neutral-400"
                            />
                        )}
                        {scheduleTestContent.status}
                    </Badge>
                </div>
                <div className="flex items-center gap-4">
                    {batchIdsList.length > 0 && (
                        <Badge className="rounded-md border border-primary-200 bg-primary-50 py-1.5 shadow-none">
                            {batchIdsList[0]}
                        </Badge>
                    )}
                    {batchIdsList.length - 1 > 0 && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger onClick={(e) => e.stopPropagation()}>
                                <span className="text-sm text-primary-500">
                                    +{batchIdsList.length - 1} more
                                </span>
                            </DialogTrigger>
                            <DialogContent className="p-0">
                                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                                    Assessment Batches
                                </h1>
                                <ul className="flex list-disc flex-col gap-4 pb-4 pl-8 pr-4">
                                    {batchIdsList.map((batchId, idx) => {
                                        if (idx === 0) return null;
                                        return <li key={idx}>{batchId}</li>;
                                    })}
                                </ul>
                            </DialogContent>
                        </Dialog>
                    )}
                    <ScheduleTestMainDropdownComponent
                        scheduleTestContent={scheduleTestContent}
                        selectedTab={selectedTab}
                        handleRefetchData={handleRefetchData}
                    />
                </div>
            </div>
            <div className="flex w-full items-start justify-start gap-8 text-sm text-neutral-500">
                <div className="flex flex-col gap-4">
                    <p>Created on: {convertToLocalDateTime(scheduleTestContent.created_at)}</p>
                    <p>
                        Subject:{" "}
                        {getSubjectNameById(
                            instituteDetails?.subjects || [],
                            scheduleTestContent.subject_id || "",
                        )}
                    </p>
                </div>
                <div className="flex flex-col gap-4">
                    {(scheduleTestContent.play_mode === "EXAM" ||
                        scheduleTestContent.play_mode === "SURVEY") && (
                        <p>
                            Start Date and Time:{" "}
                            {convertToLocalDateTime(scheduleTestContent.bound_start_time)}
                        </p>
                    )}
                    {(scheduleTestContent.play_mode === "EXAM" ||
                        scheduleTestContent.play_mode === "MOCK") && (
                        <p>Duration: {scheduleTestContent.duration} min</p>
                    )}
                </div>
                <div className="flex flex-col gap-4">
                    {(scheduleTestContent.play_mode === "EXAM" ||
                        scheduleTestContent.play_mode === "SURVEY") && (
                        <p>
                            End Date and Time:{" "}
                            {convertToLocalDateTime(scheduleTestContent.bound_end_time)}
                        </p>
                    )}
                    <p>Total Participants: {scheduleTestContent.user_registrations}</p>
                </div>
            </div>
            <div className="flex items-center justify-between gap-8 text-sm text-neutral-500">
                <p>Attempted by: </p>
                <p>Pending: </p>
            </div>
            <ReverseProgressBar
                value={
                    scheduleTestContent.expected_participants &&
                    scheduleTestContent.user_registrations
                        ? (scheduleTestContent.user_registrations /
                              scheduleTestContent.expected_participants) *
                          100
                        : 0
                }
                className="-mt-3 w-full border"
            />
        </div>
    );
};

export default ScheduleTestDetails;
