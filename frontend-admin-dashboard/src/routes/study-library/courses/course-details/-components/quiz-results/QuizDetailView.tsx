import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowClockwise, ArrowLeft, Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { cn } from '@/lib/utils';
import { quizLearnerResultsQueryOptions } from '../../-services/quiz-results-services';
import QuizLearnersPanel from './QuizLearnersPanel';
import QuizQuestionsPanel from './QuizQuestionsPanel';
import QuizScoreDistribution from './QuizScoreDistribution';
import {
    QuizResultsMessage,
    StatTile,
    formatDuration,
    formatNumber,
    formatPercent,
} from './quiz-results-shared';

type DetailView = 'LEARNERS' | 'QUESTIONS';

const VIEWS: { value: DetailView; label: string }[] = [
    { value: 'LEARNERS', label: 'Learners' },
    { value: 'QUESTIONS', label: 'Question analysis' },
];

/** One quiz: its headline numbers, the score spread, and the two drill-downs. */
export default function QuizDetailView({
    batchId,
    slideId,
    onBack,
}: {
    batchId: string;
    slideId: string;
    onBack: () => void;
}) {
    const [view, setView] = useState<DetailView>('LEARNERS');
    const { data, isLoading, isFetching, error, refetch } = useQuery(
        quizLearnerResultsQueryOptions(batchId, slideId)
    );

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <DashboardLoader size={28} />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col gap-3">
                <BackLink onBack={onBack} />
                <QuizResultsMessage
                    tone="danger"
                    title="Could not load this quiz's results"
                    subtitle="The request failed. Check your connection and try again."
                    action={
                        <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                            Retry
                        </MyButton>
                    }
                />
            </div>
        );
    }

    const { quiz, distribution, learners, truncated } = data;
    const path = [quiz.subjectName, quiz.moduleName, quiz.chapterName].filter(Boolean).join(' › ');

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <BackLink onBack={onBack} />
                    <h2 className="mt-1 truncate text-h3-semibold text-neutral-700">
                        {quiz.title || 'Untitled quiz'}
                    </h2>
                    <p className="truncate text-caption text-neutral-400">
                        {path || 'Not mapped to a chapter'}
                        {quiz.timeLimitInMinutes ? ` · ${quiz.timeLimitInMinutes} min limit` : ''}
                        {quiz.reAttemptCount ? ` · ${quiz.reAttemptCount} re-attempts allowed` : ''}
                    </p>
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="icon"
                    aria-label="Refresh this quiz's results"
                    onClick={() => refetch()}
                    disable={isFetching}
                >
                    <ArrowClockwise className={cn('size-4', isFetching && 'animate-spin')} />
                </MyButton>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                    label="Attempted"
                    value={`${quiz.attemptedLearners} / ${quiz.enrolledLearners}`}
                    hint={`${quiz.totalAttempts} attempts in total`}
                    accent="bg-info-500"
                />
                <StatTile
                    label="Average score"
                    value={formatPercent(quiz.avgScorePercent)}
                    hint={`Median ${formatPercent(quiz.medianScorePercent)} · out of ${
                        quiz.totalMarks
                    } marks`}
                    accent="bg-primary-500"
                />
                <StatTile
                    label={quiz.passPercentage != null ? 'Passed' : 'Score range'}
                    value={
                        quiz.passPercentage != null
                            ? `${formatNumber(quiz.passedLearners)} / ${quiz.attemptedLearners}`
                            : `${formatPercent(quiz.lowestScorePercent)} – ${formatPercent(
                                  quiz.highestScorePercent
                              )}`
                    }
                    hint={
                        quiz.passPercentage != null
                            ? `Pass mark ${quiz.passPercentage}%`
                            : 'This quiz has no pass mark'
                    }
                    accent="bg-success-500"
                />
                <StatTile
                    label="Average time"
                    value={formatDuration(quiz.avgTimeSeconds)}
                    hint="Per learner, latest attempt"
                    accent="bg-neutral-400"
                />
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
                <QuizScoreDistribution
                    buckets={distribution?.buckets ?? []}
                    passPercentage={quiz.passPercentage}
                    totalLearners={quiz.attemptedLearners}
                />
            </div>

            {quiz.ungradedResponses > 0 && (
                <p className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-caption text-neutral-600">
                    <Info className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                    <span>
                        {quiz.ungradedResponses} response
                        {quiz.ungradedResponses === 1 ? '' : 's'} could not be graded automatically
                        (free-text or manually-evaluated questions). They are left out of the scores
                        above rather than counted as wrong.
                    </span>
                </p>
            )}

            <div
                className="inline-flex w-fit gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
                role="tablist"
                aria-label="Quiz result views"
            >
                {VIEWS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        id={`quiz-results-tab-${option.value}`}
                        aria-selected={view === option.value}
                        aria-controls="quiz-results-panel"
                        onClick={() => setView(option.value)}
                        className={cn(
                            'cursor-pointer rounded-md px-3.5 py-1.5 text-body transition-colors duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300',
                            view === option.value
                                ? 'bg-white font-semibold text-neutral-800 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-700'
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div
                id="quiz-results-panel"
                role="tabpanel"
                aria-labelledby={`quiz-results-tab-${view}`}
            >
                {view === 'LEARNERS' ? (
                    <QuizLearnersPanel quiz={quiz} learners={learners} truncated={truncated} />
                ) : (
                    /* Mounted only when opened, so the list view never pays for this query. */
                    <QuizQuestionsPanel batchId={batchId} slideId={slideId} />
                )}
            </div>
        </div>
    );
}

function BackLink({ onBack }: { onBack: () => void }) {
    return (
        <button
            type="button"
            onClick={onBack}
            className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-caption text-neutral-500 transition-colors duration-200 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All quizzes
        </button>
    );
}
