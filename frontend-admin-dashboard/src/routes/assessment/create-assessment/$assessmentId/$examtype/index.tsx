import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const createAssessmentSchema = z.object({
    // Coerce + catch: a bare `z.number()` throws a SearchParamError (blank error
    // page) for any link that arrives with the step quoted — `?currentStep="0"` —
    // which is what stored/hand-edited sidebar routes produce. Step 0 is always a
    // safe landing spot.
    currentStep: z.coerce.number().int().min(0).catch(0),
});

export const Route = createFileRoute('/assessment/create-assessment/$assessmentId/$examtype/')({
    validateSearch: createAssessmentSchema,
});
