import { createFileRoute } from "@tanstack/react-router";
import { OnboardingComponent } from "./-components/OnboardingComponent";
import { z } from "zod";

export interface OrganizationOnboardingSidebarProps {
    steps: string[];
    currentStep: number;
    completedSteps: boolean[];
    onStepClick: (index: number) => void;
}

export interface OrganizationOnboardingProps {
    currentStep: number;
    handleCompleteCurrentStep: () => void;
    completedSteps: boolean[];
}

export const onboardingParamsSchema = z.object({
    assess: z.boolean(),
    lms: z.boolean(),
});

export const Route = createFileRoute("/signup/onboarding/")({
    validateSearch: onboardingParamsSchema,
    component: OnboardingComponent,
});
