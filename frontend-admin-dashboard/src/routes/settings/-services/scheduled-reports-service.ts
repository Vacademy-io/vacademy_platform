import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL, GET_INSITITUTE_SETTINGS } from '@/constants/urls';

/**
 * Scheduled reports (REPORT_SETTING) — config read/write plus the three
 * questions the screen cannot answer for itself.
 *
 * Config rides on the generic institute-settings endpoints, exactly like the
 * slide-download / doubt / lead settings. The availability, fan-out preview and
 * delivery history come from the reporting controller.
 */

export const REPORT_SETTING_KEY = 'REPORT_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
// MUST be absolute. A relative path resolves against the dashboard's own origin
// (dash.vacademy.io), which serves the SPA, not the API: GETs quietly return
// index.html — which parses as "no sections available" — and POSTs come back
// 405 Method Not Allowed from the static host. Every other service in this app
// builds URLs from BASE_URL for exactly this reason.
const REPORTING_BASE = `${BASE_URL}/admin-core-service/reporting/v1`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportSectionInfo {
    key: string;
    title: string;
    description: string;
    visibleToRoles: string[];
    identifying: boolean;
    creditWeight: number;
    /** False when the institute has no data for this section in the recent past. */
    available: boolean;
}

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportScopeType = 'INSTITUTE' | 'BATCH' | 'SUBJECT' | 'FACULTY';

export interface ReportSchedule {
    id: string;
    name: string;
    enabled: boolean;
    frequency: ReportFrequency;
    dayOfWeek: string;
    dayOfMonth: number;
    hour: number;
    sections: string[];
    scopeType: ReportScopeType;
    scopeIds: string[];
    recipients: {
        roles: string[];
        userIds: string[];
        // Deliberately no free-text emails: reports name learners, and an
        // address outside the platform has no answer to "who received this".
    };
    skipIfNoData: boolean;
    ai: { enabled: boolean; depth: string };
}

export interface ReportSettingConfig {
    enabled: boolean;
    timezone: string;
    schedules: ReportSchedule[];
}

export interface ScopePreview {
    documentsPerRun: number;
    runsPerMonth: number;
    documentsPerMonth: number;
    exceedsCap: boolean;
    sampleLabels: string[];
}

export interface ReportRun {
    id: string;
    scheduleId: string;
    scopeLabel: string | null;
    status: string;
    skipReason: string | null;
    sectionsIncluded: string | null;
    recipientCount: number | null;
    namedLearners: number | null;
    errorMessage: string | null;
    windowStart: string;
    createdAt: string;
}

export interface ReportRunRecipient {
    id: string;
    userId: string | null;
    email: string | null;
    role: string | null;
    sectionsSent: string | null;
    namedLearners: number | null;
    delivered: boolean;
    errorMessage: string | null;
    createdAt: string;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const EMPTY_REPORT_SETTING: ReportSettingConfig = {
    enabled: false,
    timezone: 'Asia/Kolkata',
    schedules: [],
};

export function newSchedule(): ReportSchedule {
    return {
        // Stable id is required — it is half the idempotency key, and the
        // backend refuses a schedule without one rather than risk sending twice.
        id: `sched-${Date.now().toString(36)}`,
        name: 'Weekly digest',
        enabled: true,
        frequency: 'weekly',
        dayOfWeek: 'MON',
        dayOfMonth: 1,
        hour: 8,
        sections: [],
        scopeType: 'INSTITUTE',
        scopeIds: [],
        recipients: { roles: ['ADMIN'], userIds: [] },
        skipIfNoData: true,
        ai: { enabled: false, depth: 'summary' },
    };
}

// ── Config ───────────────────────────────────────────────────────────────────

/**
 * GET returns the SettingDto itself ({ key, name, data }), so the content is at
 * `response.data.data`. Reading `response.data?.[SETTING_KEY]` always resolves
 * undefined and silently falls back to defaults regardless of what was saved —
 * the same trap already documented in use-lead-report-settings.ts.
 */
export async function fetchReportSetting(): Promise<ReportSettingConfig> {
    const instituteId = getInstituteId();
    try {
        const res = await authenticatedAxiosInstance.get(GET_INSITITUTE_SETTINGS, {
            params: { instituteId, settingKey: REPORT_SETTING_KEY },
            timeout: 10000,
        });
        const stored = res.data?.data;
        if (!stored || typeof stored !== 'object') return { ...EMPTY_REPORT_SETTING };
        return {
            enabled: Boolean(stored.enabled),
            timezone: stored.timezone || 'Asia/Kolkata',
            schedules: Array.isArray(stored.schedules) ? stored.schedules : [],
        };
    } catch {
        return { ...EMPTY_REPORT_SETTING };
    }
}

export async function saveReportSetting(config: ReportSettingConfig): Promise<void> {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Scheduled Reports', setting_data: config },
        { params: { instituteId, settingKey: REPORT_SETTING_KEY } }
    );
}

// ── Reporting controller ─────────────────────────────────────────────────────

/** Sections offered to this institute, flagged with whether they have data. */
export async function fetchSections(): Promise<ReportSectionInfo[]> {
    const res = await authenticatedAxiosInstance.get(`${REPORTING_BASE}/sections`);
    return Array.isArray(res.data) ? res.data : [];
}

/**
 * How many documents a schedule would generate. Call before saving: scope
 * multiplies everything, and at a large institute "every batch" is 661
 * documents per run.
 */
export async function previewScope(schedule: ReportSchedule): Promise<ScopePreview> {
    const res = await authenticatedAxiosInstance.post(`${REPORTING_BASE}/scope-preview`, schedule);
    return res.data;
}

export interface PreviewResult {
    html: string | null;
    note: string | null;
    documentsPerRun: number;
    namedLearners: number;
}

/** Render the report as the calling admin would receive it. Sends nothing. */
export async function previewReport(schedule: ReportSchedule): Promise<PreviewResult> {
    const res = await authenticatedAxiosInstance.post(`${REPORTING_BASE}/preview`, schedule);
    return res.data;
}

/** Run it for real, now — emails every resolved recipient. */
export async function runReportNow(schedule: ReportSchedule): Promise<string> {
    const res = await authenticatedAxiosInstance.post(`${REPORTING_BASE}/run-now`, schedule);
    return typeof res.data === 'string' ? res.data : 'Report sent.';
}

export async function fetchRuns(): Promise<ReportRun[]> {
    const res = await authenticatedAxiosInstance.get(`${REPORTING_BASE}/runs`);
    return Array.isArray(res.data) ? res.data : [];
}

export async function fetchRunRecipients(runId: string): Promise<ReportRunRecipient[]> {
    const res = await authenticatedAxiosInstance.get(`${REPORTING_BASE}/runs/${runId}/recipients`);
    return Array.isArray(res.data) ? res.data : [];
}
