import { createFileRoute } from '@tanstack/react-router';

interface ContactsSearchParams {
    name?: string;
    gender?: string | string[];
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/manage-contacts/')({
    validateSearch: (search): ContactsSearchParams => ({
        // Coerce at runtime: an all-digit value (e.g. a phone number) is parsed as a
        // JS number by TanStack's default search parser, so `as string` (compile-time
        // only) would leave a number in `name`. String() guarantees a real string.
        name: search.name != null ? String(search.name) : undefined,
        gender: search.gender as string | string[] | undefined,
    }),
});
