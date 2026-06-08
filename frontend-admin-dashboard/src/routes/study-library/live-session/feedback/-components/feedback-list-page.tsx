import { useEffect, useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import {
    Star,
    ChatText,
    WarningCircle,
    MagnifyingGlass,
    X,
    ChatCircleDots,
    DownloadSimple,
    Columns,
    Rows,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyButton } from '@/components/design-system/button';
import { DateRangePresets } from './date-range-presets';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getInstituteId } from '@/constants/helper';
import {
    useLiveClassFeedback,
    useFeedbackSubjects,
    useFeedbackSummary,
    fetchAllLiveClassFeedback,
} from '../-services/getLiveClassFeedback';
import type { LiveClassFeedbackRow } from '../-types/types';
import {
    collectQuestions,
    isStarQuestion,
    isTextQuestion,
    maxStarsFor,
    parseQuestions,
    parseResponses,
    primaryRating,
} from '../-utils/parse';
import { buildCsv, downloadCsv } from '../-utils/csv';
import { MultiSelectPopover, type MultiSelectOption } from './multi-select-popover';
import { FeedbackDetailDialog } from './feedback-detail-dialog';
import { FeedbackAnswers } from './feedback-answers';

const PAGE_SIZE = 10;
const stripDefault = (s: string) => s.replace(/^default\s+/i, '');

