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
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StatusChip } from '@/components/design-system/status-chips';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { resolveInstituteLogoUrl } from './-utils/instituteLogo';
import LiveReportFilterForm, { AppliedLiveFilters } from './liveReportFilterForm';
import { useLiveBatchReport } from './-services/liveReportApi';
import {
    computeBatchSummary,
    computeLearnerStats,
    formatDuration,
    parseEngagement,
    perClassEngagement,
} from './-utils/liveCompute';
import { exportLearnerLivePdf } from './-utils/exportLivePdf';
import { MetricCard, SectionCard } from './liveUiBits';

interface ClassRow {
    date: string;
    title: string;
    status: string;
    duration: string;
    talkTime: string;
    chats: string;
    polls: string;
    raiseHand: string;
}

const classColumns: ColumnDef<ClassRow>[] = [
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'title', header: 'Class' },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const present = row.original.status === 'PRESENT';
            return (
                <StatusChip
                    text={present ? 'Present' : 'Absent'}
                    textSize="text-caption"
                    status={present ? 'SUCCESS' : 'DANGER'}
                />
            );
        },
    },
    { accessorKey: 'duration', header: 'Duration' },
    { accessorKey: 'talkTime', header: 'Talk Time' },
    { accessorKey: 'chats', header: 'Chats' },
    { accessorKey: 'polls', header: 'Polls' },
    { accessorKey: 'raiseHand', header: 'Raise Hand' },
];

export default function LearnerLiveReport() {
    const { instituteDetails } = useInstituteDetailsStore();
    const [applied, setApplied] = useState<AppliedLiveFilters | null>(null);
    const [exporting, setExporting] = useState(false);

    const { data, isFetching, isError } = useLiveBatchReport(
        applied?.packageSessionId || '',
        applied?.startDate || '',
        applied?.endDate || '',
        !!applied
    );

    const batchSummary = useMemo(() => (data ? computeBatchSummary(data) : null), [data]);
    const learnerStudent = useMemo(
        () => data?.find((s) => s.studentId === applied?.userId) ?? null,
        [data, applied?.userId]
    );
    const learner = useMemo(
        () => (learnerStudent ? computeLearnerStats(learnerStudent) : null),
        [learnerStudent]
    );

    // This learner's 0–100 engagement score, normalized to the batch's most active learner.
    const learnerEngagementScore =
        learner && batchSummary && batchSummary.maxEngagementPerClass > 0
            ? Math.round(
                  (perClassEngagement(learner.engagementIndex, learner.attended) /
                      batchSummary.maxEngagementPerClass) *
                      100
              )
            : 0;

    const fmtDate = (d: string | null) =>
        d && dayjs(d).isValid() ? dayjs(d).format('DD MMM YYYY') : '—';

    const classTable = {
        content:
            [...(learnerStudent?.sessions ?? [])]
                .sort((a, b) => (a.meetingDate ?? '').localeCompare(b.meetingDate ?? ''))
                .map((r) => {
                    const e = parseEngagement(r.engagementData);
                    return {
                        date: fmtDate(r.meetingDate),
                        title: r.title,
                        status: r.attendanceStatus ?? 'UNMARKED',
                        duration: formatDuration(r.durationMinutes),
                        talkTime: e ? `${Math.round(e.talkTimeSeconds / 60)}m` : '—',
                        chats: e ? String(e.chats) : '—',
                        polls: e ? String(e.pollVotes) : '—',
                        raiseHand: e ? String(e.raiseHand) : '—',
                    };
                }) ?? [],
        total_pages: 1,
        page_no: 0,
        page_size: learnerStudent?.sessions.length ?? 0,
        total_elements: learnerStudent?.sessions.length ?? 0,
        last: true,
    };

    const handleExport = async () => {
        if (!learner || !learnerStudent || !batchSummary || !applied) return;
        setExporting(true);
        try {
            const logoUrl = await resolveInstituteLogoUrl(instituteDetails?.institute_logo_file_id);
            await exportLearnerLivePdf(
                {
                    instituteName: instituteDetails?.institute_name || 'Vacademy',
                    logoUrl,
                    courseName: applied.courseName,
                    batchLabel: applied.batchLabel,
                    dateRange: `${fmtDate(applied.startDate)} — ${fmtDate(applied.endDate)}`,
                    generatedOn: `Generated ${dayjs().format('DD MMM YYYY, HH:mm')}`,
                },
                learner,
                learnerStudent.sessions,
                batchSummary
            );
            toast.success('Learner report exported');
        } catch {
            toast.error('Failed to export PDF');
        } finally {
            setExporting(false);
        }
    };

    const hasData = !!learner && learner.total > 0;

    return (
        <div className="space-y-6">
            <LiveReportFilterForm withLearner submitting={isFetching} onApply={setApplied} />

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
                        This learner had no live classes scheduled in the selected period.
                    </p>
                </div>
            )}

            {learner && batchSummary && hasData && !isFetching && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <h3 className="text-subtitle font-semibold text-primary-500">
                                    {learner.fullName}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-body">
                                    <span className="rounded-md bg-primary-50 px-2 py-1 text-caption font-medium text-neutral-700">
                                        {applied?.courseName}
                                    </span>
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

                    {/* Metric cards with batch comparison */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            label="Attendance"
                            value={`${learner.attendancePercentage.toFixed(1)}%`}
                            sub={`Batch ${batchSummary.avgAttendancePct.toFixed(1)}%`}
                            icon={<CalendarCheck className="size-5" />}
                        />
                        <MetricCard
                            label="Classes Attended"
                            value={`${learner.attended}/${learner.total}`}
                            icon={<Presentation className="size-5" />}
                        />
                        <MetricCard
                            label="Avg Duration / Class"
                            value={formatDuration(learner.avgDurationMinutes)}
                            sub={`Batch ${formatDuration(batchSummary.avgDurationMinutes)}`}
                            icon={<Timer className="size-5" />}
                        />
                        <MetricCard
                            label="Engagement"
                            value={`${learnerEngagementScore}`}
                            sub={`Batch ${batchSummary.avgEngagementScore} · out of 100`}
                            icon={<ChatsCircle className="size-5" />}
                            info="Engagement score (0–100) based on in-class participation — talk time, chats, polls and raise-hands, measured per class. 100 = the most active learner in this batch. Only available for provider-synced (Zoom/BBB) classes."
                        />
                    </div>

                    {/* Class history */}
                    <SectionCard
                        title="Class History"
                        subtitle="Attendance and participation for every class in the period"
                    >
                        <div className="overflow-auto">
                            <MyTable
                                data={classTable}
                                columns={classColumns}
                                isLoading={false}
                                error={null}
                                currentPage={0}
                                scrollable
                            />
                        </div>
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
