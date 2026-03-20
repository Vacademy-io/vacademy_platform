import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/manage-custom-teams/')({
    component: () => <div>Loading...</div>, // Will be replaced by lazy component
});
