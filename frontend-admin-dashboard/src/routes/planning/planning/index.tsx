import { createFileRoute } from '@tanstack/react-router';

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/planning/planning/')({
    validateSearch: (search: Record<string, unknown>) => {
        return {
            packageSessionId: search.packageSessionId as string | undefined,
        };
    },
});
