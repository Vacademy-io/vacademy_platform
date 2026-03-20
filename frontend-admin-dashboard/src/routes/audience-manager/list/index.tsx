import { createFileRoute } from '@tanstack/react-router';

const AUDIENCE_MANAGER_ROUTE = '/audience-manager/list/' as const;

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute(AUDIENCE_MANAGER_ROUTE as any)({
    // Component is defined in index.lazy.tsx
});