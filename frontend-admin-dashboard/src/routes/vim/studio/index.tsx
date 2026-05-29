import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/vim/studio` — bare entry. The Studio list lives inside the dashboard
 * shell under `?tab=studio`, so this route just redirects there (keeping the
 * sidebar + chrome). The `/vim/studio/new` + `/vim/studio/$projectId` routes
 * are full-screen surfaces.
 */
export const Route = createFileRoute('/vim/studio/')({
    beforeLoad: () => {
        throw redirect({ to: '/vim/dashboard', search: { tab: 'studio' } });
    },
});
