import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, CheckCircle, Circle, Info, XCircle } from '@phosphor-icons/react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { cn } from '@/lib/utils';
import {
    learnerQuizAnswersQueryOptions,
    learnerQuizDetailQueryOptions,
} from '../../-services/quiz-results-services';
import type {
    AnswerVerdict,
    LearnerAnswer,
    LearnerQuizAttempt,
    LearnerQuizDetailRow,
} from '../../-types/quiz-results-types';
import {
    LearnerStatusChip,
    QuizResultsMessage,
    ScoreMeter,
    formatDateTime,
    formatDuration,
    formatPercent,
    initialsOf,
    scoreToneOf,
} from './quiz-results-shared';

/**
 * One learner's full quiz history, in a right-hand side panel.
 *
 * Three levels, each loaded only when opened: their totals and quiz list, then one quiz's
 * attempts, then the answers on one attempt. A learner with 100 quizzes would otherwise
 * pull every answer they have ever given just to show a summary.
 */
export default function LearnerQuizSideView({
    batchId,
    userId,
    onClose,
}: {
    batchId: string;
    userId: string | null;
    onClose: () => void;
}) {
    const { data, isLoading, error, refetch } = useQuery(
        learnerQuizDetailQueryOptions(batchId, userId)
    );

    return (
        <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="flex size-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
            >
                {isLoading && (
                    <div className="flex flex-1 items-center justify-center">
                        <DashboardLoader size={28} />
                    </div>
                )}

                {error && (
                    <div className="p-6">
                        <QuizResultsMessage
                            tone="danger"
                            title="Could not load this learner's results"
                            action={
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() => refetch()}
                                >
                                    Retry
                                </MyButton>
                            }
                        />
                    </div>
                )}

                {data && !isLoading && (
                    <>
                        <header className="shrink-0 border-b border-neutral-200 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-subtitle font-semibold text-primary-600"
                                    aria-hidden="true"
                                >
                                    {initialsOf(data.learner.fullName)}
                                </span>
                                <div className="min-w-0">
                                    <h2 className="truncate text-title font-semibold text-neutral-700">
                                        {data.learner.fullName || 'Unnamed learner'}
                                    </h2>
                                    <p className="truncate text-caption text-neutral-400">
                                        {data.learner.email || data.learner.mobileNumber || ''}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <HeaderStat
                                    label="Quizzes done"
                                    value={`${data.learner.quizzesAttempted} / ${data.learner.quizzesInCourse}`}
                                />
                                <HeaderStat
                                    label="Average"
                                    value={formatPercent(data.learner.avgScorePercent)}
                                />
                                <HeaderStat
                                    label="Marks so far"
                                    value={`${data.learner.marksObtained ?? 0} / ${
                                        data.learner.attemptedMaxMarks ?? 0
                                    }`}
                                    hint={`Out of ${data.learner.courseMaxMarks ?? 0} across all quizzes`}
                                />
                                <HeaderStat
                                    label="Attempts"
                                    value={String(data.learner.totalAttempts)}
                                    hint={
                                        data.learner.quizzesWithPassMark > 0
                                            ? `${data.learner.passedQuizzes}/${data.learner.quizzesWithPassMark} passed`
                                            : undefined
                                    }
                                />
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {data.quizzes.length === 0 ? (
                                <QuizResultsMessage
                                    title="This course has no quizzes yet"
                                    subtitle="Add a quiz slide to a chapter and this learner's results will appear here."
                                />
                            ) : (
                                <ol className="flex flex-col gap-2">
                                    {data.quizzes.map((quiz) => (
                                        <QuizRow
                                            key={quiz.slideId}
                                            quiz={quiz}
                                            batchId={batchId}
                                            userId={userId as string}
                                        />
                                    ))}
                                </ol>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

function HeaderStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <p className="truncate text-caption uppercase tracking-wide text-neutral-500">
                {label}
            </p>
            <p className="mt-0.5 text-subtitle font-semibold tabular-nums text-neutral-700">
                {value}
            </p>
            {hint && <p className="truncate text-caption text-neutral-400">{hint}</p>}
        </div>
    );
}

/** One quiz in the learner's list; expands to their attempts and answers. */
function QuizRow({
    quiz,
    batchId,
    userId,
}: {
    quiz: LearnerQuizDetailRow;
    batchId: string;
    userId: string;
}) {
    const [open, setOpen] = useState(false);
    const attempted = quiz.status !== 'NOT_ATTEMPTED';

    return (
        <li className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <button
                type="button"
                onClick={() => attempted && setOpen((previous) => !previous)}
                aria-expanded={open}
                disabled={!attempted}
                className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300',
                    attempted ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default'
                )}
            >
                <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-neutral-700">
                        {quiz.title || 'Untitled quiz'}
                    </p>
                    <p className="truncate text-caption text-neutral-400">
                        {[quiz.moduleName, quiz.chapterName].filter(Boolean).join(' › ') ||
                            'Not mapped to a chapter'}
                    </p>
                </div>

                {attempted ? (
                    <div className="w-28 shrink-0">
                        <ScoreMeter
                            percent={quiz.scorePercent}
                            tone={scoreToneOf(quiz.scorePercent, quiz.passPercentage)}
                            subLabel={`${quiz.marksObtained ?? 0}/${quiz.totalMarks ?? 0}`}
                        />
                    </div>
                ) : (
                    <span className="w-28 shrink-0 text-right text-caption text-neutral-400">
                        Not attempted
                    </span>
                )}

                <div className="hidden w-24 shrink-0 sm:block">
                    <LearnerStatusChip status={quiz.status} />
                </div>

                <span className="w-16 shrink-0 text-right text-caption tabular-nums text-neutral-500">
                    {attempted
                        ? `${quiz.attemptCount} ${quiz.attemptCount === 1 ? 'try' : 'tries'}`
                        : '—'}
                </span>

                <CaretDown
                    className={cn(
                        'size-4 shrink-0 text-neutral-400 transition-transform duration-200',
                        open && 'rotate-180',
                        !attempted && 'invisible'
                    )}
                    aria-hidden="true"
                />
            </button>

            {open && attempted && (
                <QuizAttempts batchId={batchId} slideId={quiz.slideId} userId={userId} />
            )}
        </li>
    );
}

/** All of the learner's attempts at one quiz, newest first, each expandable to its answers. */
function QuizAttempts({
    batchId,
    slideId,
    userId,
}: {
    batchId: string;
    slideId: string;
    userId: string;
}) {
    const { data, isLoading, error } = useQuery(
        learnerQuizAnswersQueryOptions(batchId, slideId, userId)
    );
    const [openAttempt, setOpenAttempt] = useState<number | null>(null);

    if (isLoading) {
        return (
            <div className="flex justify-center border-t border-neutral-100 py-6">
                <DashboardLoader size={20} />
            </div>
        );
    }
    if (error || !data) {
        return (
            <p className="border-t border-neutral-100 p-3 text-caption text-danger-600">
                Could not load this learner&apos;s answers.
            </p>
        );
    }

    // Newest first: the latest attempt is the one that counts, so it leads.
    const attempts = [...data.attempts].reverse();

    return (
        <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2">
            {attempts.length === 0 ? (
                <p className="py-2 text-caption text-neutral-500">No recorded attempts.</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {attempts.map((attempt) => (
                        <AttemptRow
                            key={attempt.activityId}
                            attempt={attempt}
                            totalAttempts={data.attempts.length}
                            totalMarks={data.totalMarks}
                            open={openAttempt === attempt.attemptNumber}
                            onToggle={() =>
                                setOpenAttempt((previous) =>
                                    previous === attempt.attemptNumber
                                        ? null
                                        : attempt.attemptNumber
                                )
                            }
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function AttemptRow({
    attempt,
    totalAttempts,
    totalMarks,
    open,
    onToggle,
}: {
    attempt: LearnerQuizAttempt;
    totalAttempts: number;
    totalMarks: number | null;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <li className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors duration-200 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
                <span className="shrink-0 text-caption font-semibold text-neutral-700">
                    Attempt {attempt.attemptNumber}
                    <span className="font-regular text-neutral-400"> of {totalAttempts}</span>
                </span>
                {attempt.latest && (
                    <span
                        className="shrink-0 rounded-sm border border-info-200 bg-info-50 px-1.5 text-caption text-info-600"
                        title="This is the attempt their score is taken from"
                    >
                        counts as their score
                    </span>
                )}
                <span className="min-w-0 flex-1 truncate text-caption text-neutral-400">
                    {formatDateTime(attempt.attemptedAtEpochMillis)}
                    {attempt.timeSpentSeconds
                        ? ` · ${formatDuration(attempt.timeSpentSeconds)}`
                        : ''}
                </span>
                <span className="shrink-0 text-caption tabular-nums text-neutral-600">
                    {attempt.marksObtained ?? 0}/{totalMarks ?? 0}
                </span>
                <span className="w-12 shrink-0 text-right text-body font-semibold tabular-nums text-neutral-700">
                    {formatPercent(attempt.scorePercent)}
                </span>
                <CaretDown
                    className={cn(
                        'size-4 shrink-0 text-neutral-400 transition-transform duration-200',
                        open && 'rotate-180'
                    )}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div className="border-t border-neutral-100 px-3 py-2">
                    <p className="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-caption tabular-nums">
                        <span className="text-success-700">{attempt.correctCount} correct</span>
                        {attempt.wrongCount > 0 && (
                            <span className="text-danger-600">{attempt.wrongCount} wrong</span>
                        )}
                        {attempt.skippedCount > 0 && (
                            <span className="text-neutral-500">{attempt.skippedCount} skipped</span>
                        )}
                        {attempt.unansweredCount > 0 && (
                            <span className="text-neutral-400">
                                {attempt.unansweredCount} not answered
                            </span>
                        )}
                        {attempt.ungradedCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-neutral-400">
                                <Info className="size-3.5" aria-hidden="true" />
                                {attempt.ungradedCount} need manual marking
                            </span>
                        )}
                    </p>
                    <ol className="flex flex-col gap-2">
                        {attempt.answers.map((answer) => (
                            <AnswerRow key={answer.questionId} answer={answer} />
                        ))}
                    </ol>
                </div>
            )}
        </li>
    );
}

const VERDICT_LABEL: Record<AnswerVerdict, string> = {
    CORRECT: 'Correct',
    WRONG: 'Wrong',
    SKIPPED: 'Skipped',
    UNGRADED: 'Needs marking',
    NOT_ANSWERED: 'Not answered',
};

const VERDICT_CLASS: Record<AnswerVerdict, string> = {
    CORRECT: 'border-success-400 bg-success-50 text-success-700',
    WRONG: 'border-danger-400 bg-danger-50 text-danger-600',
    SKIPPED: 'border-neutral-300 bg-neutral-50 text-neutral-600',
    UNGRADED: 'border-neutral-300 bg-neutral-50 text-neutral-500',
    NOT_ANSWERED: 'border-neutral-300 bg-neutral-50 text-neutral-500',
};

/** One question on one attempt: what they picked, what was right, what it earned. */
function AnswerRow({ answer }: { answer: LearnerAnswer }) {
    return (
        <li className="rounded-md border border-neutral-200 bg-white p-2.5">
            <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-caption text-neutral-700">
                    <span className="mr-1.5 font-semibold text-neutral-500">Q{answer.order}.</span>
                    {answer.questionText || 'Untitled question'}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                    <span
                        className={cn(
                            'rounded-md border px-1.5 py-0.5 text-caption font-medium',
                            VERDICT_CLASS[answer.verdict] ?? VERDICT_CLASS.NOT_ANSWERED
                        )}
                    >
                        {VERDICT_LABEL[answer.verdict] ?? answer.verdict}
                    </span>
                    <span className="text-caption tabular-nums text-neutral-500">
                        {answer.marksAwarded}/{answer.marks}
                    </span>
                </div>
            </div>

            {answer.options.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                    {answer.options.map((option) => (
                        <li key={option.optionId} className="flex items-center gap-2">
                            {option.correct ? (
                                <CheckCircle
                                    className="size-4 shrink-0 text-success-600"
                                    weight="fill"
                                    aria-label="Correct answer"
                                />
                            ) : option.selected ? (
                                <XCircle
                                    className="size-4 shrink-0 text-danger-600"
                                    weight="fill"
                                    aria-label="Learner's answer"
                                />
                            ) : (
                                <Circle
                                    className="size-4 shrink-0 text-neutral-300"
                                    aria-hidden="true"
                                />
                            )}
                            <span
                                className={cn(
                                    'min-w-0 flex-1 truncate text-caption',
                                    option.correct
                                        ? 'font-medium text-success-700'
                                        : option.selected
                                          ? 'text-danger-600'
                                          : 'text-neutral-600'
                                )}
                            >
                                {option.text || 'Untitled option'}
                            </span>
                            {option.selected && (
                                <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 text-caption text-neutral-600">
                                    their answer
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                /* Free-text / numeric questions have no options to tick. */
                <div className="mt-2 flex flex-col gap-0.5 text-caption">
                    <span className="text-neutral-600">
                        <span className="text-neutral-400">Answered: </span>
                        {answer.learnerAnswer || '—'}
                    </span>
                    {answer.correctAnswer && (
                        <span className="text-success-700">
                            <span className="text-neutral-400">Expected: </span>
                            {answer.correctAnswer}
                        </span>
                    )}
                </div>
            )}
        </li>
    );
}
