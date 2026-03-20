import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/planning/activity-logs/$logId')({
    // Component lazy loaded from $logId.lazy.tsx
});
