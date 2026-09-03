import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowClockwise,
    DownloadSimple,
    MagnifyingGlass,
    Target,
    UsersThree,
    WarningCircle,
} from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { MyTable, type TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDropdown } from '@/components/design-system/dropdown';
import { cn } from '@/lib/utils';
import { learnerQuizOverviewQueryOptions } from '../../-services/quiz-results-services';
import type { LearnerQuizRow } from '../../-types/quiz-results-types';
import {
    QuizResultsMessage,
    ScoreMeter,
    StatTile,
    formatNumber,
    formatPercent,
    formatRelative,
    initialsOf,
    scoreToneOf,
} from './quiz-results-shared';

type LearnerFilter = 'ALL' | 'ATTEMPTED' | 'NOT_STARTED' | 'AT_RISK';

const FILTERS: { value: LearnerFilter; label: string }[] = [
    { value: 'ALL', label: 'Everyone' },
    { value: 'ATTEMPTED', label: 'Has attempted' },
    { value: 'NOT_STARTED', label: 'Not started' },
    { value: 'AT_RISK', label: 'At risk' },
];

const SORTS = [
    'Lowest average',
    'Highest average',
    'Name (A–Z)',
    'Most quizzes done',
    'Fewest quizzes done',
    'Most recent activity',
] as const;
type LearnerSort = (typeof SORTS)[number];

/** Attempted something, but averaging under half marks. */
const atRisk = (row: LearnerQuizRow): boolean =>
    row.quizzesAttempted > 0 && row.avgScorePercent !== null && row.avgScorePercent < 50;

const CSV_HEADERS = [
    'Name',
    'Email',
    'Mobile',
    'Quizzes attempted',
    'Quizzes in course',
    'Total attempts',
    'Marks obtained',
    'Max marks (attempted)',
    'Max marks (course)',
    'Average %',
    'Best %',
    'Lowest %',
    'Correct',
    'Wrong',
    'Skipped',
    'Quizzes passed',
    'Last activity',
];

const csvCell = (value: string | number | null | undefined): string => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Quiz Results → Learner-wise.
 *
 * The same graded data as the quiz-wise list, pivoted so the learner is the row: who is
 * keeping up, who has not started, and who is attempting but not scoring. Clicking a row
 * opens their full quiz history in a side panel.
 */
