import { createFileRoute } from '@tanstack/react-router';
import { ProjectDetailPage } from '@/features/vimotion/studio/detail/ProjectDetailPage';

/**
 * `/vim/studio/$projectId` — Studio project detail.
 *
 * Polls `GET /external/studio/v1/projects/{id}` adaptively while any build is
 * in progress. Shows project config + builds list. Per-build editor links +
 * "Re-plan" CTA land in P4/P5.
 */
export const Route = createFileRoute('/vim/studio/$projectId/')({
    component: RouteComponent,
});

function RouteComponent() {
    const { projectId } = Route.useParams();
    return <ProjectDetailPage projectId={projectId} />;
}
