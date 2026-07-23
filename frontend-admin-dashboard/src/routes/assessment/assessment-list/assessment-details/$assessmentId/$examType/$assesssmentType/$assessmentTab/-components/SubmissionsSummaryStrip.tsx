import { useQuery } from '@tanstack/react-query';
import { CheckCircle, ClipboardText, Hourglass, PaperPlaneTilt, ChartBar } from '@phosphor-icons/react';
import { getAdminParticipants, getAttemptsFileStatus } from '../-services/assessment-details-services';
import { MyFilterOption } from '@/types/assessments/my-filter';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { cn } from '@/lib/utils';

interface SubmissionsSummaryStripProps {
    assessmentId: string;
    instituteId: string | undefined;
    assessmentType: string;
    registrationSource: string;
    batches: MyFilterOption[];
    totalMarks: number;
    // Bump to force a refetch (e.g. after a manual refresh / revaluation / release).
    refreshKey?: number;
    // MANUAL evaluation assessments: the first tile becomes "Attempts / Submissions"
    // where submissions counts attempts with a submitted answer-sheet file.
    isManualEvaluation?: boolean;
}

interface SummaryStats {
    submitted: number;
    // Attempts with a submitted answer-sheet file (manual evaluation only; null otherwise).
    fileSubmissions: number | null;
    evaluated: number;
    pendingEvaluation: number;
    resultsReleased: number;
    avgScore: number | null;
    highScore: number | null;
    lowScore: number | null;
}

// Pull every attempted submission for the current slice (assessments are bounded,
// so a single large page is cheap) and derive the batch-level snapshot a teacher
// wants before drilling into individual rows.
const computeStats = (
    rows: SubmissionStudentData[],
    total: number,
    fileSubmissions: number | null
): SummaryStats => {
    const evaluated = rows.filter((r) => r.evaluation_status === 'COMPLETED').length;
    const pendingEvaluation = rows.filter(
        (r) => r.evaluation_status !== 'COMPLETED'
    ).length;
    const resultsReleased = rows.filter(
        (r) => r.report_release_result_status === 'RELEASED'
    ).length;

    // Only rows with an actual marks value count toward the score stats. An
    // ungraded attempt has score === null, and Number(null) === 0 would wrongly
    // pin the low score to 0 and deflate the average while grading is in progress.
    const scores = rows
        .filter((r) => r.score !== null && r.score !== undefined)
        .map((r) => (typeof r.score === 'number' ? r.score : Number(r.score)))
        .filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));

    const avgScore = scores.length
        ? scores.reduce((sum, s) => sum + s, 0) / scores.length
        : null;

    return {
        submitted: total,
        fileSubmissions,
        evaluated,
        pendingEvaluation,
        resultsReleased,
        avgScore,
        highScore: scores.length ? Math.max(...scores) : null,
        lowScore: scores.length ? Math.min(...scores) : null,
    };
};

const StatTile = ({
    icon,
    label,
    value,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent?: 'success' | 'warning' | 'primary' | 'neutral';
}) => {
    const accentText =
        accent === 'success'
            ? 'text-success-600'
            : accent === 'warning'
              ? 'text-warning-600'
              : accent === 'primary'
                ? 'text-primary-500'
                : 'text-neutral-700';
    return (
        <div className="flex min-w-36 flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
            <div className={cn('flex items-center', accentText)}>{icon}</div>
            <div className="flex flex-col">
                <span className="whitespace-nowrap text-caption text-neutral-500">{label}</span>
                <span className={cn('text-body font-semibold', accentText)}>{value}</span>
            </div>
        </div>
    );
};

