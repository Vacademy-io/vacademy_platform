import { describe, expect, it } from 'vitest';
import type { CounselorPerformance } from '@/routes/audience-manager/reports/-services/get-lead-reports';
import type {
    FollowupAgingCounsellorRow,
    FollowupAgingReport,
} from '@/routes/audience-manager/reports/-services/get-crm-reports';
import type { WorkbenchCounsellor } from '../-services/counsellor-workbench-services';
import {
    buildAttentionItems,
    buildStatsByUser,
    buildTotals,
    formatCount,
    formatMinutes,
    formatRate,
    periodWindow,
} from './dashboard-stats';

const counsellor = (over: Partial<WorkbenchCounsellor>): WorkbenchCounsellor => ({
    user_id: 'u',
    full_name: 'Someone',
    email: null,
    team_id: null,
    team_name: null,
    role_label: null,
    is_active: true,
    open_leads_count: 0,
    rating: null,
    rating_strategy_type: null,
    ...over,
});

const agingRow = (over: Partial<FollowupAgingCounsellorRow>): FollowupAgingCounsellorRow => ({
    user_id: 'u',
    name: null,
    due_today: 0,
    overdue_1_3: 0,
    overdue_3_7: 0,
    overdue_7_plus: 0,
    upcoming: 0,
    oldest_overdue_days: null,
    ...over,
});

const performance: CounselorPerformance = {
    from_date: '2026-09-01',
    to_date: '2026-09-30',
    tat_hours: 24,
    rows: [
        {
            counselor_id: 'a',
            counselor_name: 'Kavya',
            leads_assigned: 40,
            leads_responded: 30,
            conversions: 8,
            conversion_rate: 20,
            avg_response_minutes: 42,
            tat_met_count: 25,
            tat_met_rate: 83.3,
            open_leads: 30,
            overdue_leads: 3,
        },
        {
            counselor_id: 'b',
            counselor_name: 'Imran',
            leads_assigned: 10,
            leads_responded: 10,
            conversions: 2,
            conversion_rate: 20,
            avg_response_minutes: 15,
            tat_met_count: 10,
            tat_met_rate: 100,
            open_leads: 8,
            overdue_leads: 0,
        },
    ],
    summary: { total_counselors: 2, avg_response_minutes: 36.4, avg_conversion_rate: 20 },
};

const aging: FollowupAgingReport = {
    buckets: [],
    by_counsellor: [
        agingRow({
            user_id: 'a',
            due_today: 4,
            overdue_1_3: 2,
            overdue_3_7: 1,
            oldest_overdue_days: 5,
        }),
        agingRow({
            user_id: 'admin',
            name: 'Front desk',
            overdue_7_plus: 6,
            oldest_overdue_days: 12,
        }),
    ],
    closure_reasons: [],
};

describe('periodWindow', () => {
    it('WEEK runs Monday to Sunday, also when today is a Sunday', () => {
        // Mon 29 Sep 2026
        expect(periodWindow({ periodType: 'WEEK' }, new Date(2026, 8, 29))).toEqual({
            from: '2026-09-28',
            to: '2026-10-04',
        });
        // Sun 4 Oct 2026 still belongs to the week that started Mon 28 Sep
        expect(periodWindow({ periodType: 'WEEK' }, new Date(2026, 9, 4))).toEqual({
            from: '2026-09-28',
            to: '2026-10-04',
        });
    });

    it('MONTH covers the 1st to the last day, including February', () => {
        expect(periodWindow({ periodType: 'MONTH' }, new Date(2026, 8, 29))).toEqual({
            from: '2026-09-01',
            to: '2026-09-30',
        });
        expect(periodWindow({ periodType: 'MONTH' }, new Date(2028, 1, 10))).toEqual({
            from: '2028-02-01',
            to: '2028-02-29',
        });
    });

    it('CUSTOM needs both dates in order', () => {
        expect(periodWindow({ periodType: 'CUSTOM', from: '2026-09-01' })).toBeNull();
        expect(
            periodWindow({ periodType: 'CUSTOM', from: '2026-09-10', to: '2026-09-01' })
        ).toBeNull();
        expect(
            periodWindow({ periodType: 'CUSTOM', from: '2026-09-01', to: '2026-09-10' })
        ).toEqual({ from: '2026-09-01', to: '2026-09-10' });
    });
});

