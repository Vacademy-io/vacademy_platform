import { createLazyFileRoute } from '@tanstack/react-router';
import { SignUpComponent } from './-components/SignUpComponent';

export const Route = createLazyFileRoute('/signup/')({
    component: RouteComponent,
});

function RouteComponent() {
    return <SignUpComponent />;
}
