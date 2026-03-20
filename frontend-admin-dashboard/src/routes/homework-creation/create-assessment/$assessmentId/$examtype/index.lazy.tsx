import { createLazyFileRoute } from '@tanstack/react-router';
import CreateAssessmentComponent from './-components/CreateAssessmentComponent';

export const Route = createLazyFileRoute(
  '/homework-creation/create-assessment/$assessmentId/$examtype/'
)({
  component: () => <CreateAssessmentComponent />,
});
