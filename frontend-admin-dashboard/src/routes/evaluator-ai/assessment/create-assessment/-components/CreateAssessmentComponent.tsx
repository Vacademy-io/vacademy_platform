import { useEffect, useState } from "react";
import { MainStepComponent } from "./MainStepComponent";
import { CheckCircle } from "phosphor-react";
import { Helmet } from "react-helmet";
import { useSidebar } from "@/components/ui/sidebar";
import { useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/routes/evaluator-ai/-components/layout-container/layout-container";
// Define interfaces for props
interface CreateAssessmentSidebarProps {
    steps: {
        label: string;
        id: string;
    }[];
    currentStep: number;
    completedSteps: boolean[];
    onStepClick: (index: number) => void;
}

const CreateAssessmentSidebar: React.FC<CreateAssessmentSidebarProps> = ({
    steps,
    currentStep,
    completedSteps,
    onStepClick,
}) => {
    const { open } = useSidebar();
    return (
        <>
            {steps.map((step, index) => (
                <div
                    key={step.id}
                    onClick={() => onStepClick(index)}
                    id={step.id}
                    className={`mx-6 flex items-center justify-between px-6 py-3 ${
                        index <= currentStep || completedSteps[index - 1]
                            ? "cursor-pointer"
                            : "cursor-not-allowed"
                    } ${
                        currentStep === index
                            ? "rounded-lg border-2 bg-white !text-primary-500"
                            : completedSteps[index]
                              ? "bg-transparent text-black"
                              : `bg-transparent ${
                                    index > 0 && completedSteps[index - 1]
                                        ? "text-black"
                                        : "text-gray-300"
                                } `
                    } focus:outline-none`}
                >
                    <div className="flex items-center gap-6">
                        {!open && !completedSteps[index] && (
                            <span className="text-lg font-semibold">{index + 1}</span>
                        )}
                        {open && <span className="text-lg font-semibold">{index + 1}</span>}
                        {open && <span className="font-thin">{step.label}</span>}
                    </div>

                    {completedSteps[index] && (
                        <CheckCircle size={24} weight="fill" className="!text-green-500" />
                    )}
                </div>
            ))}
        </>
    );
};

const CreateAssessmentComponent = () => {
    const navigate = useNavigate();

    const steps = [
        {
            label: "Basic Info",
            id: "basic-info",
        },
        {
            label: "Add Question",
            id: "add-question",
        },
    ];
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([false, false, false, false]);
    const completeCurrentStep = () => {
        setCompletedSteps((prev) => {
            const updated = [...prev];
            updated[currentStep] = true;
            return updated;
        });
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
            // Update URL `currentStep` without reloading
            navigate({
                to: "/evaluator-ai/assessment/create-assessment",
            });
        }
    };

    useEffect(() => {}, []);

    const goToStep = (index: number) => {
        if (index <= currentStep || completedSteps[index - 1]) {
            setCurrentStep(index);
        }
    };
    return (
        <LayoutContainer
            sidebarComponent={
                <CreateAssessmentSidebar
                    steps={steps}
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                    onStepClick={goToStep}
                />
            }
        >
            <Helmet>
                <title>Create Assessment</title>
                <meta
                    name="description"
                    content="This page is for creating an assessment for students via admin."
                />
            </Helmet>
            <MainStepComponent
                currentStep={currentStep}
                handleCompleteCurrentStep={completeCurrentStep}
                completedSteps={completedSteps}
            />
        </LayoutContainer>
    );
};

export default CreateAssessmentComponent;
