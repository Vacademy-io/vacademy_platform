import { useInstituteQuery } from "@/services/student-list-section/getInstituteDetails";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getAssessmentDetails } from "../../create-assessment/$assessmentId/$examtype/-services/assessment-services";
import PreviewAndExport from "@/components/common/export-offline";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect } from "react";
import { CaretLeft } from "phosphor-react";

export const Route = createFileRoute("/assessment/export/$assessmentId/")({
    component: () => (
        <LayoutContainer>
            <RouteComponent />
        </LayoutContainer>
    ),
});

function RouteComponent() {
    const { assessmentId } = Route.useParams();
    const { setNavHeading } = useNavHeadingStore();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data: assessmentDetails, isLoading: isAssessmentDetailsLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteDetails?.id,
            type: "EXAM",
        }),
    );

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-4">
                <CaretLeft onClick={() => window.history.back()} className="cursor-pointer" />
                <h1 className="text-lg">Preview and Export</h1>
            </div>,
        );
    }, []);

    if (isAssessmentDetailsLoading) return <DashboardLoader />;
    return (
        <PreviewAndExport
            assessmentId={assessmentId}
            sectionIds={
                assessmentDetails[1]?.saved_data?.sections?.map((section) => section.id) || []
            }
            assessmentDetails={assessmentDetails}
            // instructions={assessmentDetails[1]?.saved_data?.instructions ?? {}}
            sections={assessmentDetails[1]?.saved_data?.sections ?? []}
        />
    );
}
