import { createLazyFileRoute } from '@tanstack/react-router';
import AssessmentRouteComponent from './index';

export const Route = createLazyFileRoute('/assessment/')({
    component: AssessmentRouteComponent,
});
