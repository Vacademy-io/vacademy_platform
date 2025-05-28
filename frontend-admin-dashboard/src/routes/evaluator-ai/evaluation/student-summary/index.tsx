import { createFileRoute } from "@tanstack/react-router";
import EvaluationSummary from "../-components/summary-student";

export const Route = createFileRoute("/evaluator-ai/evaluation/student-summary/")({
    component: RouteComponent,
});

function RouteComponent() {
    return <EvaluationSummary />;
}
