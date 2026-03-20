import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Helmet } from 'react-helmet';
import { WorkflowDetailsPage } from './-components/workflow-details-page';

export const Route = createLazyFileRoute('/workflow/$workflowId/')({
  component: WorkflowDetails,
});

export function WorkflowDetails() {
  const { workflowId } = Route.useParams();

  return (
    <LayoutContainer>
      <Helmet>
        <title>Workflow Details</title>
        <meta name="description" content="View workflow automation diagram and details" />
      </Helmet>
      <WorkflowDetailsPage workflowId={workflowId} />
    </LayoutContainer>
  );
}
