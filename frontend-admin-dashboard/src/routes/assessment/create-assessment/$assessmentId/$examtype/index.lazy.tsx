import { createLazyFileRoute } from '@tanstack/react-router';
import CreateAssessmentComponent from './-components/CreateAssessmentComponent';

export const Route = createLazyFileRoute('/assessment/create-assessment/$assessmentId/$examtype/')({
    component: CreateAssessmentComponent,
});
