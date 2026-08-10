import { createFileRoute } from '@tanstack/react-router';

// Route definition only — the component is lazy-loaded from $kbId.lazy.tsx.
export const Route = createFileRoute('/knowledge-base/$kbId')({});
