import { createFileRoute } from '@tanstack/react-router';
import { RecentLeadsSearchSchema } from './-components/recent-leads-search';

export const Route = createFileRoute('/audience-manager/recent-leads/')({
    component: () => null,
    validateSearch: RecentLeadsSearchSchema,
});
