import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/sessionUtility', () => ({
    getTokenDecodedData: () => null,
    getTokenFromCookie: () => null,
}));
vi.mock('@/constants/helper', () => ({ getInstituteId: () => 'inst-1' }));

import { convertQuestionsDataToResponse } from './helper';
import type { MyQuestion } from '@/types/assessments/question-paper-form';

const blank = (n: number) => Array(n).fill({ id: '', name: '', isSelected: false });

const question = (overrides: Partial<MyQuestion>): MyQuestion => ({
    id: 'q-1',
    questionId: 'q-1',
    questionName: '<p>Question</p>',
    explanation: '',
    questionType: 'MCQS',
    questionMark: '',
    questionPenalty: '',
    questionDuration: { hrs: '0', min: '0' },
    singleChoiceOptions: blank(4),
    multipleChoiceOptions: blank(4),
    csingleChoiceOptions: blank(4),
    cmultipleChoiceOptions: blank(4),
    trueFalseOptions: blank(2),
    validAnswers: [],
    tags: [],
    ...overrides,
});

const evaluation = (payload: { auto_evaluation_json: string }) =>
    JSON.parse(payload.auto_evaluation_json);

// Editing a saved paper goes through convertQuestionsDataToResponse. It used to
// serialise every question as an MCQ, so a numeric answer was dropped on save.
describe('convertQuestionsDataToResponse (question-paper edit save)', () => {
    it('keeps the numeric answer and settings of an edited NUMERIC question', () => {
        const [payload] = convertQuestionsDataToResponse(
            [
                question({
                    questionType: 'NUMERIC',
                    validAnswers: [274],
                    decimals: 2,
                    numericType: 'DECIMAL',
                }),
            ],
            'updated'
        );
        expect(payload!.question_type).toBe('NUMERIC');
        expect(evaluation(payload!)).toEqual({ type: 'NUMERIC', data: { validAnswers: [274] } });
        expect(JSON.parse(payload!.options_json!)).toEqual({ decimals: 2, numericType: 'DECIMAL' });
        expect(payload!.options).toEqual([]);
    });

    it('maps a comprehension numeric to NUMERIC and keeps its passage', () => {
        const [payload] = convertQuestionsDataToResponse(
            [
                question({
                    questionType: 'CNUMERIC',
                    validAnswers: [1.5],
                    parentRichTextContent: '<p>Passage</p>',
                }),
            ],
            'updated'
        );
        expect(payload!.question_type).toBe('NUMERIC');
        expect(evaluation(payload!).data.validAnswers).toEqual([1.5]);
        expect(payload!.parent_rich_text?.content).toBe('<p>Passage</p>');
    });

    it('sends the true/false options, not four blank MCQ options', () => {
        const [payload] = convertQuestionsDataToResponse(
            [
                question({
                    questionType: 'TRUE_FALSE',
                    trueFalseOptions: [
                        { id: 'o-true', name: 'True', isSelected: false },
                        { id: 'o-false', name: 'False', isSelected: true },
                    ],
                }),
            ],
            'updated'
        );
        expect(payload!.options.map((o) => o.id)).toEqual(['o-true', 'o-false']);
        expect(evaluation(payload!)).toEqual({
            type: 'TRUE_FALSE',
            data: { correctOptionIds: ['o-false'] },
        });
    });

    it('keeps the MCQ answer key exactly as before', () => {
        const [payload] = convertQuestionsDataToResponse(
            [
                question({
                    questionType: 'MCQM',
                    multipleChoiceOptions: [
                        { id: 'a', name: 'A', isSelected: true },
                        { id: 'b', name: 'B', isSelected: false },
                        { id: 'c', name: 'C', isSelected: true },
                    ],
                }),
            ],
            'updated'
        );
        expect(evaluation(payload!)).toEqual({
            type: 'MCQM',
            data: { correctOptionIds: ['a', 'c'] },
        });
        expect(payload!.options.map((o) => o.preview_id)).toEqual(['a', 'b', 'c']);
    });

    it('marks a question added during the edit by option index', () => {
        const [payload] = convertQuestionsDataToResponse(
            [
                question({
                    questionType: 'MCQS',
                    singleChoiceOptions: [
                        { id: '', name: 'A', isSelected: false },
                        { id: '', name: 'B', isSelected: true },
                    ],
                }),
            ],
            'added'
        );
        expect(payload!.id).toBeNull();
        expect(payload!.options.map((o) => o.preview_id)).toEqual([0, 1]);
        expect(evaluation(payload!).data.correctOptionIds).toEqual(['1']);
    });
});
