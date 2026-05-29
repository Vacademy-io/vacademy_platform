import type { Question } from '@/components/common/export-offline/types/question';
import type { GeneratedQuestion } from '../-services/utils';

/**
 * Adapt the simple AI-generated question shape used by the
 * Create-Assessment-from-Recording flow into the richer Question type the
 * shared export pipeline (QuestionComponent / PrintablePaperPages) expects.
 *
 * Option IDs are derived from the option index ("0".."3") so the
 * correctAnswerIndex can be stored in the same `marking_json` shape the
 * existing question-papers flow uses: { data: { correctOptionIds: [...] } }.
 * Option index also becomes the QuestionComponent fallback key when the
 * source has no stable id, keeping highlight logic consistent.
 */
export function mapGeneratedQuestionsForExport(
    items: GeneratedQuestion[]
): Question[] {
    return items.map((q, idx) => {
        const correctIdx =
            typeof q.correctAnswerIndex === 'number' &&
            q.correctAnswerIndex >= 0 &&
            q.correctAnswerIndex < q.options.length
                ? q.correctAnswerIndex
                : null;

        return {
            question_id: q.id || `gq-${idx}`,
            question: {
                id: q.id || `gq-${idx}`,
                type: 'MCQS',
                content: q.question,
            },
            options_with_explanation: q.options.map((opt, oi) => ({
                id: String(oi),
                text: { content: opt },
            })),
            marking_json: JSON.stringify({
                data: {
                    correctOptionIds:
                        correctIdx === null ? [] : [String(correctIdx)],
                    totalMark: 1,
                },
            }),
            question_type: 'MCQS',
            section_id: '',
            question_duration: 1,
            question_order: idx + 1,
            explanation_text: q.explanation || undefined,
        };
    });
}
