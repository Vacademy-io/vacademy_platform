import { createFileRoute } from '@tanstack/react-router';

interface DoubtManagementSearch {
    // Deep link from doubt-notification emails/alerts (?doubtId=X) — opens that specific doubt in
    // the inbox instead of defaulting to the newest one.
    doubtId?: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/doubt-management/')({
    validateSearch: (search: Record<string, unknown>): DoubtManagementSearch => ({
        doubtId: typeof search.doubtId === 'string' ? search.doubtId : undefined,
    }),
    // Component is defined in index.lazy.tsx
});
