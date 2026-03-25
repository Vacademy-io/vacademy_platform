import { createFileRoute } from '@tanstack/react-router';

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/attendance-tracker/')({
    // Component is defined in index.lazy.tsx
});
