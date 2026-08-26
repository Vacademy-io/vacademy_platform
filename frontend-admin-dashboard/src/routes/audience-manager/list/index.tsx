import { createFileRoute } from '@tanstack/react-router';

// The route id must be a plain string literal: the TanStack Router generator
// parses this file statically, and a const or `as any` makes it skip the file —
// which is what previously kept this path out of routeTree.gen.ts.
// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/audience-manager/list/')({
    // Component is defined in index.lazy.tsx
});
