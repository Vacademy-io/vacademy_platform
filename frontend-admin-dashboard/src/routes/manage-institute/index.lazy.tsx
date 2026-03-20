import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/manage-institute/')({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello, welcome to manage institutes</div>;
}
