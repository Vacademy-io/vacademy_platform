import { createFileRoute } from '@tanstack/react-router';

// Route definition only — the component is lazy-loaded from publish.lazy.tsx.
export const Route = createFileRoute('/knowledge-base/publish')({});
