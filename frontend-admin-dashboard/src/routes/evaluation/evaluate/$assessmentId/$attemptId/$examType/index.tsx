import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getAttemptDetails } from "@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-services/assessment-details-services";
import {
    getAssessmentDetails,
    getQuestionDataForSection,
} from "@/routes/assessment/create-assessment/$assessmentId/$examtype/-services/assessment-services";
import PDFEvaluator from "@/routes/evaluation/evaluation-tool/-components/pdf-editor";
import { useInstituteQuery } from "@/services/student-list-section/getInstituteDetails";
import { getPublicUrl } from "@/services/upload_file";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";

export const Route = createFileRoute("/evaluation/evaluate/$assessmentId/$attemptId/$examType/")({
    component: () => (
        <LayoutContainer>
            <EvaluateAttemptComponent />
        </LayoutContainer>
    ),
});

const EvaluateAttemptComponent = () => {
    const { attemptId, assessmentId, examType } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const [fileUrl, setFileUrl] = useState<string>();
    const [file, setFile] = useState<File | null>(null);
    const { data: attemptDetails, isLoading: isAttemptLoading } = useSuspenseQuery(
        getAttemptDetails(attemptId),
    );
    const { data: assessmentDetails, isLoading } = useSuspenseQuery(
        getAssessmentDetails({
            assessmentId: assessmentId,
            instituteId: instituteDetails?.id,
            type: examType,
        }),
    );
    const { data: questionData, isLoading: isQuestionsLoading } = useSuspenseQuery(
        getQuestionDataForSection({
            assessmentId,
            sectionIds: assessmentDetails[1]?.saved_data.sections
                ?.map((section) => section.id)
                .join(","),
        }),
    );

    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading("Evaluate Response");
        if (!isAttemptLoading) {
            console.log("fetching");
            setTimeout(() => {
                getPublicUrl(attemptDetails).then((url) => {
                    fetch(url)
                        .then((response) => response.blob())
                        .then((blob) => {
                            const file = new File([blob], "attempt_file", {
                                type: blob.type || "application/octet-stream",
                            });
                            if (typeof setFile === "function") {
                                setFile(file);
                            } else {
                                setFileUrl(url);
                                console.log(fileUrl);
                            }
                        })
                        .catch((error) => {
                            console.error("Error fetching file:", error);
                        });
                });
            }, 100);
        }
    }, [isAttemptLoading]);

    if (isLoading || isQuestionsLoading || isAttemptLoading || !file)
        return (
            <div className="flex h-full flex-col items-center justify-center gap-y-2">
                <h1>Getting response file please wait...</h1>
                <DashboardLoader height="fit-content" />
            </div>
        );

    return (
        <>
            <Helmet>
                <title>Evaluate Response</title>
                <meta
                    name="description"
                    content="This page shows all details related to an assessment."
                />
            </Helmet>
            {file && (
                <PDFEvaluator
                    isFreeTool={false}
                    file={file}
                    fileId={attemptDetails}
                    questionData={questionData}
                    assessmentId={assessmentId}
                    attemptId={attemptId}
                    instituteId={instituteDetails?.id}
                />
            )}
        </>
    );
};
