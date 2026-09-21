import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/axiosInstance', () => ({ default: { get: vi.fn() } }));
vi.mock('@/constants/urls', () => ({ GET_ASSESSMENT_DASHBOARD_OVERVIEW_URL: 'http://x/overview' }));

import { dashboardToCsv, type AssessmentDashboard } from '../assessment-dashboard';

const sample: AssessmentDashboard = {
    counts: { live: 4, upcoming: 0, previous: 21, draft: 35 },
    participation: {
        registered_learners: 6,
        attempted_learners: 4,
        attempts_total: 54,
        attempts_last_7_days: 2,
        live_attempts: 0,
    },
    pending: {
        manual_evaluation_pending: 4,
        ai_checks_running: 0,
        ai_checks_failed: 0,
        results_to_release: 5,
        reattempt_requests_pending: 0,
    },
    batches: [
        {
            batch_id: 'b1',
            assessments: 17,
            learners: 3,
            attempts: 28,
            avg_percent: 48.1,
            best_percent: 100,
            lowest_percent: 0,
        },
        {
            batch_id: 'b2',
            assessments: 1,
            learners: 1,
            attempts: 0,
            avg_percent: null,
            best_percent: null,
            lowest_percent: null,
        },
    ],
    assessments: [
        {
            assessment_id: 'a1',
            name: 'English, "20 Sep"',
            play_mode: 'EXAM',
            visibility: 'PRIVATE',
            evaluation_type: 'MANUAL',
            start_time: '2026-09-20T14:59:00Z',
            end_time: '2026-09-22T14:59:00Z',
            participants: 1,
            attempted: 1,
            avg_percent: 66.7,
            pending_evaluation: 0,
            to_release: 1,
        },
    ],
    generated_at: '2026-09-20T20:10:00Z',
};

/** The "Download stats" file: every number on the tab, batch names resolved, CSV-safe. */
describe('dashboardToCsv', () => {
    it('writes summary, batch and assessment blocks with the names the admin sees', () => {
        const csv = dashboardToCsv(sample, (id) => (id === 'b1' ? 'Class 10 Science' : ''), {
            summary: 'Summary',
            batches: 'By batch',
            assessments: 'Recent',
        });
        const lines = csv.split('\n');
        expect(lines[0]).toBe('Summary');
        expect(lines).toContain('Live,4');
        expect(lines).toContain('Results to release,5');
        expect(lines).toContain('By batch');
        expect(lines).toContain('Class 10 Science,17,3,28,48.1,100,0');
        // an unknown batch keeps its id; null percentages stay empty, not "null"
        expect(lines).toContain('b2,1,1,0,,,');
        expect(lines).toContain('Recent');
        // a comma and quotes in a name are escaped per RFC 4180
        expect(lines.some((l) => l.startsWith('"English, ""20 Sep""",EXAM,MANUAL,'))).toBe(true);
    });
});
