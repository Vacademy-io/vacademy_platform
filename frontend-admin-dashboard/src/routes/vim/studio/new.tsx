import { createFileRoute } from '@tanstack/react-router';
import { CreatePage } from '@/features/vimotion/studio/create/CreatePage';

/**
 * `/vim/studio/new` — the Studio create wizard (Ingest → Arrangement → Cuts
 * → Overlays → Audio → Build).
 *
 * `?projectId=…` resumes an existing project: ingest is skipped and the
 * wizard opens at the first unconfirmed step (the detail page's "Resume
 * planning" CTA links here).
 */
export const Route = createFileRoute('/vim/studio/new')({
    validateSearch: (search: Record<string, unknown>) => ({
        projectId:
            typeof search.projectId === 'string' && search.projectId ? search.projectId : undefined,
    }),
    component: NewStudioProjectPage,
});

function NewStudioProjectPage() {
    const { projectId } = Route.useSearch();
    // key: a search-only navigation (?projectId=A → ?projectId=B) re-renders
    // the same mounted CreatePage — the key forces a remount so the one-shot
    // resume hydration runs for the new project.
    return <CreatePage key={projectId ?? 'new'} resumeProjectId={projectId} />;
}
