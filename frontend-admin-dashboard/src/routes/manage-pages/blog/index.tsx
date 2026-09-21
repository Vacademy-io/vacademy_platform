import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/manage-pages/blog/')({
    component: () => <div>Loading...</div>, // Will be overridden by lazy
});
