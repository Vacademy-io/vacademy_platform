import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MyButton } from "@/components/design-system/button";
import { ArrowSquareOut, Plus } from "phosphor-react";
import { CreateAssessmentDashboardLogo, EvaluatorAI } from "@/svgs";
import { CollegeStudentsDashboardLogo } from "@/svgs";
import { Helmet } from "react-helmet";
import { LayoutContainer } from "./-components/layout-container/layout-container";
import useLocalStorage from "./-hooks/useLocalStorage";
// import StartTourDialog from "./-components/start-tour-dialog";

export const Route = createFileRoute("/evaluator-ai/")({
    component: () => (
        <LayoutContainer>
            <EvaluationDashboard />
        </LayoutContainer>
    ),
});

export function EvaluationDashboard() {
    const [assessments] = useLocalStorage("assessments", []);
    const [students] = useLocalStorage("students", []);

    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();

    const router = useRouter();

    const handleEnrollButtonClick = () => {
        router.navigate({
            to: `/evaluator-ai/students`,
            search: {
                q: "enroll",
            },
        });
    };

    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Dashboard</h1>);
    }, []);

    return (
        <>
            <Helmet>
                <title>Dashboard</title>
                <meta
                    name="description"
                    content="This page shows the dashboard of the institute."
                />
            </Helmet>
            <h1 className="text-2xl">
                Hello <span className="text-primary-500">Evaluator!</span>
            </h1>
            <div className="mt-8 flex w-full flex-col gap-6">
                <div className={`flex gap-6`}>
                    <div className={`flex flex-1 gap-6`}>
                        <Card className="flex-1 grow bg-neutral-50 shadow-none">
                            <CardHeader className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle>Enroll students</CardTitle>
                                    <MyButton
                                        type="submit"
                                        scale="medium"
                                        buttonType="secondary"
                                        id="quick-enrollment"
                                        layoutVariant="default"
                                        className="text-sm"
                                        onClick={handleEnrollButtonClick}
                                    >
                                        Enroll
                                    </MyButton>
                                </div>
                                <CardDescription className="flex items-center gap-4">
                                    <div
                                        className="flex cursor-pointer items-center gap-1"
                                        onClick={() =>
                                            navigate({
                                                to: "/evaluator-ai/students",
                                            })
                                        }
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Students</span>
                                            <ArrowSquareOut />
                                        </div>
                                        <span className="text-primary-500">
                                            {students?.length ?? 0}
                                        </span>
                                    </div>
                                </CardDescription>
                                <CardDescription className="mt-2 flex items-center justify-center">
                                    <CollegeStudentsDashboardLogo className="mt-4 size-60" />
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                    <div className="flex flex-1 flex-row gap-6">
                        <Card className="flex-1 grow bg-neutral-50 shadow-none">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Create Assessment to evaluate</CardTitle>
                                    <MyButton
                                        type="submit"
                                        scale="medium"
                                        id="first-assessment"
                                        buttonType="secondary"
                                        layoutVariant="default"
                                        className="text-sm"
                                        onClick={() => {
                                            navigate({
                                                to: "/evaluator-ai/assessment/create-assessment",
                                            });
                                        }}
                                    >
                                        <Plus size={32} />
                                        Create
                                    </MyButton>
                                </div>
                                <CardDescription className="flex items-center gap-4 py-6">
                                    <div
                                        className="flex cursor-pointer items-center gap-1"
                                        onClick={() =>
                                            navigate({
                                                to: "/evaluator-ai/assessment",
                                                search: { selectedTab: "liveTests" },
                                            })
                                        }
                                    >
                                        <div className="flex items-center gap-1 hover:text-primary-500">
                                            <span>Assessment created</span>
                                            <ArrowSquareOut />
                                        </div>
                                        <span className="text-primary-500">
                                            {assessments?.length ?? 0}
                                        </span>
                                    </div>
                                </CardDescription>
                                <CardDescription className="mt-2 flex items-center justify-center">
                                    <CreateAssessmentDashboardLogo className="mt-4" />
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
                <Card className="h-[400px] bg-neutral-50 shadow-none">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Evaluate students response for an assessment</CardTitle>
                            <MyButton
                                type="submit"
                                scale="medium"
                                id="first-assessment"
                                buttonType="secondary"
                                layoutVariant="default"
                                className="text-sm"
                                onClick={() => {
                                    navigate({
                                        to: "/evaluator-ai/evaluation",
                                        search: {
                                            q: "evalute",
                                        },
                                    });
                                }}
                            >
                                Evaluate
                            </MyButton>
                        </div>
                        <CardDescription className="flex items-center gap-4"></CardDescription>
                        <CardDescription className="flex items-center justify-center">
                            <EvaluatorAI className="mt-4" width={200} />
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
            {/* <StartTourDialog
                onStartTour={() => {
                    console.log("start");
                }}
            /> */}
        </>
    );
}
