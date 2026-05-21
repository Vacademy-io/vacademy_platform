import { createFileRoute, redirect } from '@tanstack/react-router';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getDisplaySettingsFromCache } from '@/services/display-settings';

export interface AdminActivityLogsSearchParams {
    page?: number;
    size?: number;
    entityType?: string;
    action?: string;
    actorId?: string;
    startDate?: number;
    endDate?: number;
}

export const Route = createFileRoute('/admin-activity-logs/')({
    // Audit logs are an opt-in feature per institute. The sidebar already hides
    // the link when the toggle is off, but direct URL navigation needs to
    // respect the same setting — otherwise institutes that explicitly disabled
    // it could still expose the page to anyone who knew the URL.
    beforeLoad: () => {
        const settings = getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey());
        const tab = settings?.sidebar?.find((t) => t.id === 'admin-activity-logs');
        if (tab && tab.visible === false) {
            throw redirect({ to: '/dashboard' });
        }
    },
    validateSearch: (search): AdminActivityLogsSearchParams => ({
        page: search.page as number | undefined,
        size: search.size as number | undefined,
        entityType: search.entityType as string | undefined,
        action: search.action as string | undefined,
        actorId: search.actorId as string | undefined,
        startDate: search.startDate as number | undefined,
        endDate: search.endDate as number | undefined,
    }),
});
