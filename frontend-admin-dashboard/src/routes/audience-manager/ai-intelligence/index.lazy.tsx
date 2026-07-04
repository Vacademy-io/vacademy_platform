import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { AiIntelligencePage } from './-components/ai-intelligence-page';

export const Route = createLazyFileRoute('/audience-manager/ai-intelligence/')({
    component: AiIntelligenceRoute,
});

function AiIntelligenceRoute() {
    return (
        <LayoutContainer>
            <AiIntelligencePage />
        </LayoutContainer>
    );
}
