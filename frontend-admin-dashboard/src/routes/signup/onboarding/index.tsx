import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

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
    assess: z.coerce.boolean().optional(),
    lms: z.coerce.boolean().optional(),
    volt: z.coerce.boolean().optional(),
    vsmart: z.coerce.boolean().optional(),
    signupData: z.string().optional(),
});

export const Route = createFileRoute('/signup/onboarding/')({
    validateSearch: onboardingParamsSchema,
});

