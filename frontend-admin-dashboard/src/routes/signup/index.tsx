import { createFileRoute } from "@tanstack/react-router";
import { SignUpComponent } from "./-components/SignUpComponent";

export const Route = createFileRoute("/signup/")({
    component: RouteComponent,
});

function RouteComponent() {
    return <SignUpComponent />;
}
