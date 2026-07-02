import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { toast } from 'sonner';
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
    const parts: string[] = [];
    if (meta.talkTimeMin > 0) parts.push(`${meta.talkTimeMin}m talk`);
    if (meta.chats > 0) parts.push(`${meta.chats} chat`);
    if (meta.polls > 0) parts.push(`${meta.polls} poll`);
    if (meta.raiseHand > 0) parts.push(`${meta.raiseHand} hand`);
    if (meta.emojis > 0) parts.push(`${meta.emojis} emoji`);

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-body font-semibold text-neutral-700">{score}</span>
            {parts.length > 0 ? (
                <span className="text-caption leading-snug text-neutral-400">
                    {parts.join(' · ')}
                </span>
            ) : (
                <span className="text-caption text-neutral-300">no interaction</span>
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

const perClassColumns: ColumnDef<PerClassRow>[] = [
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'title', header: 'Class' },
    { accessorKey: 'present', header: 'Present' },
    { accessorKey: 'absent', header: 'Absent' },
    { accessorKey: 'attendance', header: 'Attendance' },
    { accessorKey: 'duration', header: 'Avg Duration' },
    { accessorKey: 'engagement', header: 'Engagement' },
];

interface LeaderRow {
    rank: number;
    name: string;
    attendance: string;
    classes: string;
    duration: string;
    engagement: number;
    engMeta: EngMeta;
}

const leaderColumns: ColumnDef<LeaderRow>[] = [
    { accessorKey: 'rank', header: 'Rank' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'attendance', header: 'Attendance' },
    { accessorKey: 'classes', header: 'Classes Attended' },
    { accessorKey: 'duration', header: 'Avg Duration' },
    {
        accessorKey: 'engagement',
        header: 'Engagement',
        cell: ({ row }) => (
            <EngagementCell score={row.original.engagement} meta={row.original.engMeta} />
        ),
    },
];

export default function BatchLiveReport() {
    const { instituteDetails } = useInstituteDetailsStore();
    const [applied, setApplied] = useState<AppliedLiveFilters | null>(null);
    const [lbPage, setLbPage] = useState(0);
    const [exporting, setExporting] = useState(false);

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
                duration: formatDuration(c.avgDurationMinutes),
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
                    duration: formatDuration(r.avgDurationMinutes),
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
                    generatedOn: `Generated ${dayjs().format('DD MMM YYYY, HH:mm')}`,
                },
                summary
            );
            toast.success('Live class report exported');
        } catch {
            toast.error('Failed to export PDF');
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
                    Something went wrong loading the report. Please try again.
                </div>
            )}

            {applied && !isFetching && !isError && !hasData && (
                <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
                    <p className="text-subtitle font-semibold text-neutral-700">No live classes found</p>
                    <p className="mt-1 text-body text-neutral-500">
                        No live classes were held for this batch in the selected period.
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
                                        <ArrowSquareOut className="mr-1.5 size-4" />
                                        Attendance Tracker
                                    </MyButton>
                                </Link>
                                <MyButton
                                    buttonType="primary"
                                    onClick={handleExport}
                                    disable={exporting}
                                    className="h-9 px-3 text-body"
                                >
                                    <Export className="mr-1.5 size-4" />
                                    {exporting ? 'Exporting…' : 'Export PDF'}
                                </MyButton>
                            </div>
                        </div>
                    </div>

                    {/* Metric cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            label="Avg Attendance"
                            value={`${summary.avgAttendancePct.toFixed(1)}%`}
                            sub={`${summary.learnerCount} learners`}
                            icon={<CalendarCheck className="size-5" />}
                        />
                        <MetricCard
                            label="Classes Held"
                            value={`${summary.totalClassesHeld}`}
                            icon={<Presentation className="size-5" />}
                        />
                        <MetricCard
                            label="Avg Duration / Class"
                            value={formatDuration(summary.avgDurationMinutes)}
                            sub="present learners"
                            icon={<Timer className="size-5" />}
                        />
                        <MetricCard
                            label="Avg Engagement"
                            value={`${summary.avgEngagementIndex}`}
                            sub="participation points"
                            icon={<ChatsCircle className="size-5" />}
                            info="Engagement points — a weighted total of in-class participation (talk time counts most, then polls, chats and raise-hands), summed across all classes in the period. Higher = more engaged; there is no upper limit. Only available for provider-synced (Zoom/BBB) classes."
                        />
                    </div>

                    {/* Attendance trend */}
                    <SectionCard
                        title="Attendance Trend"
                        subtitle="Class-by-class attendance rate over the selected period"
                    >
                        <LiveAttendanceChart data={summary.timeline} />
                    </SectionCard>

                    {/* Class-wise table */}
                    <SectionCard
                        title="Class-wise Breakdown"
                        subtitle="Attendance, duration and engagement for every class held"
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
                        title="Leaderboard"
                        subtitle="Ranked by attendance, then engagement. Interaction totals are summed across all classes in the selected period."
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
