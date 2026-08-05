import { createFileRoute } from '@tanstack/react-router';
import { RecentLeadsSearchSchema } from '../recent-leads/-components/recent-leads-search';

// The board shares the Recent Leads URL param contract so drill-through links
// (Reports, Sales Dashboard) work on either surface. The `status` param is
// accepted but unused here — columns are the statuses.
export const Route = createFileRoute('/audience-manager/lead-board/')({
    component: () => null,
    validateSearch: RecentLeadsSearchSchema,
});
