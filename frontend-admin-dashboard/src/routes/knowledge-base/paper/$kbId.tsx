import { createFileRoute } from '@tanstack/react-router';

// Route definition only — the component is lazy-loaded from $kbId.lazy.tsx.
// `resume` carries a generation id so the builder can reopen a previous run
// (its plan, and its questions if it got that far) instead of starting over.
export const Route = createFileRoute('/knowledge-base/paper/$kbId')({
    validateSearch: (search: Record<string, unknown>): { resume?: string } => ({
        resume: typeof search.resume === 'string' ? search.resume : undefined,
    }),
});
