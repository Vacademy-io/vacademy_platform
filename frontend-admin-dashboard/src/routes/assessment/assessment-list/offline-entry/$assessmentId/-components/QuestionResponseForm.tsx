import { QuestionResponseState, ScoringMode } from '../-utils/types';
import { RichContentRenderer } from './RichContentRenderer';

interface OptionItem {
    id: string;
    text?: { content?: string };
}

interface QuestionWithOptions {
    question_id: string;
    question: { id: string; type: string; content: string };
    question_type: string;
    marking_json: string;
    options?: OptionItem[];
    options_with_explanation?: OptionItem[];
}

interface QuestionResponseFormProps {
    question: QuestionWithOptions;
    questionIndex: number;
    totalQuestions: number;
    response: QuestionResponseState;
    scoringMode: ScoringMode;
    onResponseChange: (questionId: string, response: QuestionResponseState) => void;
    onPrevious: () => void;
    onNext: () => void;
    onSubmit: () => void;
}

export const QuestionResponseForm = ({
    question,
    questionIndex,
    totalQuestions,
    response,
    scoringMode,
    onResponseChange,
    onPrevious,
    onNext,
    onSubmit,
}: QuestionResponseFormProps) => {
    const markingJson = question.marking_json ? JSON.parse(question.marking_json) : {};
    const totalMark = markingJson?.data?.totalMark ?? 0;
    const questionType = question.question_type;
    const isSingleChoice = questionType === 'MCQS' || questionType === 'TRUE_FALSE';
    const isLastQuestion = questionIndex === totalQuestions - 1;

    const options: OptionItem[] =
        question.options_with_explanation?.length
            ? question.options_with_explanation
            : question.options ?? [];

    const handleOptionToggle = (optionId: string) => {
        let newOptionIds: string[];

        if (isSingleChoice) {
            newOptionIds =
                response.selectedOptionIds.includes(optionId) ? [] : [optionId];
        } else {
            if (response.selectedOptionIds.includes(optionId)) {
                newOptionIds = response.selectedOptionIds.filter((id) => id !== optionId);
            } else {
                newOptionIds = [...response.selectedOptionIds, optionId];
            }
        }

        onResponseChange(question.question_id, {
            ...response,
            selectedOptionIds: newOptionIds,
        });

        // Auto-advance to next question for single choice after selection
        if (isSingleChoice && newOptionIds.length > 0) {
            setTimeout(() => {
                if (!isLastQuestion) {
                    onNext();
                }
            }, 300);
        }
    };

    const handleClear = () => {
        onResponseChange(question.question_id, {
            selectedOptionIds: [],
            marks: undefined,
            status: undefined,
        });
    };

    const handleMarksChange = (marks: number) => {
        onResponseChange(question.question_id, { ...response, marks });
    };

    const handleStatusChange = (status: string) => {
        onResponseChange(question.question_id, { ...response, status });
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Question Header */}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                    Question {questionIndex + 1} of {totalQuestions}
                </span>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {questionType} | Max Marks: {totalMark}
                </span>
            </div>

            {/* Question Text */}
            <RichContentRenderer
                html={question.question?.content || 'No question text available'}
                className="prose prose-sm max-w-none rounded-md border bg-white p-4"
            />

            {/* Options */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700">
                    {isSingleChoice ? 'Select one option:' : 'Select all that apply:'}
                </p>
                {options.map((option: OptionItem, idx: number) => {
                    const isSelected = response.selectedOptionIds.includes(option.id);
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => handleOptionToggle(option.id)}
                            className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-all ${
                                isSelected
                                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-300'
                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${isSingleChoice ? 'rounded-full' : 'rounded-sm'} border ${
                                    isSelected
                                        ? 'border-primary-500 bg-primary-500 text-white'
                                        : 'border-gray-300'
                                }`}
                            >
                                {isSelected && (isSingleChoice ? '\u2022' : '\u2713')}
                            </span>
                            <span className="flex-1">
                                <span className="mr-2 font-medium text-gray-500">
                                    {String.fromCharCode(65 + idx)}.
                                </span>
                                <RichContentRenderer
                                    html={option.text?.content || `Option ${idx + 1}`}
                                    className="inline"
                                />
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Direct Marks Input */}
            {scoringMode === 'DIRECT_MARKS' && (
                <div className="flex flex-wrap gap-4 rounded-md border bg-gray-50 p-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Marks</label>
                        <input
                            type="number"
                            step="0.5"
                            value={response.marks ?? ''}
                            onChange={(e) =>
                                handleMarksChange(parseFloat(e.target.value) || 0)
                            }
                            className="w-24 rounded-md border px-2 py-1.5 text-sm"
                            placeholder="0"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Status</label>
                        <select
                            value={response.status ?? ''}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="rounded-md border px-2 py-1.5 text-sm"
                        >
                            <option value="">Select</option>
                            <option value="CORRECT">Correct</option>
                            <option value="INCORRECT">Incorrect</option>
                            <option value="PARTIAL_CORRECT">Partial Correct</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between border-t pt-4">
                <button
                    onClick={handleClear}
                    className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                >
                    Clear Response
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={onPrevious}
                        disabled={questionIndex === 0}
                        className="rounded-md border px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                        Previous
                    </button>
                    {isLastQuestion ? (
                        <button
                            onClick={onSubmit}
                            className="rounded-md bg-green-600 px-6 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                        >
                            Submit
                        </button>
                    ) : (
                        <button
                            onClick={onNext}
                            className="rounded-md bg-primary-500 px-4 py-1.5 text-sm font-medium text-white"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
