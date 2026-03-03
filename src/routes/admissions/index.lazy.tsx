import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/admissions/')({
    component: () => <div>Hello /admissions/!</div>,
});
