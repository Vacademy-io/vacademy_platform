import React, { FC } from "react";
import Step2AddingQuestions from "./Step2AddingQuestions";
import { StepContentProps } from "@/types/assessments/step-content-props";
import Step1BasicInfo from "./Step1BasicInfo";

// Define a mapping of step index to component
const stepComponents: {
    [key: number]: FC<StepContentProps>;
} = {
    0: Step1BasicInfo,
    1: Step2AddingQuestions,
};

export const MainStepComponent: React.FC<StepContentProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    // Get the component based on currentStep
    const StepComponent = stepComponents[currentStep];

    // If no matching step component, return null
    if (!StepComponent) return null;

    return (
        <StepComponent
            currentStep={currentStep}
            handleCompleteCurrentStep={handleCompleteCurrentStep}
            completedSteps={completedSteps}
        />
    );
};
