import type { CounselorPerformance } from '@/routes/audience-manager/reports/-services/get-lead-reports';
import type {
    FollowupAgingCounsellorRow,
    FollowupAgingReport,
} from '@/routes/audience-manager/reports/-services/get-crm-reports';
import type { WorkbenchCounsellor } from '../-services/counsellor-workbench-services';
import type { TargetPeriodValue } from '../-components/targets/target-period-selector';

/**
 * Pure helpers behind the Counsellors dashboard numbers. The page reads two
 * existing report endpoints (counsellor performance for the selected period,
 * follow-up aging as of now) and folds them into one row per counsellor, so
 * the KPI strip, the cards/table and the drawer all show the same figures.
 */

/** Per-counsellor figures. `null` = not loaded / endpoint failed → render "—". */
export interface CounsellorStats {
    /** Leads that came in during the period and are assigned to this person. */
    newLeads: number | null;
    /** Of those, how many this person has touched at least once. */
    contacted: number | null;
    converted: number | null;
    /** 0–100, one decimal; null when there were no new leads. */
    conversionRate: number | null;
    avgResponseMinutes: number | null;
    /** Open follow-ups past their due date, as of now. */
    overdueFollowups: number | null;
    /** Open follow-ups due later today, as of now. */
    dueTodayFollowups: number | null;
    /** Days past due of the oldest open follow-up; null when none overdue. */
    oldestOverdueDays: number | null;
}

export interface CounsellorDashboardTotals {
    newLeads: number | null;
    contacted: number | null;
    converted: number | null;
    conversionRate: number | null;
    avgResponseMinutes: number | null;
    overdueFollowups: number | null;
    dueTodayFollowups: number | null;
}

