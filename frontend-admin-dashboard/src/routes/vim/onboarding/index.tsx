import { createFileRoute } from '@tanstack/react-router';
import { OnboardingWizard } from '@/features/vimotion/onboarding/OnboardingWizard';

export const Route = createFileRoute('/vim/onboarding/')({
    component: OnboardingWizard,
});
