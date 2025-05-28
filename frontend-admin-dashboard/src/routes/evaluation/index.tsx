import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/evaluation/")({
    component: RouteComponent,
});

function RouteComponent() {
    return <div className="m-2 w-full space-x-2 p-2">Hello Evaluation</div>;
}
