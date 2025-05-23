import { createFileRoute } from "@tanstack/react-router";
import CreateAssessmentComponent from "./-components/CreateAssessmentComponent";

import { z } from "zod";

export const createAssessmentSchema = z.object({
    currentStep: z.number(),
});

export const Route = createFileRoute("/assessment/create-assessment/$assessmentId/$examtype/")({
    validateSearch: createAssessmentSchema,
    component: () => <CreateAssessmentComponent />,
});
