import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const createAssessmentSchema = z.object({
    // Mirrors /assessment/create-assessment — tolerate a quoted step
    // (`?currentStep="0"`) instead of failing search validation outright.
    currentStep: z.coerce.number().int().min(0).catch(0),
});

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute(
    '/homework-creation/create-assessment/$assessmentId/$examtype/'
)({
    validateSearch: createAssessmentSchema,
    // Component is defined in index.lazy.tsx
});
