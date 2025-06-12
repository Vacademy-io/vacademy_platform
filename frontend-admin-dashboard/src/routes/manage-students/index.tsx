import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/manage-students/')({
    component: () => <div>Hello /students/!</div>,
});