export default function FeedbackListPage() {
    const instituteId = getInstituteId() ?? '';
    const { instituteDetails } = useInstituteDetailsStore();

    // Batch options (package_session_id → readable label), mirroring the live
    // session list's batch-label format.
    const batchOptions: MultiSelectOption[] = useMemo(
        () =>
            instituteDetails?.batches_for_sessions?.map((batch) => ({
                value: batch.id,
                label:
                    batch.level.id === 'DEFAULT'
                        ? `${stripDefault(batch.package_dto.package_name)}, ${batch.session.session_name}`.trim()
                        : `${stripDefault(batch.level.level_name)} ${stripDefault(batch.package_dto.package_name)}, ${batch.session.session_name}`.trim(),
            })) ?? [],
        [instituteDetails?.batches_for_sessions]
    );
    const batchLabelMap = useMemo(() => {
        const map = new Map<string, string>();
        batchOptions.forEach((o) => map.set(o.value, o.label));
        return map;
    }, [batchOptions]);

    // Filters
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(() => dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(() => dayjs().format('YYYY-MM-DD'));
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    // Bumped to force-remount the DateRangeFilter (it owns its own state) back to
    // its "30 Days" default when the user clears all filters.
    const [dateFilterKey, setDateFilterKey] = useState(0);
    // 'detailed' = one column per feedback question; 'simple' = all answers
    // collapsed into a single Feedback column.
    const [viewMode, setViewMode] = useState<'detailed' | 'simple'>('detailed');

    // Detail dialog
    const [detailRow, setDetailRow] = useState<LiveClassFeedbackRow | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Debounce the free-text search.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setPage(0);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const subjectsQuery = useFeedbackSubjects(instituteId, selectedBatchIds);
    const subjectOptions: MultiSelectOption[] = useMemo(
        () => (subjectsQuery.data ?? []).map((s) => ({ value: s, label: s })),
        [subjectsQuery.data]
    );

    const { data, isLoading, error } = useLiveClassFeedback({
        instituteId,
        batchIds: selectedBatchIds,
        subjects: selectedSubjects,
        startDate,
        endDate,
        searchQuery,
        page,
        size: PAGE_SIZE,
    });

    const rows = data?.content ?? [];

    // Feedback forms differ per session, so the question columns are the union of
    // questions present in the current page of results.
    const questionCols = useMemo(() => collectQuestions(rows), [data]); // eslint-disable-line react-hooks/exhaustive-deps

    // Summary is computed over ALL filtered feedback (every page), not just the
    // current page — so the average/counts reflect the whole result set.
    const summaryQuery = useFeedbackSummary({
        instituteId,
        batchIds: selectedBatchIds,
        subjects: selectedSubjects,
        startDate,
        endDate,
        searchQuery,
        page: 0,
        size: PAGE_SIZE,
    });
    const summary = useMemo(() => {
        const allRows = summaryQuery.data?.rows ?? [];
        const ratings = allRows
            .map((r) => primaryRating(r))
            .filter((v): v is number => v != null);
        const avg = ratings.length
            ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            : null;
        // Rating scale max (e.g. 5), taken from the first star-rating question.
        let maxStars = 5;
        for (const r of allRows) {
            const starQ = parseQuestions(r).find(isStarQuestion);
            if (starQ) {
                maxStars = maxStarsFor(starQ);
                break;
            }
        }
        return {
            total: summaryQuery.data?.total ?? 0,
            avg,
            maxStars,
            ratingCount: ratings.length,
            lowCount: ratings.filter((r) => r < 3).length,
            isLoading: summaryQuery.isLoading,
        };
    }, [summaryQuery.data, summaryQuery.isLoading]);

    // The "30 Days" default window the page opens with.
    const defaultStartDate = useMemo(() => dayjs().subtract(29, 'day').format('YYYY-MM-DD'), []);
    const defaultEndDate = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

    const hasActiveFilters =
        selectedBatchIds.length > 0 ||
        selectedSubjects.length > 0 ||
        searchInput.trim().length > 0 ||
        startDate !== defaultStartDate ||
        endDate !== defaultEndDate;

    // Clear every filter at once — batch, subject, search and date range.
    const clearAllFilters = () => {
        setSelectedBatchIds([]);
        setSelectedSubjects([]);
        setSearchInput('');
        setSearchQuery('');
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setDateFilterKey((k) => k + 1);
        setPage(0);
    };

    const batchLabelsFor = (csv: string | null): string => {
        if (!csv) return '—';
        const labels = csv
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .map((id) => batchLabelMap.get(id) ?? id);
        return labels.length ? labels.join(', ') : '—';
    };

    const columns: ColumnDef<LiveClassFeedbackRow>[] = useMemo(
        () => [
            {
                accessorKey: 'learnerName',
                header: 'Learner',
                size: 200,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-800">
                            {row.original.learnerName || 'Unknown'}
                        </span>
                        {row.original.learnerEmail && (
                            <span className="text-xs text-neutral-500">
                                {row.original.learnerEmail}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'sessionTitle',
                header: 'Live Class',
                size: 200,
                cell: ({ row }) => (
                    <span className="text-sm text-neutral-700">
                        {row.original.sessionTitle || '—'}
                    </span>
                ),
            },
            {
                accessorKey: 'subject',
                header: 'Subject',
                size: 130,
                cell: ({ row }) =>
                    row.original.subject ? (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600">
                            {row.original.subject}
                        </span>
                    ) : (
                        <span className="text-sm text-neutral-400">—</span>
                    ),
            },
            {
                accessorKey: 'meetingDate',
                header: 'Date',
                size: 120,
                cell: ({ row }) => (
                    <span className="whitespace-nowrap text-sm text-neutral-700">
                        {row.original.meetingDate
                            ? dayjs(row.original.meetingDate).format('DD MMM YYYY')
                            : '—'}
                    </span>
                ),
            },
            {
                accessorKey: 'packageSessionIds',
                header: 'Batch',
                size: 200,
                cell: ({ row }) => (
                    <span
                        className="block w-full truncate text-sm text-neutral-700"
                        title={batchLabelsFor(row.original.packageSessionIds)}
                    >
                        {batchLabelsFor(row.original.packageSessionIds)}
                    </span>
                ),
            },
            // One column per feedback-form question (union across the page).
            ...questionCols.map(
                (q): ColumnDef<LiveClassFeedbackRow> => ({
                    id: `q_${q.id}`,
                    header: q.label,
                    size: 170,
                    cell: ({ row }) => {
                        const value = parseResponses(row.original)[q.id];
                        if (value == null || String(value).trim().length === 0) {
                            return <span className="text-sm text-neutral-400">—</span>;
                        }
                        if (isStarQuestion(q)) {
                            const num = parseFloat(String(value));
                            if (!isNaN(num)) {
                                return (
                                    <span className="flex items-center gap-1 text-sm font-medium text-neutral-800">
                                        <Star weight="fill" className="size-4 text-warning-500" />
                                        {num}
                                        <span className="text-xs text-neutral-400">
                                            /{maxStarsFor(q)}
                                        </span>
                                    </span>
                                );
                            }
                        }
                        return (
                            <span
                                className="block w-full truncate text-sm text-neutral-600"
                                title={String(value)}
                            >
                                {String(value)}
                            </span>
                        );
                    },
                })
            ),
            {
                accessorKey: 'submittedAt',
                header: 'Submitted',
                size: 140,
                cell: ({ row }) => (
                    <span className="whitespace-nowrap text-xs text-neutral-500">
                        {row.original.submittedAt
                            ? dayjs(row.original.submittedAt).format('DD MMM, HH:mm')
                            : '—'}
                    </span>
                ),
            },
        ],
        [batchLabelMap, questionCols]
    );

    // "Simple" view: learner, batch, one combined Feedback column, submitted.
    const simpleColumns: ColumnDef<LiveClassFeedbackRow>[] = useMemo(
        () => [
            {
                accessorKey: 'learnerName',
                header: 'Learner',
                size: 200,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-800">
                            {row.original.learnerName || 'Unknown'}
                        </span>
                        {row.original.learnerEmail && (
                            <span className="text-xs text-neutral-500">
                                {row.original.learnerEmail}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'packageSessionIds',
                header: 'Batch',
                size: 180,
                cell: ({ row }) => (
                    <span
                        className="block w-full truncate text-sm text-neutral-700"
                        title={batchLabelsFor(row.original.packageSessionIds)}
                    >
                        {batchLabelsFor(row.original.packageSessionIds)}
                    </span>
                ),
            },
            {
                id: 'rating',
                header: 'Rating',
                size: 100,
                cell: ({ row }) => {
                    const rating = primaryRating(row.original);
                    return rating != null ? (
                        <span className="flex items-center gap-1 text-sm font-semibold text-neutral-800">
                            <Star weight="fill" className="size-4 text-warning-500" />
                            {rating}
                        </span>
                    ) : (
                        <span className="text-sm text-neutral-400">—</span>
                    );
                },
            },
            {
                id: 'feedback',
                header: 'Feedback',
                size: 440,
                cell: ({ row }) => (
                    <div className="max-w-md py-1">
                        <FeedbackAnswers row={row.original} textOnly />
                    </div>
                ),
            },
            {
                accessorKey: 'submittedAt',
                header: 'Submitted',
                size: 140,
                cell: ({ row }) => (
                    <span className="whitespace-nowrap text-xs text-neutral-500">
                        {row.original.submittedAt
                            ? dayjs(row.original.submittedAt).format('DD MMM, HH:mm')
                            : '—'}
                    </span>
                ),
            },
        ],
        [batchLabelMap]
    );

    const tableData = {
        content: rows,
        total_pages: data?.total_pages ?? 0,
        page_no: data?.page_no ?? 0,
        page_size: data?.page_size ?? PAGE_SIZE,
        total_elements: data?.total_elements ?? 0,
        last: data?.last ?? true,
    };

    const isEmpty = !isLoading && !error && rows.length === 0;

    const batchCsvLabel = (csv: string | null): string => {
        const label = batchLabelsFor(csv);
        return label === '—' ? '' : label;
    };

    // Combined free-text feedback (excludes the star rating) for the Simple CSV.
    const textFeedbackFor = (row: LiveClassFeedbackRow): string => {
        const questions = parseQuestions(row);
        const responses = parseResponses(row);
        return questions
            .filter((q) => isTextQuestion(q))
            .map((q) => {
                const v = responses[q.id];
                return v != null && String(v).trim().length > 0
                    ? `${q.label}: ${String(v).trim()}`
                    : null;
            })
            .filter(Boolean)
            .join(' | ');
    };

    // Export every feedback row matching the current filters (all pages) to CSV.
    const handleExport = async () => {
        try {
            const { rows: allRows, truncated } = await fetchAllLiveClassFeedback({
                instituteId,
                batchIds: selectedBatchIds,
                subjects: selectedSubjects,
                startDate,
                endDate,
                searchQuery,
                page: 0,
                size: PAGE_SIZE,
            });
            if (!allRows.length) {
                toast.info('No feedback to export for the current filters.');
                return;
            }
            let headers: string[];
            let csvRows: Array<Array<string | number>>;

            if (viewMode === 'simple') {
                // Match the Simple view's columns: learner, batch, rating, feedback, submitted.
                headers = ['Learner', 'Batch', 'Rating', 'Feedback', 'Submitted'];
                csvRows = allRows.map((r) => {
                    const rating = primaryRating(r);
                    return [
                        r.learnerName ?? '',
                        batchCsvLabel(r.packageSessionIds),
                        rating != null ? rating : '',
                        textFeedbackFor(r),
                        r.submittedAt ? dayjs(r.submittedAt).format('YYYY-MM-DD HH:mm') : '',
                    ];
                });
            } else {
                // Detailed view: one column per feedback question.
                const exportQuestions = collectQuestions(allRows);
                headers = [
                    'Learner',
                    'Email',
                    'Mobile',
                    'Live Class',
                    'Subject',
                    'Meeting Date',
                    'Batch',
                    'Submitted At',
                    ...exportQuestions.map((q) => q.label),
                ];
                csvRows = allRows.map((r) => {
                    const responses = parseResponses(r);
                    return [
                        r.learnerName ?? '',
                        r.learnerEmail ?? '',
                        r.learnerMobile ?? '',
                        r.sessionTitle ?? '',
                        r.subject ?? '',
                        r.meetingDate ?? '',
                        batchCsvLabel(r.packageSessionIds),
                        r.submittedAt ? dayjs(r.submittedAt).format('YYYY-MM-DD HH:mm') : '',
                        ...exportQuestions.map((q) => {
                            const v = responses[q.id];
                            return v == null ? '' : String(v);
                        }),
                    ];
                });
            }
            downloadCsv(
                `live-class-feedback_${viewMode}_${startDate}_to_${endDate}.csv`,
                buildCsv(headers, csvRows)
            );
            toast.success(
                `Exported ${allRows.length} feedback ${allRows.length === 1 ? 'response' : 'responses'}.`
            );
            if (truncated) {
                toast.warning('Export was capped — narrow the filters to export the remaining rows.');
            }
        } catch {
            toast.error('Could not export feedback. Please try again.');
        }
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                        <ChatCircleDots className="size-5" weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-semibold text-neutral-800">
                            Live Class Feedback
                        </h1>
                        <p className="text-sm text-neutral-500">
                            Review learner feedback across all live classes, filtered by batch,
                            subject and date.
                        </p>
                    </div>
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onAsyncClick={handleExport}
                    loadingText="Exporting…"
                    disable={(data?.total_elements ?? 0) === 0}
                >
                    <span className="flex items-center gap-2">
                        <DownloadSimple className="size-4" />
                        Export CSV
                    </span>
                </MyButton>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-60 flex-1">
                        <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by learner or class title…"
                            className="h-9 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-8 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <MultiSelectPopover
                        label="Batch"
                        options={batchOptions}
                        selected={selectedBatchIds}
                        onChange={(next) => {
                            setSelectedBatchIds(next);
                            setPage(0);
                        }}
                        emptyText="No batches"
                    />
                    <MultiSelectPopover
                        label="Subject"
                        options={subjectOptions}
                        selected={selectedSubjects}
                        onChange={(next) => {
                            setSelectedSubjects(next);
                            setPage(0);
                        }}
                        emptyText={subjectsQuery.isLoading ? 'Loading…' : 'No subjects'}
                    />
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            className="flex h-9 items-center gap-1.5 rounded-md border border-danger-200 bg-danger-50 px-3 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-100"
                        >
                            <X size={14} />
                            Clear all
                        </button>
                    )}
                </div>
                <DateRangePresets
                    key={dateFilterKey}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(start, end) => {
                        setStartDate(start);
                        setEndDate(end);
                        setPage(0);
                    }}
                />
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <SummaryCard
                    icon={<ChatText weight="fill" className="size-5 text-primary-500" />}
                    label="Total responses"
                    value={summary.isLoading ? '…' : summary.total.toLocaleString()}
                />
                <SummaryCard
                    icon={<Star weight="fill" className="size-5 text-warning-500" />}
                    label="Avg rating"
                    value={
                        summary.isLoading ? (
                            '…'
                        ) : summary.avg ? (
                            <>
                                {summary.avg}
                                <span className="text-sm font-normal text-neutral-400">
                                    {' '}
                                    / {summary.maxStars}
                                </span>
                            </>
                        ) : (
                            '—'
                        )
                    }
                />
                <SummaryCard
                    icon={<WarningCircle weight="fill" className="size-5 text-danger-500" />}
                    label="Low ratings"
                    value={summary.isLoading ? '…' : `${summary.lowCount}`}
                    hint="rated below 3"
                />
            </div>

            {/* View toggle */}
            <div className="flex items-center justify-end">
                <div className="inline-flex rounded-md border border-neutral-200 p-0.5">
                    {(
                        [
                            { mode: 'detailed' as const, label: 'Detailed', icon: Columns },
                            { mode: 'simple' as const, label: 'Simple', icon: Rows },
                        ]
                    ).map(({ mode, label, icon: Icon }) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            className={cn(
                                'flex items-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors',
                                viewMode === mode
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-neutral-600 hover:bg-neutral-50'
                            )}
                        >
                            <Icon className="size-4" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table / states */}
            {error ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white text-center">
                    <WarningCircle className="size-8 text-danger-500" />
                    <p className="text-sm text-neutral-600">Could not load feedback. Please retry.</p>
                </div>
            ) : isEmpty ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white text-center">
                    <ChatCircleDots className="size-10 text-neutral-300" />
                    <h2 className="text-base font-semibold text-neutral-600">No feedback found</h2>
                    <p className="max-w-xs text-sm text-neutral-500">
                        No learners submitted feedback for the selected batch, subject and date range.
                    </p>
                </div>
            ) : (
                <>
                    <MyTable<LiveClassFeedbackRow>
                        data={tableData}
                        columns={viewMode === 'simple' ? simpleColumns : columns}
                        isLoading={isLoading}
                        error={error}
                        currentPage={page}
                        scrollable
                        onCellClick={(row) => {
                            setDetailRow(row);
                            setDialogOpen(true);
                        }}
                    />
                    {tableData.total_pages > 1 && (
                        <MyPagination
                            currentPage={page}
                            totalPages={tableData.total_pages}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}

            <FeedbackDetailDialog row={detailRow} open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    );
}

function SummaryCard({
    icon,
    label,
    value,
    hint,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    hint?: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-neutral-50">
                {icon}
            </span>
            <div>
                <p className="text-xs text-neutral-500">{label}</p>
                <p className="text-lg font-semibold text-neutral-800">
                    {value}
                    {hint && <span className="ml-1 text-xs font-normal text-neutral-400">{hint}</span>}
                </p>
            </div>
        </div>
    );
}
