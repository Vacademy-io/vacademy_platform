import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { Examination, Mock, Practice, Survey } from "@/svgs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Helmet } from "react-helmet";

export const Route = createFileRoute("/assessment/")({
    component: () => (
        <LayoutContainer>
            <AssessmentPage />
        </LayoutContainer>
    ),
});

function AssessmentPage() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();

    const handleRedirectRoute = (type: string) => {
        navigate({
            to: "/assessment/create-assessment/$assessmentId/$examtype",
            params: {
                assessmentId: "defaultId",
                examtype: type,
            },
            search: {
                currentStep: 0,
            },
        });
    };

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Assessments</h1>);
    }, []);
    return (
        <>
            <Helmet>
                <title>Assessments</title>
                <meta
                    name="description"
                    content="This page shows all types of assessments that you can create here."
                />
            </Helmet>
            <div className="pb-6 text-title font-semibold">Create Assessment</div>
            <div className="flex size-auto flex-col items-center justify-center gap-11">
                <div className="flex items-center gap-12">
                    <div
                        onClick={() => handleRedirectRoute("EXAM")}
                        className="flex w-[400px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                    >
                        <Examination />
                        <h1 className="text-[1.4rem] font-semibold">Examination</h1>
                        <p className="text-center text-sm text-neutral-500">
                            A Fixed-time assessment that goes live for a specific schedule,
                            simulating real exam conditions.
                        </p>
                    </div>
                    <div
                        onClick={() => handleRedirectRoute("MOCK")}
                        className="flex w-[400px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                    >
                        <Mock />
                        <h1 className="text-[1.4rem] font-semibold">Mock Assessment</h1>
                        <p className="text-center text-sm text-neutral-500">
                            A practice assessment always available, with a fixed duration to
                            replicate exam scenarios.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-12">
                    <div
                        onClick={() => handleRedirectRoute("PRACTICE")}
                        className="flex w-[400px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                    >
                        <Practice />
                        <h1 className="text-[1.4rem] font-semibold">Practice Assessment</h1>
                        <p className="text-center text-sm text-neutral-500">
                            An on-demand assessment with no time limits, allowing students to
                            attempt it anytime.
                        </p>
                    </div>
                    <div
                        onClick={() => handleRedirectRoute("SURVEY")}
                        className="flex w-[400px] cursor-pointer flex-col items-center rounded-xl border bg-neutral-50 p-8"
                    >
                        <Survey />
                        <h1 className="text-[1.4rem] font-semibold">Survey</h1>
                        <p className="text-center text-sm text-neutral-500">
                            A set of questions for feedback or opinions, with no right or wrong
                            answers.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
