import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import {
    ArrowsClockwise,
    Broadcast,
    CalendarBlank,
    ChartBar,
    CheckCircle,
    DownloadSimple,
    Hourglass,
    Robot,
    Sparkle,
    Users,
    WarningCircle,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyTable, type TableData } from '@/components/design-system/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { cn } from '@/lib/utils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getBatchNamesByIds } from '../assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-utils/helper';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ASSESSMENT_DASHBOARD_QUERY_KEY,
    dashboardToCsv,
    downloadCsv,
    getAssessmentDashboard,
    type AssessmentDashboard,
} from '../-services/assessment-dashboard';

const ALL_BATCHES = '__all__';

type BatchRow = AssessmentDashboard['batches'][number] & { batch_name: string };
type AssessmentRow = AssessmentDashboard['assessments'][number];

const tableOf = <T,>(rows: T[]): TableData<T> => ({
    content: rows,
    total_pages: 1,
    page_no: 0,
    page_size: rows.length,
    total_elements: rows.length,
    last: true,
});

const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** The play mode as a person says it; unknown values fall through unchanged. */
const playModeLabel = (mode: string, t: (k: string) => string): string => {
    const key = `types.${mode}`;
    const label = t(key);
    return label === key ? mode : label;
};

const percentTone = (p: number | null): string =>
    p == null
        ? 'text-neutral-400'
        : p >= 60
          ? 'text-success-600'
          : p >= 35
            ? 'text-warning-600'
            : 'text-danger-600';

const percentBar = (p: number | null): string =>
    p == null
        ? '[&>div]:bg-neutral-300'
        : p >= 60
          ? '[&>div]:bg-success-500'
          : p >= 35
            ? '[&>div]:bg-warning-500'
            : '[&>div]:bg-danger-500';

/**
 * The Overview tab of the Assessments page: what is live, who is sitting tests,
 * what is waiting on a teacher, how each batch is doing, and the latest tests —
 * with one CSV of all of it. Every number comes from one backend call
 * (`dashboard/overview`), optionally scoped to a batch.
 */
