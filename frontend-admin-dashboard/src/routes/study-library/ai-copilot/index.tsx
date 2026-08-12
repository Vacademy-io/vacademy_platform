import { createFileRoute } from '@tanstack/react-router';

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/ai-copilot/')({
    // `kb` arrives when a teacher came straight from a knowledge base, so the
    // course starts already grounded in the material they were just looking at
    // instead of making them find it again in a dropdown.
    validateSearch: (search: Record<string, unknown>): { kb?: string } => ({
        kb: typeof search.kb === 'string' && search.kb ? search.kb : undefined,
    }),
});