export default function LearnerQuizOverview({
    batchId,
    onOpenLearner,
}: {
    batchId: string;
    onOpenLearner: (userId: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<LearnerFilter>('ALL');
    const [sort, setSort] = useState<LearnerSort>('Lowest average');
    const [page, setPage] = useState(0);

    const { data, isLoading, isFetching, error, refetch } = useQuery(
        learnerQuizOverviewQueryOptions(batchId, true)
    );

    const learners = useMemo(() => data?.learners ?? [], [data]);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = learners.filter((row) => {
            if (term) {
                const haystack = [row.fullName, row.email, row.mobileNumber]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            if (filter === 'ATTEMPTED') return row.quizzesAttempted > 0;
            if (filter === 'NOT_STARTED') return row.quizzesAttempted === 0;
            if (filter === 'AT_RISK') return atRisk(row);
            return true;
        });

        const sorted = [...filtered];
        switch (sort) {
            case 'Highest average':
                sorted.sort((a, b) => (b.avgScorePercent ?? -1) - (a.avgScorePercent ?? -1));
                break;
            case 'Name (A–Z)':
                sorted.sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
                break;
            case 'Most quizzes done':
                sorted.sort((a, b) => b.quizzesAttempted - a.quizzesAttempted);
                break;
            case 'Fewest quizzes done':
                sorted.sort((a, b) => a.quizzesAttempted - b.quizzesAttempted);
                break;
            case 'Most recent activity':
                sorted.sort(
                    (a, b) => (b.lastAttemptAtEpochMillis ?? 0) - (a.lastAttemptAtEpochMillis ?? 0)
                );
                break;
            default:
                // Lowest average, with never-attempted learners last rather than as zeroes —
                // "hasn't started" is a different problem from "is scoring badly".
                sorted.sort((a, b) => (a.avgScorePercent ?? 101) - (b.avgScorePercent ?? 101));
                break;
        }
        return sorted;
    }, [learners, search, filter, sort]);

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const tableData: TableData<LearnerQuizRow> = {
        content: visible.slice(safePage * pageSize, safePage * pageSize + pageSize),
        total_pages: totalPages,
        page_no: safePage,
        page_size: pageSize,
        total_elements: visible.length,
        last: safePage >= totalPages - 1,
    };

    const exportCsv = () => {
        if (visible.length === 0) {
            toast.error('Nothing to export with these filters.');
            return;
        }
        const rows = visible.map((r) =>
            [
                r.fullName,
                r.email,
                r.mobileNumber,
                r.quizzesAttempted,
                r.quizzesInCourse,
                r.totalAttempts,
                r.marksObtained,
                r.attemptedMaxMarks,
                r.courseMaxMarks,
                r.avgScorePercent,
                r.bestScorePercent,
                r.lowestScorePercent,
                r.correctCount,
                r.wrongCount,
                r.skippedCount,
                r.passedQuizzes,
                r.lastAttemptAtEpochMillis
                    ? new Date(r.lastAttemptAtEpochMillis).toISOString()
                    : '',
            ]
                .map(csvCell)
                .join(',')
        );
        const csv = [CSV_HEADERS.join(','), ...rows].join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'quiz-results-by-learner.csv';
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${visible.length} learners`);
    };

    const columns = useMemo<ColumnDef<LearnerQuizRow>[]>(
        () => [
            {
                id: 'learner',
                header: 'Learner',
                size: 240,
                accessorFn: (row) => row.fullName ?? '',
                cell: ({ row }) => {
                    const learner = row.original;
                    return (
                        <div className="flex items-center gap-2.5">
                            <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-600"
                                aria-hidden="true"
                            >
                                {initialsOf(learner.fullName)}
                            </span>
                            <div className="min-w-0">
                                <div className="truncate font-medium text-neutral-700">
                                    {learner.fullName || '—'}
                                </div>
                                <div className="truncate text-caption text-neutral-400">
                                    {learner.email || learner.mobileNumber || ''}
                                </div>
                            </div>
                        </div>
                    );
                },
            },
            {
                id: 'progress',
                header: 'Quizzes done',
                size: 160,
                accessorFn: (row) => row.quizzesAttempted,
                cell: ({ row }) => {
                    const learner = row.original;
                    const percent = learner.quizzesInCourse
                        ? (learner.quizzesAttempted * 100) / learner.quizzesInCourse
                        : null;
                    return (
                        <ScoreMeter
                            percent={percent}
                            /* Coverage, not a grade — see quiz-results-shared. */
                            tone={learner.quizzesAttempted === 0 ? 'none' : 'neutral'}
                            label={`${learner.quizzesAttempted} / ${learner.quizzesInCourse}`}
                            subLabel={formatPercent(percent)}
                        />
                    );
                },
            },
            {
                id: 'average',
                header: 'Average score',
                size: 170,
                accessorFn: (row) => row.avgScorePercent ?? -1,
                cell: ({ row }) => {
                    const learner = row.original;
                    if (learner.quizzesAttempted === 0) {
                        return <span className="text-caption text-neutral-400">Not started</span>;
                    }
                    return (
                        <ScoreMeter
                            percent={learner.avgScorePercent}
                            tone={scoreToneOf(learner.avgScorePercent)}
                            subLabel={`${learner.marksObtained ?? 0}/${learner.attemptedMaxMarks ?? 0}`}
                        />
                    );
                },
            },
            {
                id: 'passed',
                header: () => <div className="text-right">Passed</div>,
                size: 90,
                accessorFn: (row) => row.passedQuizzes,
                cell: ({ row }) => {
                    const learner = row.original;
                    if (learner.quizzesWithPassMark === 0) {
                        return (
                            <div className="text-right text-caption text-neutral-400">
                                No pass mark
                            </div>
                        );
                    }
                    return (
                        <div className="text-right tabular-nums text-neutral-700">
                            {learner.passedQuizzes} / {learner.quizzesWithPassMark}
                        </div>
                    );
                },
            },
            {
                id: 'attempts',
                header: () => <div className="text-right">Attempts</div>,
                size: 90,
                accessorFn: (row) => row.totalAttempts,
                cell: ({ row }) => (
                    <div className="text-right tabular-nums text-neutral-700">
                        {row.original.totalAttempts || '—'}
                    </div>
                ),
            },
            {
                id: 'last',
                header: 'Last activity',
                size: 120,
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
                title="Could not load learner results"
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
    const atRiskCount = learners.filter(atRisk).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                    label="Learners"
                    value={formatNumber(summary?.enrolledLearners ?? 0)}
                    hint={`${formatNumber(summary?.quizzesInCourse ?? 0)} quizzes in this course`}
                    icon={UsersThree}
                    accent="bg-primary-500"
                />
                <StatTile
                    label="Have attempted"
                    value={`${formatNumber(summary?.learnersAttempted ?? 0)} / ${formatNumber(
                        summary?.enrolledLearners ?? 0
                    )}`}
                    hint={`${formatNumber(summary?.learnersNotStarted ?? 0)} have not started`}
                    icon={Target}
                    accent="bg-info-500"
                />
                <StatTile
                    label="Class average"
                    value={formatPercent(summary?.avgScorePercent)}
                    hint="Of learners who started"
                    icon={Target}
                    accent="bg-success-500"
                />
                <StatTile
                    label="At risk"
                    value={formatNumber(atRiskCount)}
                    hint="Averaging under 50%"
                    icon={WarningCircle}
                    accent="bg-danger-500"
                />
            </div>

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
                        inputPlaceholder="Search learners"
                        size="medium"
                        className="w-full pl-9 sm:w-64"
                    />
                </div>

                <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="Filter learners"
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
                        handleChange={(value) => setSort(value as LearnerSort)}
                    />
                    <MyButton buttonType="secondary" scale="medium" onClick={exportCsv}>
                        <DownloadSimple className="size-4" aria-hidden="true" />
                        Export CSV
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="icon"
                        aria-label="Refresh learner results"
                        onClick={() => refetch()}
                        disable={isFetching}
                    >
                        <ArrowClockwise className={cn('size-4', isFetching && 'animate-spin')} />
                    </MyButton>
                </div>
            </div>

            {data?.truncated && (
                <p className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-caption text-warning-700">
                    This batch has more learners than the report returns at once — the list below is
                    capped.
                </p>
            )}

            {!isLoading && visible.length === 0 ? (
                <QuizResultsMessage
                    title={
                        learners.length === 0
                            ? 'No learners enrolled in this batch yet'
                            : 'No learners match these filters'
                    }
                    subtitle={
                        learners.length === 0
                            ? 'Once learners are enrolled, their quiz progress shows up here.'
                            : 'Try a different search term or clear the filters.'
                    }
                    action={
                        learners.length > 0 ? (
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
                    <MyTable<LearnerQuizRow>
                        data={tableData}
                        columns={columns}
                        isLoading={isLoading}
                        error={null}
                        currentPage={safePage}
                        scrollable
                        enableColumnPinning={false}
                        onCellClick={(row) => onOpenLearner(row.userId)}
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
