import { createFileRoute } from '@tanstack/react-router';

export type PoolEditorTab = 'overview' | 'audiences' | 'counselors' | 'order' | 'schedule';

const ALLOWED_TABS: PoolEditorTab[] = [
    'overview',
    'audiences',
    'counselors',
    'order',
    'schedule',
];

export const Route = createFileRoute('/settings/leads/pools/$poolId')({
    validateSearch: (search: Record<string, unknown>) => ({
        tab:
            typeof search.tab === 'string' && ALLOWED_TABS.includes(search.tab as PoolEditorTab)
                ? (search.tab as PoolEditorTab)
                : undefined,
    }),
});