describe('buildStatsByUser', () => {
    it('merges both reports per counsellor', () => {
        const stats = buildStatsByUser(['a'], performance, aging);
        expect(stats.a).toEqual({
            newLeads: 40,
            contacted: 30,
            converted: 8,
            conversionRate: 20,
            avgResponseMinutes: 42,
            overdueFollowups: 3,
            dueTodayFollowups: 4,
            oldestOverdueDays: 5,
        });
    });

    it('treats a missing row in a loaded report as zero', () => {
        const stats = buildStatsByUser(['c'], performance, aging);
        expect(stats.c).toMatchObject({
            newLeads: 0,
            converted: 0,
            conversionRate: null,
            overdueFollowups: 0,
            dueTodayFollowups: 0,
        });
    });

    it('leaves figures unknown when a report did not load', () => {
        const stats = buildStatsByUser(['a'], undefined, aging);
        expect(stats.a?.newLeads).toBeNull();
        expect(stats.a?.converted).toBeNull();
        expect(stats.a?.overdueFollowups).toBe(3);
        const none = buildStatsByUser(['a'], performance, undefined);
        expect(none.a?.overdueFollowups).toBeNull();
        expect(none.a?.newLeads).toBe(40);
    });
});

describe('buildTotals', () => {
    it('sums the scoped rows and keeps the server-weighted averages', () => {
        expect(buildTotals(performance, aging)).toEqual({
            newLeads: 50,
            contacted: 40,
            converted: 10,
            conversionRate: 20,
            avgResponseMinutes: 36.4,
            overdueFollowups: 9,
            dueTodayFollowups: 4,
        });
    });

    it('is all unknown before anything loads', () => {
        expect(buildTotals(undefined, undefined)).toEqual({
            newLeads: null,
            contacted: null,
            converted: null,
            conversionRate: null,
            avgResponseMinutes: null,
            overdueFollowups: null,
            dueTodayFollowups: null,
        });
    });
});

describe('buildAttentionItems', () => {
    it('lists the most overdue first, then inactive counsellors still holding leads', () => {
        const roster = [
            counsellor({ user_id: 'a', full_name: 'Kavya Nair' }),
            counsellor({
                user_id: 'x',
                full_name: 'Sneha',
                is_active: false,
                open_leads_count: 34,
            }),
            counsellor({ user_id: 'y', full_name: 'Rohit', is_active: false, open_leads_count: 0 }),
        ];
        expect(buildAttentionItems(aging.by_counsellor, roster)).toEqual([
            { kind: 'overdue', userId: 'admin', name: 'Front desk', count: 6, oldestDays: 12 },
            { kind: 'overdue', userId: 'a', name: 'Kavya Nair', count: 3, oldestDays: 5 },
            { kind: 'inactiveWithLeads', userId: 'x', name: 'Sneha', count: 34 },
        ]);
    });

    it('skips people with nothing overdue and respects the caps', () => {
        const rows = [
            agingRow({ user_id: 'p', due_today: 9 }),
            agingRow({ user_id: 'q', overdue_1_3: 1 }),
            agingRow({ user_id: 'r', overdue_1_3: 2 }),
        ];
        const items = buildAttentionItems(rows, [], { maxOverdue: 1 });
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ userId: 'r', count: 2 });
    });
});

describe('formatters', () => {
    it('formats minutes, counts and rates', () => {
        expect(formatMinutes(null)).toBe('—');
        expect(formatMinutes(42.4)).toBe('42m');
        expect(formatMinutes(185)).toBe('3h 5m');
        expect(formatMinutes(3000)).toBe('2d 2h');
        expect(formatCount(null)).toBe('—');
        expect(formatCount(125000)).toBe('1,25,000');
        expect(formatRate(null)).toBe('—');
        expect(formatRate(12.345)).toBe('12.3%');
    });
});