export const AssessmentOverviewDashboard = ({
    instituteId,
}: {
    instituteId: string | undefined;
}) => {
    const { t } = useTranslation('assessmentOverviewDashboard');
    const navigate = useNavigate();
    const { instituteDetails } = useInstituteDetailsStore();
    const [batchId, setBatchId] = useState<string>(ALL_BATCHES);
    const batchIds = batchId === ALL_BATCHES ? [] : [batchId];

    const { data, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: [ASSESSMENT_DASHBOARD_QUERY_KEY, instituteId, batchIds.join(',')],
        queryFn: () => getAssessmentDashboard(instituteId as string, batchIds),
        enabled: Boolean(instituteId),
        staleTime: 60 * 1000,
    });

    const batchName = (id: string) =>
        getBatchNamesByIds(instituteDetails?.batches_for_sessions, [id])[0] ?? '';

    const batchOptions = useMemo(() => {
        const all = { label: t('filters.allBatches'), value: ALL_BATCHES };
        const rest = (instituteDetails?.batches_for_sessions ?? [])
            .map((b) => ({ label: batchName(b.id) || b.id, value: b.id }))
            .sort((a, b) => a.label.localeCompare(b.label));
        return [all, ...rest];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instituteDetails?.batches_for_sessions, t]);

    const batchRows: BatchRow[] = useMemo(
        () =>
            (data?.batches ?? []).map((b) => ({
                ...b,
                batch_name: batchName(b.batch_id) || b.batch_id,
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data?.batches, instituteDetails?.batches_for_sessions]
    );

    const openAssessment = (row: AssessmentRow, tab = 'overview') => {
        navigate({
            to: '/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab',
            params: {
                assessmentId: row.assessment_id,
                examType: row.play_mode || 'EXAM',
                assesssmentType: row.visibility || 'PRIVATE',
                assessmentTab: tab,
            },
        });
    };

    const exportCsv = () => {
        if (!data) return;
        const csv = dashboardToCsv(data, batchName, {
            summary: t('csv.summary'),
            batches: t('csv.batches'),
            assessments: t('csv.assessments'),
        });
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`assessment-stats-${stamp}.csv`, csv);
        toast.success(t('toasts.downloaded'));
    };

    const batchColumns: ColumnDef<BatchRow>[] = [
        {
            accessorKey: 'batch_name',
            header: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
            size: 260,
            cell: ({ row }) => (
                <span className="font-medium text-neutral-800">{row.original.batch_name}</span>
            ),
        },
        { accessorKey: 'assessments', header: t('batches.assessments'), size: 100 },
        { accessorKey: 'learners', header: t('batches.learners'), size: 110 },
        { accessorKey: 'attempts', header: t('batches.attempts'), size: 110 },
        {
            accessorKey: 'avg_percent',
            header: t('batches.average'),
            size: 240,
            cell: ({ row }) => {
                const p = row.original.avg_percent;
                return (
                    <div className="flex min-w-36 items-center gap-2">
                        <Progress
                            value={p ?? 0}
                            className={cn('h-2 flex-1 bg-neutral-100', percentBar(p))}
                        />
                        <span
                            className={cn(
                                'w-12 text-right text-caption font-semibold',
                                percentTone(p)
                            )}
                        >
                            {p == null ? '—' : `${p}%`}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'best_percent',
            header: t('batches.range'),
            size: 160,
            cell: ({ row }) => {
                const { lowest_percent: lo, best_percent: hi } = row.original;
                return (
                    <span className="text-caption text-neutral-600">
                        {lo == null || hi == null ? '—' : `${lo}% – ${hi}%`}
                    </span>
                );
            },
        },
    ];

    const assessmentColumns: ColumnDef<AssessmentRow>[] = [
        {
            accessorKey: 'name',
            header: t('recent.assessment'),
            size: 320,
            cell: ({ row }) => (
                <div className="flex min-w-48 flex-col">
                    <span className="font-medium text-neutral-800">{row.original.name}</span>
                    <span className="text-caption text-neutral-500">
                        {formatDate(row.original.start_time)} → {formatDate(row.original.end_time)}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'play_mode',
            header: t('recent.type'),
            size: 200,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-caption">
                        {playModeLabel(row.original.play_mode, t)}
                    </Badge>
                    {row.original.evaluation_type === 'MANUAL' && (
                        <Badge variant="secondary" className="text-caption">
                            {t('recent.manual')}
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'attempted',
            header: t('recent.attempted'),
            size: 170,
            cell: ({ row }) => (
                <span className="text-neutral-700">
                    {row.original.attempted}
                    <span className="text-neutral-400"> / {row.original.participants}</span>
                </span>
            ),
        },
        {
            accessorKey: 'avg_percent',
            header: t('recent.average'),
            size: 110,
            cell: ({ row }) => (
                <span className={cn('font-semibold', percentTone(row.original.avg_percent))}>
                    {row.original.avg_percent == null ? '—' : `${row.original.avg_percent}%`}
                </span>
            ),
        },
        {
            accessorKey: 'pending_evaluation',
            header: t('recent.waiting'),
            size: 220,
            cell: ({ row }) => {
                const { pending_evaluation: pe, to_release: tr } = row.original;
                if (!pe && !tr) return <span className="text-caption text-neutral-400">—</span>;
                return (
                    <div className="flex flex-col items-start gap-1">
                        {pe > 0 && (
                            <Badge className="bg-warning-50 text-caption text-warning-700 hover:bg-warning-50">
                                {t('recent.toEvaluate', { count: pe })}
                            </Badge>
                        )}
                        {tr > 0 && (
                            <Badge className="bg-info-50 text-caption text-info-700 hover:bg-info-50">
                                {t('recent.toRelease', { count: tr })}
                            </Badge>
                        )}
                    </div>
                );
            },
        },
    ];

    if (!instituteId) return null;
    if (isLoading) return <DashboardLoader />;
    if (isError || !data) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-danger-200 bg-danger-50 p-8 text-center">
                <WarningCircle className="size-8 text-danger-600" />
                <p className="text-body text-danger-700">{t('errors.loadFailed')}</p>
                <MyButton buttonType="secondary" scale="small" onClick={() => void refetch()}>
                    {t('actions.retry')}
                </MyButton>
            </div>
        );
    }

    const { counts, participation, pending } = data;
    const attentionItems: Array<{
        key: string;
        value: number;
        label: string;
        icon: React.ReactNode;
        tone: string;
    }> = [
        {
            key: 'manual',
            value: pending.manual_evaluation_pending,
            label: t('attention.manualEvaluation'),
            icon: <Hourglass className="size-4" />,
            tone: 'border-warning-200 bg-warning-50 text-warning-700',
        },
        {
            key: 'release',
            value: pending.results_to_release,
            label: t('attention.resultsToRelease'),
            icon: <CheckCircle className="size-4" />,
            tone: 'border-info-200 bg-info-50 text-info-700',
        },
        {
            key: 'ai',
            value: pending.ai_checks_running,
            label: t('attention.aiRunning'),
            icon: <Robot className="size-4" />,
            tone: 'border-primary-200 bg-primary-50 text-primary-600',
        },
        {
            key: 'aiFailed',
            value: pending.ai_checks_failed,
            label: t('attention.aiFailed'),
            icon: <WarningCircle className="size-4" />,
            tone: 'border-danger-200 bg-danger-50 text-danger-700',
        },
        {
            key: 'reattempt',
            value: pending.reattempt_requests_pending,
            label: t('attention.reattemptRequests'),
            icon: <ArrowsClockwise className="size-4" />,
            tone: 'border-neutral-200 bg-neutral-50 text-neutral-700',
        },
    ];
    const nothingWaiting = attentionItems.every((i) => i.value === 0);

    const stats = [
        {
            key: 'live',
            icon: <Broadcast className="size-5" weight="bold" />,
            label: t('stats.live'),
            value: counts.live,
            hint: t('stats.liveHint', { count: participation.live_attempts }),
            tone: 'bg-success-50 text-success-600',
        },
        {
            key: 'upcoming',
            icon: <CalendarBlank className="size-5" weight="bold" />,
            label: t('stats.upcoming'),
            value: counts.upcoming,
            hint: t('stats.upcomingHint', { previous: counts.previous, drafts: counts.draft }),
            tone: 'bg-info-50 text-info-600',
        },
        {
            key: 'learners',
            icon: <Users className="size-5" weight="bold" />,
            label: t('stats.learners'),
            value: participation.registered_learners,
            hint: t('stats.learnersHint', { count: participation.attempted_learners }),
            tone: 'bg-primary-50 text-primary-600',
        },
        {
            key: 'attempts',
            icon: <ChartBar className="size-5" weight="bold" />,
            label: t('stats.attempts7d'),
            value: participation.attempts_last_7_days,
            hint: t('stats.attemptsHint', { count: participation.attempts_total }),
            tone: 'bg-warning-50 text-warning-600',
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar: scope + export. Sits above the cards so the batch picker reads as
                applying to everything below it, not just one table. */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col">
                    <h2 className="text-h3 font-semibold text-neutral-800">{t('title')}</h2>
                    <p className="text-caption text-neutral-500">{t('subtitle')}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <div className="w-56">
                        <MyDropdown
                            currentValue={
                                batchOptions.find((b) => b.value === batchId)?.label ?? ''
                            }
                            dropdownList={batchOptions}
                            placeholder={t('filters.allBatches')}
                            handleChange={(value) => setBatchId(value)}
                        />
                    </div>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => void refetch()}
                        disable={isFetching}
                    >
                        <ArrowsClockwise className={cn('size-4', isFetching && 'animate-spin')} />
                        {t('actions.refresh')}
                    </MyButton>
                    <MyButton buttonType="primary" scale="medium" onClick={exportCsv}>
                        <DownloadSimple className="size-4" />
                        {t('actions.download')}
                    </MyButton>
                </div>
            </div>

            {/* Headline numbers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((s) => (
                    <div
                        key={s.key}
                        className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                    >
                        <div
                            className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                                s.tone
                            )}
                        >
                            {s.icon}
                        </div>
                        <div className="flex min-w-0 flex-col">
                            <span className="text-caption text-neutral-500">{s.label}</span>
                            <span className="text-h2 font-semibold leading-tight text-neutral-800">
                                {s.value}
                            </span>
                            <span className="truncate text-caption text-neutral-500">{s.hint}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* What needs a teacher */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                    <Sparkle className="size-4 text-primary-500" weight="bold" />
                    <h3 className="text-subtitle font-semibold text-neutral-800">
                        {t('attention.title')}
                    </h3>
                </div>
                {nothingWaiting ? (
                    <p className="flex items-center gap-2 text-body text-success-700">
                        <CheckCircle className="size-4" weight="bold" />
                        {t('attention.nothing')}
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {attentionItems
                            .filter((i) => i.value > 0)
                            .map((i) => (
                                <span
                                    key={i.key}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-body',
                                        i.tone
                                    )}
                                >
                                    {i.icon}
                                    <span className="font-semibold">{i.value}</span>
                                    <span>{i.label}</span>
                                </span>
                            ))}
                    </div>
                )}
            </div>

            {/* Average score by batch */}
            <div className="rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <h3 className="text-subtitle font-semibold text-neutral-800">
                        {t('batches.title', {
                            batch: getTerminology(
                                ContentTerms.Batch,
                                SystemTerms.Batch
                            ).toLowerCase(),
                        })}
                    </h3>
                    <span className="text-caption text-neutral-500">{t('batches.hint')}</span>
                </div>
                {batchRows.length === 0 ? (
                    <p className="p-6 text-center text-body text-neutral-500">
                        {t('batches.empty', {
                            batches: getTerminologyPlural(
                                ContentTerms.Batch,
                                SystemTerms.Batch
                            ).toLowerCase(),
                        })}
                    </p>
                ) : (
                    <div className="p-2">
                        <MyTable<BatchRow>
                            data={tableOf(batchRows)}
                            columns={batchColumns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            scrollable
                        />
                    </div>
                )}
            </div>

            {/* Recent assessments */}
            <div className="rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <h3 className="text-subtitle font-semibold text-neutral-800">
                        {t('recent.title')}
                    </h3>
                    <span className="text-caption text-neutral-500">{t('recent.hint')}</span>
                </div>
                {data.assessments.length === 0 ? (
                    <p className="p-6 text-center text-body text-neutral-500">
                        {t('recent.empty')}
                    </p>
                ) : (
                    <div className="p-2">
                        <MyTable<AssessmentRow>
                            data={tableOf(data.assessments)}
                            columns={assessmentColumns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            scrollable
                            onCellClick={(row) => openAssessment(row)}
                        />
                    </div>
                )}
            </div>

            <p className="text-right text-caption text-neutral-400">
                {t('generatedAt', { time: new Date(data.generated_at).toLocaleTimeString() })}
            </p>
        </div>
    );
};

export default AssessmentOverviewDashboard;
