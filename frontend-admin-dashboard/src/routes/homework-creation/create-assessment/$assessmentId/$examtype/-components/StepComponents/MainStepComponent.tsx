import React, { FC } from "react";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2AddingQuestions from "./Step2AddingQuestions";
import Step3AddingParticipants from "./Step3AddingParticipants";
import Step4AccessControl from "./Step4AccessControl";
import { StepContentProps } from "@/types/assessments/step-content-props";

// Define a mapping of step index to component
const stepComponents: {
    [key: number]: FC<StepContentProps>;
} = {
    0: Step1BasicInfo,
    1: Step2AddingQuestions,
    2: Step3AddingParticipants,
    3: Step4AccessControl,
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
