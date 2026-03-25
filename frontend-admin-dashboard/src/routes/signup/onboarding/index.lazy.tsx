import { createLazyFileRoute } from '@tanstack/react-router';
import { OnboardingComponent } from './-components/OnboardingComponent';

export const Route = createLazyFileRoute('/signup/onboarding/')({
  component: OnboardingComponent,
});
