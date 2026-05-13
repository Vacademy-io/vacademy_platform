import { MyQuestion } from '@/types/assessments/question-paper-form';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
    | 'MISSING_QUESTION_TEXT'
    | 'MCQ_NO_OPTIONS'
    | 'MCQ_TOO_FEW_OPTIONS'
    | 'MCQ_NO_OPTION_SELECTED'
    | 'MCQS_MULTIPLE_SELECTED'
    | 'MCQ_ANSWER_OUT_OF_RANGE'
    | 'OPTION_EMPTY_TEXT'
    | 'NUMERIC_NO_ANSWER'
    | 'SUBJECTIVE_NO_ANSWER';

export interface QuestionIssue {
    questionIndex: number;
    questionPreview: string;
    questionType: string;
    severity: IssueSeverity;
    code: IssueCode;
    message: string;
    hint: string;
}

const MCQ_TYPES = new Set(['MCQS', 'MCQM', 'CMCQS', 'CMCQM']);
const NUMERIC_TYPES = new Set(['NUMERIC', 'CNUMERIC']);
const SUBJECTIVE_TYPES = new Set(['ONE_WORD', 'LONG_ANSWER']);

const stripHtml = (html: string | undefined | null): string => {
    if (!html) return '';
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const buildPreview = (q: MyQuestion): string => {
    const raw = stripHtml(q.questionName);
    return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw || '(empty question)';
};

const optionsFieldFor = (questionType: string): keyof MyQuestion | null => {
    switch (questionType) {
        case 'MCQS':
            return 'singleChoiceOptions';
        case 'MCQM':
            return 'multipleChoiceOptions';
        case 'CMCQS':
            return 'csingleChoiceOptions';
        case 'CMCQM':
            return 'cmultipleChoiceOptions';
        default:
            return null;
    }
};

export const validateUploadedQuestions = (
    questions: MyQuestion[],
    examType: string = 'EXAM'
): QuestionIssue[] => {
    const issues: QuestionIssue[] = [];
    const isSurvey = examType === 'SURVEY';

    questions.forEach((q, idx) => {
        const preview = buildPreview(q);
        const push = (severity: IssueSeverity, code: IssueCode, message: string, hint: string) => {
            issues.push({
                questionIndex: idx,
                questionPreview: preview,
                questionType: q.questionType || '(unknown)',
                severity,
                code,
                message,
                hint,
            });
        };

        if (!stripHtml(q.questionName)) {
            push(
                'error',
                'MISSING_QUESTION_TEXT',
                'Question text is empty.',
                'Check that the line with this question number (e.g. "(12.)") has text after it in the original document.'
            );
        }

        const qType = q.questionType;

        if (MCQ_TYPES.has(qType)) {
            const field = optionsFieldFor(qType);
            const options = field
                ? (q[field] as Array<{ name?: string; isSelected?: boolean }> | undefined)
                : undefined;

            if (!options || options.length === 0) {
                push(
                    'error',
                    'MCQ_NO_OPTIONS',
                    `${qType} question has no options.`,
                    'Options must start with "(a.)", "(b.)", "(c.)", "(d.)" each on its own line in the document.'
                );
            } else {
                if (options.length < 2) {
                    push(
                        'error',
                        'MCQ_TOO_FEW_OPTIONS',
                        `Only ${options.length} option detected (need at least 2).`,
                        'Add the missing options in the document, or fix here manually before saving.'
                    );
                }

                options.forEach((opt, oIdx) => {
                    if (!opt?.name || !stripHtml(opt.name)) {
                        push(
                            'warning',
                            'OPTION_EMPTY_TEXT',
                            `Option ${oIdx + 1} has empty text.`,
                            'Fill in the option text manually.'
                        );
                    }
                });

                if (!isSurvey) {
                    const selectedCount = options.filter((o) => o.isSelected).length;
                    if (selectedCount === 0) {
                        push(
                            'error',
                            'MCQ_NO_OPTION_SELECTED',
                            'No correct option is marked.',
                            'The answer letter in the "Ans:" line of the document either wasn\'t recognised or didn\'t match any option. Select the correct option(s) manually, or fix the "Ans:" line to use a single letter like (A), (B), (C), or (D).'
                        );
                    } else if (qType === 'MCQS' && selectedCount > 1) {
                        push(
                            'error',
                            'MCQS_MULTIPLE_SELECTED',
                            `${selectedCount} options marked correct for a single-answer question.`,
                            'Single-choice (MCQS) questions must have exactly one option selected. Either deselect the extras or change this to a multiple-choice (MCQM) question.'
                        );
                    }
                }
            }
        } else if (NUMERIC_TYPES.has(qType)) {
            if (!isSurvey && (!q.validAnswers || q.validAnswers.length === 0)) {
                push(
                    'error',
                    'NUMERIC_NO_ANSWER',
                    'Numeric question has no valid answer.',
                    'Enter the correct numeric answer manually.'
                );
            }
        } else if (SUBJECTIVE_TYPES.has(qType)) {
            if (!isSurvey && !stripHtml(q.subjectiveAnswerText)) {
                push(
                    'error',
                    'SUBJECTIVE_NO_ANSWER',
                    `${qType} question has no model answer.`,
                    'Enter the correct answer text manually.'
                );
            }
        }
    });

    return issues;
};

export const getIssueQuestionIndices = (issues: QuestionIssue[]): Set<number> => {
    const set = new Set<number>();
    issues.forEach((i) => set.add(i.questionIndex));
    return set;
};

export const filterQuestionsBySkipSet = (
    questions: MyQuestion[],
    skipIndices: Set<number>
): MyQuestion[] => questions.filter((_, idx) => !skipIndices.has(idx));
