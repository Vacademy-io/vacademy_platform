import { createFileRoute } from '@tanstack/react-router';

// Eager TanStack registration for the institute-admin's sub-org drilldown deep route.
// Actual component lives in the matching .lazy.tsx file so the bundle stays code-split.
export const Route = createFileRoute('/manage-custom-teams/sub-orgs/$subOrgSlug')({
    component: () => <div>Loading...</div>,
});
