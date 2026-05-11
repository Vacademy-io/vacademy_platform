import { createFileRoute } from '@tanstack/react-router';

// @ts-expect-error — routeTree.gen.ts hasn't been regenerated yet for this new route;
// the next dev/build run with the TanStack Router Vite plugin will pick it up.
export const Route = createFileRoute('/manage-suborg-teams/')({
    component: () => <div>Loading...</div>, // Will be replaced by lazy component
});
