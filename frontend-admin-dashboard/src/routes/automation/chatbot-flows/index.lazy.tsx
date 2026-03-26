import { createLazyFileRoute } from '@tanstack/react-router';
import { FlowListPage } from './-components/flow-list-page';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';

export const Route = createLazyFileRoute('/automation/chatbot-flows/')({
    component: ChatbotFlowsListWrapper,
});

function ChatbotFlowsListWrapper() {
    return (
        <LayoutContainer>
            <FlowListPage />
        </LayoutContainer>
    );
}
