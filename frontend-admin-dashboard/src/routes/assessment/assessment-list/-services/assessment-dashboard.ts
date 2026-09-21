import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_ASSESSMENT_DASHBOARD_OVERVIEW_URL } from '@/constants/urls';

/** One response for the Assessments Overview tab — see AssessmentDashboardDto. */
export interface AssessmentDashboard {
    counts: { live: number; upcoming: number; previous: number; draft: number };
    participation: {
        registered_learners: number;
        attempted_learners: number;
        attempts_total: number;
        attempts_last_7_days: number;
        live_attempts: number;
    };
    pending: {
        manual_evaluation_pending: number;
        ai_checks_running: number;
        ai_checks_failed: number;
        results_to_release: number;
        reattempt_requests_pending: number;
    };
    batches: Array<{
        batch_id: string;
        assessments: number;
        learners: number;
        attempts: number;
        avg_percent: number | null;
        best_percent: number | null;
        lowest_percent: number | null;
    }>;
    assessments: Array<{
        assessment_id: string;
        name: string;
        play_mode: string;
        visibility: string | null;
        evaluation_type: string | null;
        start_time: string | null;
        end_time: string | null;
        participants: number;
        attempted: number;
        avg_percent: number | null;
        pending_evaluation: number;
        to_release: number;
    }>;
    generated_at: string;
}

export const ASSESSMENT_DASHBOARD_QUERY_KEY = 'ASSESSMENT_DASHBOARD_OVERVIEW';

export const getAssessmentDashboard = async (
    instituteId: string,
    batchIds: string[] = []
): Promise<AssessmentDashboard> => {
    const { data } = await authenticatedAxiosInstance.get<AssessmentDashboard>(
        GET_ASSESSMENT_DASHBOARD_OVERVIEW_URL,
        {
            params: { instituteId, ...(batchIds.length ? { batchIds: batchIds.join(',') } : {}) },
        }
    );
    return data;
};

const csvCell = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The whole overview as one CSV: a summary block, then batch performance, then the
 * recent assessments — what an admin pastes into a sheet for the management meeting.
 */
export const dashboardToCsv = (
    d: AssessmentDashboard,
    batchName: (id: string) => string,
    labels: {
        summary: string;
        batches: string;
        assessments: string;
    }
): string => {
    const lines: string[][] = [];
    lines.push([labels.summary]);
    lines.push(['Live', String(d.counts.live)]);
    lines.push(['Upcoming', String(d.counts.upcoming)]);
    lines.push(['Previous', String(d.counts.previous)]);
    lines.push(['Drafts', String(d.counts.draft)]);
    lines.push(['Registered learners', String(d.participation.registered_learners)]);
    lines.push(['Learners who attempted', String(d.participation.attempted_learners)]);
    lines.push(['Attempts (total)', String(d.participation.attempts_total)]);
    lines.push(['Attempts (last 7 days)', String(d.participation.attempts_last_7_days)]);
    lines.push(['Attempts live now', String(d.participation.live_attempts)]);
    lines.push(['Manual evaluation pending', String(d.pending.manual_evaluation_pending)]);
    lines.push(['AI checks running', String(d.pending.ai_checks_running)]);
    lines.push(['AI checks failed (30 days)', String(d.pending.ai_checks_failed)]);
    lines.push(['Results to release', String(d.pending.results_to_release)]);
    lines.push(['Re-attempt requests pending', String(d.pending.reattempt_requests_pending)]);
    lines.push([]);
    lines.push([labels.batches]);
    lines.push(['Batch', 'Assessments', 'Learners', 'Attempts', 'Average %', 'Best %', 'Lowest %']);
    d.batches.forEach((b) =>
        lines.push([
            batchName(b.batch_id) || b.batch_id,
            String(b.assessments),
            String(b.learners),
            String(b.attempts),
            b.avg_percent == null ? '' : String(b.avg_percent),
            b.best_percent == null ? '' : String(b.best_percent),
            b.lowest_percent == null ? '' : String(b.lowest_percent),
        ])
    );
    lines.push([]);
    lines.push([labels.assessments]);
    lines.push([
        'Assessment',
        'Type',
        'Evaluation',
        'Start',
        'End',
        'Participants',
        'Attempted',
        'Average %',
        'Pending evaluation',
        'To release',
    ]);
    d.assessments.forEach((a) =>
        lines.push([
            a.name,
            a.play_mode,
            a.evaluation_type ?? '',
            a.start_time ?? '',
            a.end_time ?? '',
            String(a.participants),
            String(a.attempted),
            a.avg_percent == null ? '' : String(a.avg_percent),
            String(a.pending_evaluation),
            String(a.to_release),
        ])
    );
    return lines.map((row) => row.map(csvCell).join(',')).join('\n');
};

export const downloadCsv = (fileName: string, csv: string): void => {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};
