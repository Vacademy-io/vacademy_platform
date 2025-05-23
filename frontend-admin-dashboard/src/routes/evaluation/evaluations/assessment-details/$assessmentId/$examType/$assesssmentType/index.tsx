import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAssessmentDetails } from "@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services";
import { useInstituteQuery } from "@/services/student-list-section/getInstituteDetails";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { DotIcon, DotIconOffline } from "@/svgs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CaretLeft, CheckCircle, LockSimple, PauseCircle } from "phosphor-react";
import { useEffect } from "react";
import { Helmet } from "react-helmet";
import AssessmentSubmissionsTab from "./-components/AssessmentSubmissionsTab";

export const Route = createFileRoute(
    "/evaluation/evaluations/assessment-details/$assessmentId/$examType/$assesssmentType/",
)({
    component: () => (
        <LayoutContainer>
            <AssessmentDetailsComponent />
        </LayoutContainer>
    ),
});

const heading = (
    <div className="flex items-center gap-4">
        <CaretLeft onClick={() => window.history.back()} className="cursor-pointer" />
        <h1 className="text-lg">Assessment Details</h1>
    </div>
);

const AssessmentDetailsComponent = () => {
    const { assessmentId, examType, assesssmentType } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: assessmentDetails, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
        }),
    );

    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(heading);
    }, []);

    if (isLoading) return <DashboardLoader />;

    return (
        <>
            <Helmet>
                <title>Assessment Details</title>
                <meta
                    name="description"
                    content="This page shows all details related to an assessment."
                />
            </Helmet>
            <div>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="font-semibold">{assessmentDetails[0]?.saved_data.name}</h1>
                        <Badge
                            className={`rounded-md border border-neutral-300 ${
                                assessmentDetails[0]?.saved_data.assessment_visibility === "PRIVATE"
                                    ? "bg-primary-50"
                                    : "bg-info-50"
                            } py-1.5 shadow-none`}
                        >
                            <LockSimple size={16} className="mr-2" />
                            {assessmentDetails[0]?.saved_data.assessment_visibility}
                        </Badge>
                        <Badge
                            className={`rounded-md border border-neutral-300 ${
                                assessmentDetails[0]?.saved_data.assessment_mode !== "EXAM"
                                    ? "bg-neutral-50"
                                    : "bg-success-50"
                            } py-1.5 shadow-none`}
                        >
                            {assessmentDetails[0]?.saved_data.assessment_mode === "EXAM" ? (
                                <DotIcon className="mr-2" />
                            ) : (
                                <DotIconOffline className="mr-2" />
                            )}
                            {assessmentDetails[0]?.saved_data.assessment_mode}
                        </Badge>
                        <Separator orientation="vertical" className="h-8 w-px bg-neutral-300" />
                        <Badge
                            className={`rounded-md border ${
                                assessmentDetails?.[0]?.status === "COMPLETED"
                                    ? "bg-success-50"
                                    : "bg-neutral-100"
                            } border-neutral-300 py-1.5 shadow-none`}
                        >
                            {assessmentDetails?.[0]?.status === "COMPLETED" ? (
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
                            {assessmentDetails?.[0]?.status}
                        </Badge>
                    </div>
                </div>
                <Separator className="my-4" />

                <AssessmentSubmissionsTab type={assesssmentType} />
            </div>
        </>
    );
};
