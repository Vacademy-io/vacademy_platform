import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/')({
    validateSearch: (search: Record<string, unknown>) => ({
        selectedTab: (search.selectedTab as string) || 'tab',
    }),
});
