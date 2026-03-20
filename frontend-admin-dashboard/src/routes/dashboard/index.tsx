import { createFileRoute } from '@tanstack/react-router';

// Route definition only - component is lazy loaded from index.lazy.tsx
// This reduces initial bundle size by deferring the Dashboard component loading
export const Route = createFileRoute('/dashboard/')({
    // No component here - it's defined in index.lazy.tsx
    // beforeLoad, loader, validateSearch can stay here if needed
});
