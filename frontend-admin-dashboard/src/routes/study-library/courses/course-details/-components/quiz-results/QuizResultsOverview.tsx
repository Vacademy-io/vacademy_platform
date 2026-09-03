import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowClockwise,
    ClipboardText,
    MagnifyingGlass,
    Target,
    UsersThree,
    WarningCircle,
} from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { MyTable, type TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDropdown } from '@/components/design-system/dropdown';
import { cn } from '@/lib/utils';
import { quizResultsOverviewQueryOptions } from '../../-services/quiz-results-services';
import type { QuizOverviewRow } from '../../-types/quiz-results-types';
import {
    QuizResultsMessage,
    ScoreMeter,
    StatTile,
    formatNumber,
    formatPercent,
    formatRelative,
    scoreToneOf,
} from './quiz-results-shared';

type QuizFilter = 'ALL' | 'ATTEMPTED' | 'NOT_STARTED' | 'NEEDS_ATTENTION';

const FILTERS: { value: QuizFilter; label: string }[] = [
    { value: 'ALL', label: 'All quizzes' },
    { value: 'ATTEMPTED', label: 'Attempted' },
    { value: 'NOT_STARTED', label: 'Not started' },
    { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
];

const SORTS = [
    'Course order',
    'Lowest average score',
    'Highest average score',
    'Lowest participation',
    'Most recent activity',
] as const;
type QuizSort = (typeof SORTS)[number];

/** A quiz the batch is failing: attempted, but averaging under half marks. */
const needsAttention = (quiz: QuizOverviewRow): boolean =>
    quiz.attemptedLearners > 0 && quiz.avgScorePercent !== null && quiz.avgScorePercent < 50;

export default function QuizResultsOverview({
    batchId,
    onOpenQuiz,
}: {
    batchId: string;
    onOpenQuiz: (slideId: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<QuizFilter>('ALL');
    const [sort, setSort] = useState<QuizSort>('Course order');
    const [page, setPage] = useState(0);

    const { data, isLoading, isFetching, error, refetch } = useQuery(
        quizResultsOverviewQueryOptions(batchId)
    );

    const quizzes = useMemo(() => data?.quizzes ?? [], [data]);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = quizzes.filter((quiz) => {
            if (term) {
                const haystack = [quiz.title, quiz.chapterName, quiz.moduleName, quiz.subjectName]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            if (filter === 'ATTEMPTED') return quiz.attemptedLearners > 0;
            if (filter === 'NOT_STARTED') return quiz.attemptedLearners === 0;
            if (filter === 'NEEDS_ATTENTION') return needsAttention(quiz);
            return true;
        });

        // Sorting is client-side on purpose: the whole quiz list for one batch arrives in
        // a single response, so re-ordering it is instant and costs no round trip.
        const sorted = [...filtered];
        switch (sort) {
            case 'Lowest average score':
                sorted.sort((a, b) => (a.avgScorePercent ?? 101) - (b.avgScorePercent ?? 101));
                break;
            case 'Highest average score':
                sorted.sort((a, b) => (b.avgScorePercent ?? -1) - (a.avgScorePercent ?? -1));
                break;
            case 'Lowest participation':
                sorted.sort((a, b) => a.attemptedLearners - b.attemptedLearners);
                break;
            case 'Most recent activity':
                sorted.sort(
                    (a, b) => (b.lastAttemptAtEpochMillis ?? 0) - (a.lastAttemptAtEpochMillis ?? 0)
                );
                break;
            default:
                break;
        }
        return sorted;
    }, [quizzes, search, filter, sort]);

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const tableData: TableData<QuizOverviewRow> = {
        content: visible.slice(safePage * pageSize, safePage * pageSize + pageSize),
        total_pages: totalPages,
        page_no: safePage,
        page_size: pageSize,
        total_elements: visible.length,
        last: safePage >= totalPages - 1,
    };

    const columns = useMemo<ColumnDef<QuizOverviewRow>[]>(
        () => [
            {
                id: 'quiz',
                header: 'Quiz',
                size: 240,
                accessorFn: (row) => row.title ?? '',
                cell: ({ row }) => {
                    const quiz = row.original;
                    const path = [quiz.moduleName, quiz.chapterName].filter(Boolean).join(' › ');
                    return (
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-neutral-700">
                                    {quiz.title || 'Untitled quiz'}
                                </span>
                                {quiz.slideStatus && quiz.slideStatus !== 'PUBLISHED' && (
                                    <span className="shrink-0 rounded-sm border border-neutral-200 bg-neutral-50 px-1.5 text-caption text-neutral-500">
                                        {quiz.slideStatus.toLowerCase()}
                                    </span>
                                )}
                            </div>
                            {path && (
                                <div className="truncate text-caption text-neutral-400">{path}</div>
                            )}
                        </div>
                    );
                },
            },
            {
                id: 'questions',
                header: () => <div className="text-right">Questions</div>,
                size: 92,
                accessorFn: (row) => row.questionCount,
                cell: ({ row }) => (
                    <div className="text-right tabular-nums">
                        <div className="text-neutral-700">{row.original.questionCount}</div>
                        <div className="text-caption text-neutral-400">
                            {row.original.totalMarks} marks
                        </div>
                    </div>
                ),
            },
            {
                id: 'attempted',
                header: 'Attempted',
                size: 160,
                accessorFn: (row) => row.attemptedLearners,
                cell: ({ row }) => {
                    const quiz = row.original;
                    const percent = quiz.enrolledLearners
                        ? (quiz.attemptedLearners * 100) / quiz.enrolledLearners
                        : null;
                    return (
                        <ScoreMeter
                            percent={percent}
                            /* Participation is a coverage figure, not a grade — a green
                               bar next to "34 / 151" would read as good news. */
                            tone={quiz.attemptedLearners === 0 ? 'none' : 'neutral'}
                            label={`${quiz.attemptedLearners} / ${quiz.enrolledLearners}`}
                            subLabel={formatPercent(percent)}
                        />
                    );
                },
            },
            {
                id: 'avgScore',
                header: 'Average score',
                size: 160,
                accessorFn: (row) => row.avgScorePercent ?? -1,
                cell: ({ row }) => {
                    const quiz = row.original;
                    if (quiz.attemptedLearners === 0) {
                        return (
                            <span className="text-caption text-neutral-400">No attempts yet</span>
                        );
                    }
                    return (
                        <ScoreMeter
                            percent={quiz.avgScorePercent}
                            tone={scoreToneOf(quiz.avgScorePercent, quiz.passPercentage)}
                            subLabel={
                                quiz.passPercentage != null
                                    ? `pass ${quiz.passPercentage}%`
                                    : undefined
                            }
                        />
                    );
                },
            },
            {
                id: 'passed',
                header: () => <div className="text-right">Passed</div>,
                size: 100,
                accessorFn: (row) => row.passedLearners ?? -1,
                cell: ({ row }) => {
                    const quiz = row.original;
                    if (quiz.passedLearners === null) {
                        return <span className="text-caption text-neutral-400">No pass mark</span>;
                    }
                    return (
                        <div className="text-right tabular-nums text-neutral-700">
                            {quiz.passedLearners} / {quiz.attemptedLearners}
                        </div>
                    );
                },
            },
            {
                id: 'lastActivity',
                header: 'Last activity',
                size: 130,
                accessorFn: (row) => row.lastAttemptAtEpochMillis ?? 0,
                cell: ({ row }) => (
                    <span className="text-caption text-neutral-500">
                        {formatRelative(row.original.lastAttemptAtEpochMillis)}
                    </span>
                ),
            },
        ],
        []
    );

    if (error) {
        return (
            <QuizResultsMessage
                tone="danger"
                title="Could not load quiz results"
                subtitle="The request failed. Check your connection and try again."
                action={
                    <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                        Retry
                    </MyButton>
                }
            />
        );
    }

    const summary = data?.summary;
    const attentionCount = quizzes.filter(needsAttention).length;

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip — single values, so tiles rather than charts. */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                    label="Quizzes"
                    value={formatNumber(summary?.totalQuizzes ?? 0)}
                    hint={
                        summary?.quizzesWithNoAttempts
                            ? `${summary.quizzesWithNoAttempts} not started yet`
                            : 'All have attempts'
                    }
                    icon={ClipboardText}
                    accent="bg-primary-500"
                />
                <StatTile
                    label="Learners started"
                    value={`${formatNumber(summary?.learnersAttempted ?? 0)} / ${formatNumber(
                        summary?.enrolledLearners ?? 0
                    )}`}
                    hint="At least one quiz done"
                    icon={UsersThree}
                    accent="bg-info-500"
                />
                <StatTile
                    label="Average score"
                    value={formatPercent(summary?.avgScorePercent)}
                    hint="Across all attempts"
                    icon={Target}
                    accent="bg-success-500"
                />
                <StatTile
                    label="Needs attention"
                    value={formatNumber(attentionCount)}
                    hint="Quizzes averaging under 50%"
                    icon={WarningCircle}
                    accent="bg-danger-500"
                />
            </div>

            {/* Toolbar: search, filters and sort in one row above the table. */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                    <MagnifyingGlass
                        className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-neutral-400"
                        aria-hidden="true"
                    />
                    <MyInput
                        inputType="text"
                        input={search}
                        onChangeFunction={(event) => {
                            setSearch(event.target.value);
                            setPage(0);
                        }}
                        inputPlaceholder="Search quizzes or chapters"
                        size="medium"
                        className="w-full pl-9 sm:w-72"
                    />
                </div>

                <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="Filter quizzes"
                >
                    {FILTERS.map((option) => {
                        const isActive = filter === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() => {
                                    setFilter(option.value);
                                    setPage(0);
                                }}
                                className={cn(
                                    'cursor-pointer rounded-lg border px-3 py-1.5 text-caption transition-colors duration-200',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300',
                                    isActive
                                        ? 'border-primary-300 bg-primary-50 font-semibold text-primary-600'
                                        : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                                )}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <MyDropdown
                        currentValue={sort}
                        dropdownList={[...SORTS]}
                        handleChange={(value) => setSort(value as QuizSort)}
                    />
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="icon"
                        aria-label="Refresh quiz results"
                        onClick={() => refetch()}
                        disable={isFetching}
                    >
                        <ArrowClockwise className={cn('size-4', isFetching && 'animate-spin')} />
                    </MyButton>
                </div>
            </div>

            {!isLoading && visible.length === 0 ? (
                <QuizResultsMessage
                    title={
                        quizzes.length === 0
                            ? 'No quizzes in this course yet'
                            : 'No quizzes match these filters'
                    }
                    subtitle={
                        quizzes.length === 0
                            ? 'Add a quiz slide to a chapter and its results will show up here as soon as learners attempt it.'
                            : 'Try a different search term or clear the filters.'
                    }
                    action={
                        quizzes.length > 0 ? (
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => {
                                    setSearch('');
                                    setFilter('ALL');
                                }}
                            >
                                Clear filters
                            </MyButton>
                        ) : undefined
                    }
                />
            ) : (
                <>
                    <MyTable<QuizOverviewRow>
                        data={tableData}
                        columns={columns}
                        isLoading={isLoading}
                        error={null}
                        currentPage={safePage}
                        scrollable
                        enableColumnPinning={false}
                        onCellClick={(row) => onOpenQuiz(row.slideId)}
                        className="[&_tbody_tr]:cursor-pointer"
                    />
                    {totalPages > 1 && (
                        <MyPagination
                            currentPage={safePage}
                            totalPages={totalPages}
                            totalElements={visible.length}
                            pageSize={pageSize}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}
        </div>
    );
}
