import { createFileRoute } from '@tanstack/react-router';

const VALID_TABS = ['diagram', 'configuration', 'executions', 'debug'] as const;
export type WorkflowDetailsTab = (typeof VALID_TABS)[number];

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/workflow/$workflowId/')({
    // ?tab=configuration deep-links straight to a tab (shareable URL).
    validateSearch: (search: Record<string, unknown>): { tab?: WorkflowDetailsTab } => {
        const tab = search.tab;
        return VALID_TABS.includes(tab as WorkflowDetailsTab)
            ? { tab: tab as WorkflowDetailsTab }
            : {};
    },
    // Component is defined in index.lazy.tsx
});
