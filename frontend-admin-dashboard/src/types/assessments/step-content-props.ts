export interface StepContentProps {
    currentStep: number;
    handleCompleteCurrentStep: () => void;
    completedSteps: boolean[];
}
