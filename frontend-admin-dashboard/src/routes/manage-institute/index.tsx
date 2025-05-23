import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/manage-institute/')({
    component: RouteComponent,
});

function RouteComponent() {
    return <div>Hello, welcome to manage institutes</div>;
}
