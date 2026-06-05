import { createFileRoute } from '@tanstack/react-router';

// Cast until the TanStack Router code generator regenerates routeTree.gen.ts to include this path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute('/settings/telephony/' as any)({});
