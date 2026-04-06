import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { WorkflowEditor } from './-components/workflow-editor';

export const Route = createLazyFileRoute('/workflow/$workflowId/edit/')({
    component: () => {
        const { workflowId } = Route.useParams();
        return (
            <LayoutContainer>
                <WorkflowEditor workflowId={workflowId} />
            </LayoutContainer>
        );
    },
});
