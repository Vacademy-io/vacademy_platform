import { createFileRoute } from '@tanstack/react-router';

export type PoolEditorTab = 'overview' | 'audiences' | 'counselors' | 'order' | 'schedule';

const ALLOWED_TABS: PoolEditorTab[] = [
    'overview',
    'audiences',
    'counselors',
    'order',
    'schedule',
];

// Cast until the TanStack Router code generator regenerates routeTree.gen.ts to include this path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute('/settings/leads/pools/$poolId' as any)({
    validateSearch: (search: Record<string, unknown>) => ({
        tab:
            typeof search.tab === 'string' && ALLOWED_TABS.includes(search.tab as PoolEditorTab)
                ? (search.tab as PoolEditorTab)
                : undefined,
    }),
});