const EMPTY_STATS: CounsellorStats = {
    newLeads: null,
    contacted: null,
    converted: null,
    conversionRate: null,
    avgResponseMinutes: null,
    overdueFollowups: null,
    dueTodayFollowups: null,
    oldestOverdueDays: null,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-MM-dd in the browser's local calendar (not UTC). */
export function toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The date window a period covers, matching the backend's target windows
 * (CounsellorTargetService): WEEK = Monday–Sunday of the current week,
 * MONTH = 1st–last day of the current month, CUSTOM = the picked dates.
 * Returns null for an incomplete or reversed custom range.
 */
export function periodWindow(
    period: TargetPeriodValue,
    today: Date = new Date()
): { from: string; to: string } | null {
    if (period.periodType === 'CUSTOM') {
        if (!period.from || !period.to || period.from > period.to) return null;
        return { from: period.from, to: period.to };
    }
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (period.periodType === 'WEEK') {
        // getDay(): Sunday = 0 … Saturday = 6. Step back to Monday.
        const sinceMonday = (base.getDay() + 6) % 7;
        const monday = new Date(base);
        monday.setDate(base.getDate() - sinceMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { from: toIsoDate(monday), to: toIsoDate(sunday) };
    }
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { from: toIsoDate(first), to: toIsoDate(last) };
}

export const overdueCount = (row: FollowupAgingCounsellorRow): number =>
    (row.overdue_1_3 ?? 0) + (row.overdue_3_7 ?? 0) + (row.overdue_7_plus ?? 0);

/**
 * One stats row per user id. A report that loaded but has no row for someone
 * means zero for that person (the aging report omits people with no open
 * follow-ups); a report that did not load leaves the fields null.
 */
export function buildStatsByUser(
    userIds: string[],
    performance: CounselorPerformance | undefined,
    aging: FollowupAgingReport | undefined
): Record<string, CounsellorStats> {
    const perfById = new Map((performance?.rows ?? []).map((r) => [r.counselor_id, r]));
    const agingById = new Map((aging?.by_counsellor ?? []).map((r) => [r.user_id, r]));
    const out: Record<string, CounsellorStats> = {};
    for (const id of userIds) {
        const stats: CounsellorStats = { ...EMPTY_STATS };
        if (performance) {
            const p = perfById.get(id);
            stats.newLeads = p?.leads_assigned ?? 0;
            stats.contacted = p?.leads_responded ?? 0;
            stats.converted = p?.conversions ?? 0;
            stats.conversionRate = p?.conversion_rate ?? null;
            stats.avgResponseMinutes = p?.avg_response_minutes ?? null;
        }
        if (aging) {
            const a = agingById.get(id);
            stats.overdueFollowups = a ? overdueCount(a) : 0;
            stats.dueTodayFollowups = a?.due_today ?? 0;
            stats.oldestOverdueDays = a?.oldest_overdue_days ?? null;
        }
        out[id] = stats;
    }
    return out;
}

/**
 * Team-wide totals over everyone the caller may see (the reports are scoped
 * server-side exactly like the roster: admin = institute, manager = subtree,
 * counsellor = self).
 */
export function buildTotals(
    performance: CounselorPerformance | undefined,
    aging: FollowupAgingReport | undefined
): CounsellorDashboardTotals {
    const rows = performance?.rows ?? [];
    const agingRows = aging?.by_counsellor ?? [];
    return {
        newLeads: performance ? rows.reduce((s, r) => s + (r.leads_assigned ?? 0), 0) : null,
        contacted: performance ? rows.reduce((s, r) => s + (r.leads_responded ?? 0), 0) : null,
        converted: performance ? rows.reduce((s, r) => s + (r.conversions ?? 0), 0) : null,
        conversionRate: performance?.summary?.avg_conversion_rate ?? null,
        avgResponseMinutes: performance?.summary?.avg_response_minutes ?? null,
        overdueFollowups: aging ? agingRows.reduce((s, r) => s + overdueCount(r), 0) : null,
        dueTodayFollowups: aging ? agingRows.reduce((s, r) => s + (r.due_today ?? 0), 0) : null,
    };
}

export type AttentionItem =
    | {
          kind: 'overdue';
          userId: string;
          name: string | null;
          count: number;
          oldestDays: number | null;
      }
    | {
          kind: 'inactiveWithLeads';
          userId: string;
          name: string | null;
          count: number;
      };

/**
 * The short "needs attention" list: whoever is furthest behind on follow-ups
 * (most overdue first), then inactive counsellors still holding leads (those
 * leads get no calls until someone reassigns them).
 */
export function buildAttentionItems(
    agingRows: FollowupAgingCounsellorRow[],
    roster: WorkbenchCounsellor[],
    { maxOverdue = 3, maxInactive = 2 }: { maxOverdue?: number; maxInactive?: number } = {}
): AttentionItem[] {
    const nameById = new Map(roster.map((c) => [c.user_id, c.full_name]));
    const overdue: AttentionItem[] = agingRows
        .map((r) => ({ row: r, count: overdueCount(r) }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, maxOverdue)
        .map(({ row, count }) => ({
            kind: 'overdue' as const,
            userId: row.user_id,
            name: nameById.get(row.user_id) || row.name || null,
            count,
            oldestDays: row.oldest_overdue_days ?? null,
        }));
    const inactive: AttentionItem[] = roster
        .filter((c) => !c.is_active && c.open_leads_count > 0)
        .sort((a, b) => b.open_leads_count - a.open_leads_count)
        .slice(0, maxInactive)
        .map((c) => ({
            kind: 'inactiveWithLeads' as const,
            userId: c.user_id,
            name: c.full_name,
            count: c.open_leads_count,
        }));
    return [...overdue, ...inactive];
}

/** "42m", "3h 5m", "2d 4h"; "—" when unknown. */
export function formatMinutes(mins: number | null | undefined): string {
    if (mins == null || Number.isNaN(mins)) return '—';
    const total = Math.max(0, Math.round(mins));
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const m = total % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${m}m`;
    return `${m}m`;
}

/** Grouped count ("1,204"); "—" when unknown. */
export function formatCount(n: number | null | undefined): string {
    return n == null ? '—' : n.toLocaleString('en-IN');
}

/** "12.5%"; "—" when unknown. */
export function formatRate(p: number | null | undefined): string {
    return p == null || Number.isNaN(p) ? '—' : `${Math.round(p * 10) / 10}%`;
}
