import { createFileRoute } from '@tanstack/react-router';

interface StudentAiSearch {
    // Which sub-tab is open, so the tab survives a refresh / can be deep-linked.
    tab?: 'settings' | 'analysis';
}

// Route definition only — component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/student-ai/')({
    validateSearch: (search: Record<string, unknown>): StudentAiSearch => ({
        tab: search.tab === 'analysis' ? 'analysis' : 'settings',
    }),
});
