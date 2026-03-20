import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/manage-students/')({
    component: () => <div>Hello /students/!</div>,
});
