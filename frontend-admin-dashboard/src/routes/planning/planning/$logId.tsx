import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/planning/planning/$logId')({
    // Component lazy loaded from $logId.lazy.tsx
});
