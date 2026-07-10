import { z } from 'zod';

/**
 * URL search-param contract for /audience-manager/recent-leads.
 *
 * The Recent Leads filters are URL-driven (mirrors the Follow-ups page):
 * the page initializes its filter state from these params and writes them
 * back with `navigate({ search, replace: true })` on every change, so
 * reloads restore the same view and other surfaces (Lead Reports, Sales
 * Dashboard) can deep-link into a pre-filtered list.
 *
 * Sentinel values are shared from here so drill-through links and the page
 * itself can never drift apart.
 */

// ── Sentinel filter values (also the URL param values) ────────────────
export const ALL_AUDIENCES_VALUE = '__ALL__';
export const ALL_TIERS_VALUE = '__ALL__';
export const ALL_ACTIVE_VALUE = '__ACTIVE__'; // all leads except Converted
export const ALL_STATUSES_VALUE = '__ALL_STATUS__'; // every lead regardless of status (default — enrolled leads stay visible)
export const ALL_CONVERTED_VALUE = '__CONVERTED__'; // only leads enrolled into a course
export const ALL_SLA_VALUE = '__ALL_SLA__'; // every lead regardless of SLA stage
export const ALL_COUNSELLORS_VALUE = '__ALL_COUNSELLORS__';
// Sentinel for the counsellor dropdown's "Unassigned" entry — narrows to leads
// with no owner on either linked_users (ENQUIRY) or user_lead_profile. Sent to
// the backend as `is_unassigned: true` (assigned_counselor_id omitted).
export const UNASSIGNED_COUNSELLOR_VALUE = '__UNASSIGNED__';

// Date-range presets. `range` holds a preset day-count ('1' | '7' | '15' |
// '30'), 'ALL' (no date filter) or 'CUSTOM' (read `from` / `to`).
export const ALL_DATE_VALUE = 'ALL';
export const CUSTOM_DATE_VALUE = 'CUSTOM';
export const DEFAULT_RANGE_DAYS = '30';

export const RecentLeadsSearchSchema = z.object({
    /** Lead-status filter — comma-separated status_keys or sentinels (ALL_ACTIVE / ALL_CONVERTED). */
    status: z.string().optional(),
    /** Tier filter — comma-separated HOT/WARM/COLD values. */
    tier: z.string().optional(),
    /** SLA filter — comma-separated SLA stage values. */
    sla: z.string().optional(),
    /** Assigned counsellor userIds — comma-separated, may include __UNASSIGNED__. */
    counsellor: z.string().optional(),
    /** Audience (campaign) ids — comma-separated. */
    audience: z.string().optional(),
    /** Free-text search query (applied, not the live input). */
    search: z.string().optional(),
    /** Date-range preset — '1' | '7' | '15' | '30' | 'ALL' | 'CUSTOM'. */
    range: z.string().optional(),
    /** Custom-range start (yyyy-MM-dd) — only meaningful when range=CUSTOM. */
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    /** Custom-range end (yyyy-MM-dd) — only meaningful when range=CUSTOM. */
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    /** Lead source type — WEBSITE / META / GOOGLE / ORGANIC / … (LeadFilterDTO.sourceType). */
    source: z.string().optional(),
});

export type RecentLeadsSearch = z.infer<typeof RecentLeadsSearchSchema>;
