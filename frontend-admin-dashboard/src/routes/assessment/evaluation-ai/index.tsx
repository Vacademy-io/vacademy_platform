import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/assessment/evaluation-ai/')({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Ongoing evaluations here</div>;
}