export const SubmissionsSummaryStrip = ({
    assessmentId,
    instituteId,
    assessmentType,
    registrationSource,
    batches,
    totalMarks,
    refreshKey = 0,
    isManualEvaluation = false,
}: SubmissionsSummaryStripProps) => {
    // Cached via react-query: switching sub-tabs / remounting reuses the cached
    // stats instead of refiring the (large-page) participants call. refreshKey is
    // part of the key, so the existing "bump to refresh" contract (after
    // revaluation / release / upload) still forces a fresh fetch.
    const {
        data: stats = null,
        isLoading,
        isError,
    } = useQuery({
        queryKey: [
            'ASSESSMENT_SUBMISSIONS_SUMMARY',
            assessmentId,
            instituteId,
            assessmentType,
            registrationSource,
            batches.map((b) => b.id),
            isManualEvaluation,
            refreshKey,
        ],
        queryFn: async (): Promise<SummaryStats> => {
            // Single large page: evaluated/pending/score stats are derived from
            // these rows while "Submitted" uses total_elements. Assessments don't
            // approach this size in practice; beyond 1000 attempted submissions the
            // derived counts would undercount (Submitted stays exact).
            const data = await getAdminParticipants(assessmentId, instituteId, 0, 1000, {
                name: '',
                assessment_type: assessmentType,
                attempt_type: ['ENDED'],
                registration_source: registrationSource,
                batches,
                status: ['ACTIVE'],
                sort_columns: {},
            });
            const rows: SubmissionStudentData[] = data?.content ?? [];

            // Manual evaluation: count how many attempts have a submitted
            // answer-sheet file (batch endpoint; map only contains attempts
            // that have one). Non-fatal — the tile falls back to attempts only.
            let fileSubmissions: number | null = null;
            if (isManualEvaluation) {
                const attemptIds = rows
                    .map((r) => r.attempt_id)
                    .filter((id): id is string => Boolean(id));
                if (attemptIds.length > 0) {
                    try {
                        const fileMap = await getAttemptsFileStatus(attemptIds);
                        fileSubmissions = Object.keys(fileMap ?? {}).length;
                    } catch (error) {
                        console.error('Failed to load submission file counts:', error);
                    }
                } else {
                    fileSubmissions = 0;
                }
            }

            return computeStats(rows, data?.total_elements ?? rows.length, fileSubmissions);
        },
        staleTime: 5 * 60 * 1000,
    });

    if (isError) return null; // Fail quietly — the table below is the source of truth.

    if (isLoading) {
        return (
            <div className="flex h-16 items-center justify-center rounded-lg border border-neutral-200 bg-white">
                <DashboardLoader size={20} />
            </div>
        );
    }

    if (!stats || stats.submitted === 0) return null;

    const fmt = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} / ${totalMarks}`);

    return (
        <div className="flex flex-wrap gap-3">
            {/* Manual evaluation: attempts vs answer-sheet files actually submitted. */}
            {isManualEvaluation && stats.fileSubmissions !== null ? (
                <StatTile
                    icon={<ClipboardText size={18} />}
                    label="Attempts / Submissions"
                    value={`${stats.submitted} / ${stats.fileSubmissions}`}
                    accent="neutral"
                />
            ) : (
                <StatTile
                    icon={<ClipboardText size={18} />}
                    label="Submitted"
                    value={String(stats.submitted)}
                    accent="neutral"
                />
            )}
            <StatTile
                icon={<CheckCircle size={18} weight="fill" />}
                label="Evaluated"
                value={`${stats.evaluated} / ${stats.submitted}`}
                accent="success"
            />
            <StatTile
                icon={<Hourglass size={18} weight="fill" />}
                label="Pending Evaluation"
                value={String(stats.pendingEvaluation)}
                accent="warning"
            />
            <StatTile
                icon={<PaperPlaneTilt size={18} weight="fill" />}
                label="Results Released"
                value={`${stats.resultsReleased} / ${stats.submitted}`}
                accent="primary"
            />
            <StatTile
                icon={<ChartBar size={18} weight="fill" />}
                label="Avg / High / Low"
                value={
                    stats.avgScore === null
                        ? '—'
                        : `${fmt(stats.avgScore)}  ·  ↑${stats.highScore?.toFixed(1)}  ↓${stats.lowScore?.toFixed(1)}`
                }
                accent="neutral"
            />
        </div>
    );
};
