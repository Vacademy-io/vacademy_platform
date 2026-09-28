import { createFileRoute } from '@tanstack/react-router';

/**
 * Optional search params — only the Dashboard tab writes them, so a copied link
 * reopens the same view (range, batches, teachers). Every key is optional, so
 * existing `navigate({ to: '/study-library/live-session' })` calls are unaffected.
 */
export interface LiveSessionPageSearch {
    view?: 'dashboard';
    from?: string;
    to?: string;
    batches?: string;
    teachers?: string;
}

const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value ? value : undefined;

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/live-session/')({
    validateSearch: (search: Record<string, unknown>): LiveSessionPageSearch => ({
        view: search.view === 'dashboard' ? 'dashboard' : undefined,
        from: text(search.from),
        to: text(search.to),
        batches: text(search.batches),
        teachers: text(search.teachers),
    }),
    // Component is defined in index.lazy.tsx
});
