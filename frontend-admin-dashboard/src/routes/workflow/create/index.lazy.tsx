import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { WorkflowBuilder } from './-components/workflow-builder';

export const Route = createLazyFileRoute('/workflow/create/')({
    component: () => (
        <LayoutContainer>
            <WorkflowBuilder />
        </LayoutContainer>
    ),
});
