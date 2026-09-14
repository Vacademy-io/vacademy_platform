import { createFileRoute } from '@tanstack/react-router';

export interface EvaluateAttemptSearch {
    /** Open this file instead of the learner's raw upload — the AI-checked copy,
     *  so the teacher edits on top of the red-pen marks rather than starting over. */
    fileId?: string;
    /** The AI evaluation whose per-question marks and feedback pre-fill the panel. */
    processId?: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/evaluation/evaluate/$assessmentId/$attemptId/$examType/')({
    validateSearch: (search: Record<string, unknown>): EvaluateAttemptSearch => ({
        fileId: typeof search.fileId === 'string' && search.fileId ? search.fileId : undefined,
        processId:
            typeof search.processId === 'string' && search.processId ? search.processId : undefined,
    }),
});
