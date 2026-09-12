import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    CalendarCheck,
    Presentation,
    Timer,
    ChatsCircle,
    Export,
    ArrowSquareOut,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { resolveInstituteLogoUrl } from './-utils/instituteLogo';
import LiveReportFilterForm, { AppliedLiveFilters } from './liveReportFilterForm';
import { useLiveBatchReport } from './-services/liveReportApi';
import { computeBatchSummary, formatDuration } from './-utils/liveCompute';
import { exportBatchLivePdf } from './-utils/exportLivePdf';
import { LiveAttendanceChart } from './liveAttendanceChart';
import { MetricCard, SectionCard } from './liveUiBits';

const LB_PAGE_SIZE = 10;

interface EngMeta {
    talkTimeMin: number;
    chats: number;
    polls: number;
    raiseHand: number;
    emojis: number;
}

/**
 * Engagement score (0–100) with the raw interactions that produced it shown
 * inline underneath — talk time, chats, spoken turns, polls, raise-hands.
 * Only non-zero signals are listed so the cell stays compact.
 */
function EngagementCell({ score, meta }: { score: number; meta: EngMeta }) {
    const { t } = useTranslation('studyLibraryBatchLiveReport');
    const parts: string[] = [];
    if (meta.talkTimeMin > 0) parts.push(t('engagement.talkTime', { count: meta.talkTimeMin }));
    if (meta.chats > 0) parts.push(t('engagement.chats', { count: meta.chats }));
    if (meta.polls > 0) parts.push(t('engagement.polls', { count: meta.polls }));
    if (meta.raiseHand > 0) parts.push(t('engagement.raiseHand', { count: meta.raiseHand }));
    if (meta.emojis > 0) parts.push(t('engagement.emojis', { count: meta.emojis }));

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-body font-semibold text-neutral-700">{score}</span>
            {parts.length > 0 ? (
                <span className="text-caption leading-snug text-neutral-400">
                    {parts.join(' · ')}
                </span>
            ) : (
                <span className="text-caption text-neutral-300">{t('engagement.none')}</span>
            )}
        </div>
    );
}

interface PerClassRow {
    date: string;
    title: string;
    present: number;
    absent: number;
    attendance: string;
    duration: string;
    engagement: number;
}

function buildPerClassColumns(t: TFunction): ColumnDef<PerClassRow>[] {
    return [
        { accessorKey: 'date', header: t('table.date') },
        { accessorKey: 'title', header: t('table.class') },
        { accessorKey: 'present', header: t('table.present') },
        { accessorKey: 'absent', header: t('table.absent') },
        { accessorKey: 'attendance', header: t('table.attendance') },
        { accessorKey: 'duration', header: t('table.avgDuration') },
        { accessorKey: 'engagement', header: t('table.engagement') },
    ];
}

interface LeaderRow {
    rank: number;
    name: string;
    attendance: string;
    classes: string;
    duration: string;
    engagement: number;
    engMeta: EngMeta;
}

function buildLeaderColumns(t: TFunction): ColumnDef<LeaderRow>[] {
    return [
        { accessorKey: 'rank', header: t('table.rank') },
        { accessorKey: 'name', header: t('table.name') },
        { accessorKey: 'attendance', header: t('table.attendance') },
        { accessorKey: 'classes', header: t('table.classesAttended') },
        { accessorKey: 'duration', header: t('table.avgDuration') },
        {
            accessorKey: 'engagement',
            header: t('table.engagement'),
            cell: ({ row }) => (
                <EngagementCell score={row.original.engagement} meta={row.original.engMeta} />
            ),
        },
    ];
}

