import { createFileRoute } from '@tanstack/react-router';

interface ContactsSearchParams {
    name?: string;
    gender?: string | string[];
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/manage-contacts/')({
    validateSearch: (search): ContactsSearchParams => ({
        name: search.name as string | undefined,
        gender: search.gender as string | string[] | undefined,
    }),
});
