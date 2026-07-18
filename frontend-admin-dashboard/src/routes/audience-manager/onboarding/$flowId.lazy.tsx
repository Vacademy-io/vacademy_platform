import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { OnboardingFlowBuilderPage } from './-components/onboarding-flow-builder-page';

export const Route = createLazyFileRoute('/audience-manager/onboarding/$flowId')({
    component: OnboardingFlowDetailRoute,
});

function OnboardingFlowDetailRoute() {
    const { flowId } = Route.useParams();
    return (
        <LayoutContainer>
            <OnboardingFlowBuilderPage flowId={flowId} />
        </LayoutContainer>
    );
}
