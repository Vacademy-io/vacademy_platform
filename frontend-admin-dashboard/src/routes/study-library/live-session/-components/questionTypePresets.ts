/**
 * Question-type catalogue + preset bundles for the
 * Create-Assessment-from-Recording wizard.
 *
 * The backend's AiPublishAssessmentService currently only persists MCQS,
 * so until the LLM + persistence are extended (Phase 3 of the wizard
 * plan), selections here travel in the request body and the backend may
 * still produce MCQs. The picker UX is still useful — teachers see what
 * mix is coming, and we have a hook to plug richer generation into.
 */

export type QuestionTypeCode =
    | 'MCQS' // Multiple choice — single correct
    | 'MCQM' // Multiple choice — multiple correct
    | 'TRUE_FALSE'
    | 'ONE_WORD'
    | 'LONG_ANSWER';

export interface QuestionTypeMeta {
    code: QuestionTypeCode;
    label: string;
    /** One-liner shown under the label in the picker. */
    hint: string;
    /** Hex color for the type pill. Kept simple — no full Tailwind theme yet. */
    accent: 'sky' | 'violet' | 'emerald' | 'amber' | 'rose';
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
    {
        code: 'MCQS',
        label: 'MCQ — Single Correct',
        hint: 'Four options, one right answer. The default question style.',
        accent: 'sky',
    },
    {
        code: 'MCQM',
        label: 'MCQ — Multiple Correct',
        hint: 'Four options where any combination can be correct.',
        accent: 'violet',
    },
    {
        code: 'TRUE_FALSE',
        label: 'True / False',
        hint: 'Two-option statements — quick recall checks.',
        accent: 'emerald',
    },
    {
        code: 'ONE_WORD',
        label: 'One Word Answer',
        hint: 'Learners type a short answer. Auto-graded by exact match.',
        accent: 'amber',
    },
    {
        code: 'LONG_ANSWER',
        label: 'Long Answer',
        hint: 'Open-ended writing prompts — manual evaluation by the teacher.',
        accent: 'rose',
    },
];

export interface QuestionTypePreset {
    id: string;
    label: string;
    description: string;
    types: QuestionTypeCode[];
}

export const QUESTION_TYPE_PRESETS: QuestionTypePreset[] = [
    {
        id: 'mcq-only',
        label: 'Only MCQs (Single Correct)',
        description: 'Classic objective set — fastest to grade, easiest for learners.',
        types: ['MCQS'],
    },
    {
        id: 'mcq-tf',
        label: 'MCQs + True / False',
        description: 'Objective mix that adds quick recall checks alongside MCQs.',
        types: ['MCQS', 'TRUE_FALSE'],
    },
    {
        id: 'mcq-oneword',
        label: 'MCQs + One Word',
        description: 'Recognition + recall — learners pick and also type short answers.',
        types: ['MCQS', 'ONE_WORD'],
    },
    {
        id: 'mixed-all',
        label: 'Mixed Assessment (all types)',
        description: 'A balanced spread of MCQ, True/False, One Word, and Long Answer.',
        types: ['MCQS', 'MCQM', 'TRUE_FALSE', 'ONE_WORD', 'LONG_ANSWER'],
    },
    {
        id: 'subjective-objective',
        label: 'Subjective + Objective Mix',
        description: 'MCQs for recall, Long Answers for application. Manual grading needed.',
        types: ['MCQS', 'LONG_ANSWER'],
    },
];

export const presetMatching = (
    selected: QuestionTypeCode[],
): QuestionTypePreset | undefined => {
    const key = [...selected].sort().join(',');
    return QUESTION_TYPE_PRESETS.find(
        (p) => [...p.types].sort().join(',') === key,
    );
};