export default function BatchLiveReport() {
    const { t } = useTranslation('studyLibraryBatchLiveReport');
    const { instituteDetails } = useInstituteDetailsStore();
    const [applied, setApplied] = useState<AppliedLiveFilters | null>(null);
    const [lbPage, setLbPage] = useState(0);
    const [exporting, setExporting] = useState(false);
    const perClassColumns = useMemo(() => buildPerClassColumns(t), [t]);
    const leaderColumns = useMemo(() => buildLeaderColumns(t), [t]);

    const { data, isFetching, isError } = useLiveBatchReport(
        applied?.packageSessionId || '',
        applied?.startDate || '',
        applied?.endDate || '',
        !!applied
    );

    const summary = useMemo(() => (data ? computeBatchSummary(data) : null), [data]);

    const fmtDate = (d: string | null) =>
        d && dayjs(d).isValid() ? dayjs(d).format('DD MMM YYYY') : '—';

    const perClassTable = {
        content:
            summary?.perClass.map((c) => ({
                date: fmtDate(c.date),
                title: c.title,
                present: c.present,
                absent: c.total - c.present,
                attendance: `${c.attendancePct.toFixed(0)}%`,
                duration: formatDuration(c.avgDurationMinutes, t),
                engagement: c.avgEngagementIndex,
            })) ?? [],
        total_pages: 1,
        page_no: 0,
        page_size: summary?.perClass.length ?? 0,
        total_elements: summary?.perClass.length ?? 0,
        last: true,
    };

    const lbTotalPages = summary ? Math.ceil(summary.leaderboard.length / LB_PAGE_SIZE) : 0;
    const leaderTable = {
        content:
            summary?.leaderboard
                .slice(lbPage * LB_PAGE_SIZE, lbPage * LB_PAGE_SIZE + LB_PAGE_SIZE)
                .map((r) => ({
                    rank: r.rank,
                    name: r.fullName,
                    attendance: `${r.attendancePercentage.toFixed(1)}%`,
                    classes: `${r.attended}/${r.total}`,
                    duration: formatDuration(r.avgDurationMinutes, t),
                    engagement: r.engagementIndex,
                    engMeta: {
                        talkTimeMin: Math.round(r.engagement.talkTimeSeconds / 60),
                        chats: r.engagement.chats,
                        polls: r.engagement.pollVotes,
                        raiseHand: r.engagement.raiseHand,
                        emojis: r.engagement.emojis,
                    },
                })) ?? [],
        total_pages: lbTotalPages,
        page_no: lbPage,
        page_size: LB_PAGE_SIZE,
        total_elements: summary?.leaderboard.length ?? 0,
        last: lbPage >= lbTotalPages - 1,
    };

    const handleExport = async () => {
        if (!summary || !applied) return;
        setExporting(true);
        try {
            const logoUrl = await resolveInstituteLogoUrl(instituteDetails?.institute_logo_file_id);
            await exportBatchLivePdf(
                {
                    instituteName: instituteDetails?.institute_name || 'Vacademy',
                    logoUrl,
                    courseName: applied.courseName,
                    batchLabel: applied.batchLabel,
                    dateRange: `${fmtDate(applied.startDate)} — ${fmtDate(applied.endDate)}`,
                    generatedOn: t('export.generatedOn', {
                        date: dayjs().format('DD MMM YYYY, HH:mm'),
                    }),
                },
                summary
            );
            toast.success(t('export.exportSuccess'));
        } catch {
            toast.error(t('export.exportFailed'));
        } finally {
            setExporting(false);
        }
    };

    const handleApply = (filters: AppliedLiveFilters) => {
        setLbPage(0);
        setApplied(filters);
    };

    const hasData = !!summary && summary.totalClassesHeld > 0;

    return (
        <div className="space-y-6">
            <LiveReportFilterForm submitting={isFetching} onApply={handleApply} />

            {isFetching && <DashboardLoader />}

            {isError && !isFetching && (
                <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 text-body text-danger-700">
                    {t('errors.loadFailed')}
                </div>
            )}

            {applied && !isFetching && !isError && !hasData && (
                <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
                    <p className="text-subtitle font-semibold text-neutral-700">
                        {t('emptyState.title')}
                    </p>
                    <p className="mt-1 text-body text-neutral-500">
                        {t('emptyState.description')}
                    </p>
                </div>
            )}

            {summary && hasData && !isFetching && (
                <div className="space-y-6">
                    {/* Report header */}
                    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <h3 className="text-subtitle font-semibold text-primary-500">
                                    {applied?.courseName}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-body">
                                    {applied?.batchLabel && (
                                        <span className="rounded-md bg-primary-50 px-2 py-1 text-caption font-medium text-neutral-700">
                                            {applied.batchLabel}
                                        </span>
                                    )}
                                    <span className="text-neutral-500">
                                        {fmtDate(applied?.startDate || '')} — {fmtDate(applied?.endDate || '')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Link to="/study-library/attendance-tracker">
                                    <MyButton buttonType="secondary" className="h-9 px-3 text-body">
                                        <ArrowSquareOut className="me-1.5 size-4" />
                                        {t('actions.attendanceTracker')}
                                    </MyButton>
                                </Link>
                                <MyButton
                                    buttonType="primary"
                                    onClick={handleExport}
                                    disable={exporting}
                                    className="h-9 px-3 text-body"
                                >
                                    <Export className="me-1.5 size-4" />
                                    {exporting ? t('actions.exporting') : t('actions.exportPdf')}
                                </MyButton>
                            </div>
                        </div>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            label={t('metrics.avgAttendance')}
                            value={`${summary.avgAttendancePct.toFixed(1)}%`}
                            sub={t('metrics.learnersCount', { count: summary.learnerCount })}
                            icon={<CalendarCheck className="size-5" />}
                        />
                        <MetricCard
                            label={t('metrics.classesHeld')}
                            value={`${summary.totalClassesHeld}`}
                            icon={<Presentation className="size-5" />}
                        />
                        <MetricCard
                            label={t('metrics.avgDurationPerClass')}
                            value={formatDuration(summary.avgDurationMinutes, t)}
                            sub={t('metrics.presentLearners')}
                            icon={<Timer className="size-5" />}
                        />
                        <MetricCard
                            label={t('metrics.avgEngagement')}
                            value={`${summary.avgEngagementIndex}`}
                            sub={t('metrics.participationPoints')}
                            icon={<ChatsCircle className="size-5" />}
                            info={t('metrics.engagementInfo')}
                        />
                    </div>

                    {/* Attendance trend */}
                    <SectionCard
                        title={t('sections.attendanceTrendTitle')}
                        subtitle={t('sections.attendanceTrendSubtitle')}
                    >
                        <LiveAttendanceChart data={summary.timeline} />
                    </SectionCard>

                    {/* Class-wise table */}
                    <SectionCard
                        title={t('sections.classBreakdownTitle')}
                        subtitle={t('sections.classBreakdownSubtitle')}
                    >
                        <div className="overflow-auto">
                            <MyTable
                                data={perClassTable}
                                columns={perClassColumns}
                                isLoading={false}
                                error={null}
                                currentPage={0}
                                scrollable
                            />
                        </div>
                    </SectionCard>

                    {/* Leaderboard */}
                    <SectionCard
                        title={t('sections.leaderboardTitle')}
                        subtitle={t('sections.leaderboardSubtitle')}
                    >
                        <MyTable
                            data={leaderTable}
                            columns={leaderColumns}
                            isLoading={false}
                            error={null}
                            currentPage={lbPage}
                        />
                        {lbTotalPages > 1 && (
                            <div className="mt-6 flex justify-center">
                                <MyPagination
                                    currentPage={lbPage}
                                    totalPages={lbTotalPages}
                                    onPageChange={setLbPage}
                                />
                            </div>
                        )}
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
