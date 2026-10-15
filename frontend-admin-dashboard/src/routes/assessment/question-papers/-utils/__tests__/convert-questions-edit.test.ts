import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/sessionUtility', () => ({
    getTokenDecodedData: vi.fn(),
    getTokenFromCookie: vi.fn(),
}));
vi.mock('@/constants/helper', () => ({ getInstituteId: vi.fn() }));

import { MyQuestion } from '@/types/assessments/question-paper-form';
import { QuestionResponse } from '@/types/assessments/question-paper-template';
import {
    convertQuestionsDataToResponse,
    transformResponseDataToMyQuestionsSchema,
} from '../helper';

const blank = (n: number) => Array(n).fill({ id: '', name: '', isSelected: false });

const base = (overrides: Partial<MyQuestion>): MyQuestion => ({
    id: 'q1',
    questionId: 'q1',
    questionName: '<p>Q</p>',
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
    ...overrides,
});

describe('convertQuestionsDataToResponse (paper edit save)', () => {
    it('keeps the numeric answer and numeric type of an edited NUMERIC question', () => {
        const [out] = convertQuestionsDataToResponse(
            [base({ questionType: 'NUMERIC', validAnswers: [275], numericType: 'INTEGER' })],
            'updated'
        );
        expect(out!.question_type).toBe('NUMERIC');
        expect(JSON.parse(out!.auto_evaluation_json)).toEqual({
            type: 'NUMERIC',
            data: { validAnswers: [275] },
        });
        expect(JSON.parse(out!.options_json!).numeric_type).toBe('INTEGER');
        expect(out!.options).toEqual([]);
    });

    it('keeps the ONE_WORD answer', () => {
        const [out] = convertQuestionsDataToResponse(
            [base({ questionType: 'ONE_WORD', subjectiveAnswerText: 'entropy' })],
            'updated'
        );
        expect(JSON.parse(out!.auto_evaluation_json).data.answer).toBe('entropy');
    });

    it('sends TRUE_FALSE options, not the blank MCQ ones', () => {
        const [out] = convertQuestionsDataToResponse(
            [
                base({
                    questionType: 'TRUE_FALSE',
                    trueFalseOptions: [
                        { id: 't', name: 'True', isSelected: false },
                        { id: 'f', name: 'False', isSelected: true },
                    ],
                }),
            ],
            'updated'
        );
        expect(out!.options.map((o) => o.text.content)).toEqual(['True', 'False']);
        expect(JSON.parse(out!.auto_evaluation_json).data.correctOptionIds).toEqual(['f']);
    });

    it('maps comprehension types to their backend type and sends the passage', () => {
        const [out] = convertQuestionsDataToResponse(
            [
                base({
                    questionType: 'CNUMERIC',
                    validAnswers: [3],
                    parentRichTextContent: '<p>P</p>',
                }),
            ],
            'updated'
        );
        expect(out!.question_type).toBe('NUMERIC');
        expect(JSON.parse(out!.auto_evaluation_json).data.validAnswers).toEqual([3]);
        expect(out!.parent_rich_text?.content).toBe('<p>P</p>');
    });

    it('leaves MCQS edits as before, and matches a new id-less option by index', () => {
        const [out] = convertQuestionsDataToResponse(
            [
                base({
                    singleChoiceOptions: [
                        { id: 'a', name: 'A', isSelected: false },
                        { id: '', name: 'B', isSelected: true },
                    ],
                }),
            ],
            'updated'
        );
        expect(out!.options.map((o) => [o.id, o.preview_id])).toEqual([
            ['a', 'a'],
            [null, 1],
        ]);
        expect(JSON.parse(out!.auto_evaluation_json)).toEqual({
            type: 'MCQS',
            data: { correctOptionIds: ['1'] },
        });
    });
});

describe('numeric type read-back', () => {
    it('reads both numeric_type and the older numericType key', () => {
        const rows = [
            { options_json: '{"decimals":0,"numeric_type":"DECIMAL"}' },
            { options_json: '{"decimals":0,"numericType":"INTEGER"}' },
        ].map(
            (r, i) =>
                ({
                    id: `q${i}`,
                    question_type: 'NUMERIC',
                    auto_evaluation_json: '{"type":"NUMERIC","data":{"validAnswers":[1]}}',
                    options: [],
                    ...r,
                }) as unknown as QuestionResponse
        );
        expect(transformResponseDataToMyQuestionsSchema(rows).map((q) => q.numericType)).toEqual([
            'DECIMAL',
            'INTEGER',
        ]);
    });
});
