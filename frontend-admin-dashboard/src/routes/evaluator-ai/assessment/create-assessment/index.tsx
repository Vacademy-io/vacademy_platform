import { createFileRoute } from "@tanstack/react-router";
import CreateAssessmentComponent from "./-components/CreateAssessmentComponent";

export const Route = createFileRoute("/evaluator-ai/assessment/create-assessment/")({
    component: () => <CreateAssessmentComponent />,
});
