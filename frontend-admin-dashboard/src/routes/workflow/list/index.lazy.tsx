import { createLazyFileRoute } from '@tanstack/react-router';
import { WorkflowListPage } from './-components/workflow-list-page';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';

export const Route = createLazyFileRoute('/workflow/list/')({
  component: WorkflowListPageWrapper,
});

function WorkflowListPageWrapper() {
  return (
    <LayoutContainer>
      <WorkflowListPage />
    </LayoutContainer>
  );
}
