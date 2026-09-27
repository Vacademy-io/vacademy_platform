/**
 * useLeadSettings — single source of truth for all lead-system config.
 *
 * Reads LEAD_SETTING from the backend (same key saved by LeadSettings.tsx).
 * All lead UI (score badges, tier filters, sidebar tab, walk-in button) must
 * gate itself behind { enabled } from this hook.
 *
 * Usage:
 *   const { enabled, showScoreInEnquiryTable } = useLeadSettings();
 *   if (!enabled) return null;
 */

import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ── Types (mirror LeadSettingsData in LeadSettings.tsx) ──────────────────────

export interface LeadScoringWeights {
    sourceQuality: number;
    profileCompleteness: number;
    recency: number;
    engagement: number;
}

/** A "before SLA breach" reminder window. The backend emits triggerKey once when reached. */
export interface BeforeSlaTrigger {
    beforeMinutes: number;
    triggerKey: string;
    stage?: string;
}

export interface TriggerRef {
    triggerKey: string;
    stage?: string;
}

/**
 * TAT (turnaround-time) reminder config. The backend ONLY emits the configured workflow triggers;
 * delivery (email/WhatsApp/push/in-app), templates and escalation are owned by the workflow engine.
 */
export interface TatReminderConfig {
    enabled: boolean;
    tatHours: number;
    beforeTatTriggers: BeforeSlaTrigger[];
    overdueTrigger: TriggerRef;
    /** Institute role names to notify (passed into the trigger context for the workflow to target). */
    notifyRoles?: string[];
}

/** Follow-up SLA config — clock anchored on the counselor's last action (recurring). */
export interface FollowUpConfig {
    enabled: boolean;
    followUpSlaHours: number;
    beforeFollowUpTrigger: BeforeSlaTrigger;
    overdueTrigger: TriggerRef;
    /** Institute role names to notify (passed into the trigger context for the workflow to target). */
    notifyRoles?: string[];
}

/** Institute-defined lead status / pipeline stage. */
export interface CustomLeadStatus {
    key: string;
    label: string;
    color: string;
    order: number;
}

/** Fallback colour for a brand-new status (status colours are arbitrary user-picked hex). */
export const DEFAULT_STATUS_COLOR = '#3b82f6';

/** Sensible starter pipeline shown until an institute customises its own. */
export const DEFAULT_CUSTOM_LEAD_STATUSES: CustomLeadStatus[] = [
    { key: 'NEW', label: 'New', color: '#3b82f6', order: 1 },
    { key: 'CONTACTED', label: 'Contacted', color: '#06b6d4', order: 2 },
    { key: 'INTERESTED', label: 'Interested', color: '#22c55e', order: 3 },
    { key: 'CALLBACK', label: 'Callback Scheduled', color: '#f59e0b', order: 4 },
    { key: 'DEMO_SCHEDULED', label: 'Demo Scheduled', color: '#8b5cf6', order: 5 },
    { key: 'NOT_INTERESTED', label: 'Not Interested', color: '#ef4444', order: 6 },
    { key: 'CONVERTED', label: 'Converted', color: '#16a34a', order: 7 },
];

export interface LeadSettingsConfig {
    /** Institute-wide master toggle. When false, all lead UI is hidden. */
    enabled: boolean;

    scoringWeights: LeadScoringWeights;

    /** Days before recency score starts decaying. */
    recencyDecayDays: number;

    /** Per-table badge visibility flags. */
    showScoreInEnquiryTable: boolean;
    showScoreInContactsTable: boolean;
    showScoreInStudentsTable: boolean;

    /** TAT / follow-up SLA reminder configuration (trigger-only; engine handles delivery). */
    tatReminder: TatReminderConfig;
    followUp: FollowUpConfig;
    customStatuses: CustomLeadStatus[];

    /**
     * Institute-specific display names for the built-in lead attributes, e.g. an
     * Eduzilla-style institute calling Tier "Interest Level" and Lead Status
     * "Action Label". Empty/missing = the default wording. Read through
     * useLeadTerminology() so every surface agrees.
     */
    labels?: LeadTerminologyLabels;
}

export interface LeadTerminologyLabels {
    tier?: string;
    leadStatus?: string;
}

export const LEAD_SETTINGS_DEFAULTS: LeadSettingsConfig = {
    enabled: true,
    scoringWeights: {
        sourceQuality: 25,
        profileCompleteness: 30,
        recency: 25,
        engagement: 20,
    },
    recencyDecayDays: 30,
    showScoreInEnquiryTable: true,
    showScoreInContactsTable: true,
    showScoreInStudentsTable: true,
    tatReminder: {
        enabled: false,
        tatHours: 24,
        beforeTatTriggers: [
            { beforeMinutes: 30, triggerKey: 'LEAD_TAT_REMINDER_BEFORE', stage: 'BEFORE_30M' },
        ],
        overdueTrigger: { triggerKey: 'LEAD_TAT_OVERDUE', stage: 'OVERDUE' },
        notifyRoles: [],
    },
    followUp: {
        enabled: false,
        followUpSlaHours: 24,
        beforeFollowUpTrigger: { beforeMinutes: 30, triggerKey: 'FOLLOW_UP_DUE' },
        overdueTrigger: { triggerKey: 'FOLLOW_UP_OVERDUE' },
        notifyRoles: [],
    },
    customStatuses: DEFAULT_CUSTOM_LEAD_STATUSES,
    labels: {},
};

// ── Fetcher ──────────────────────────────────────────────────────────────────

const SETTING_KEY = 'LEAD_SETTING';

/**
 * Pull the saved config out of a `/institute/setting/v1/get` response.
 *
 * The endpoint answers with the SettingDto itself — `{key, name, data}` — so the config lives
 * at `response.data.data`, which is what every other settings hook reads. This hook used to
 * read `response.data.data[SETTING_KEY].data`, a shape the endpoint never returns, so the
 * lookup was always undefined and EVERY institute silently fell back to
 * {@link LEAD_SETTINGS_DEFAULTS}: renamed Tier / Lead-status labels never reached the UI and
 * per-table score visibility was ignored. The nested shape is still tried first so a wrapped
 * payload would keep working.
 */
export function extractLeadSettingData(
    responseBody: unknown
): Partial<LeadSettingsConfig> | undefined {
    if (!responseBody || typeof responseBody !== 'object') return undefined;
    const body = responseBody as Record<string, unknown>;
    const nested = (body.data as Record<string, unknown> | undefined)?.[SETTING_KEY] as
        | { data?: Partial<LeadSettingsConfig> }
        | undefined;
    if (nested?.data && typeof nested.data === 'object') return nested.data;
    const direct = body.data;
    if (direct && typeof direct === 'object') return direct as Partial<LeadSettingsConfig>;
    return undefined;
}

/** Merge saved config over the defaults, keeping nested groups whole. */
export function mergeLeadSettings(
    saved: Partial<LeadSettingsConfig> | undefined
): LeadSettingsConfig {
    if (!saved) return LEAD_SETTINGS_DEFAULTS;
    return {
        ...LEAD_SETTINGS_DEFAULTS,
        ...saved,
        // Nested groups are spread so a partially-saved blob can't drop a weight or a flag.
        scoringWeights: {
            ...LEAD_SETTINGS_DEFAULTS.scoringWeights,
            ...(saved.scoringWeights ?? {}),
        },
        tatReminder: { ...LEAD_SETTINGS_DEFAULTS.tatReminder, ...(saved.tatReminder ?? {}) },
        followUp: { ...LEAD_SETTINGS_DEFAULTS.followUp, ...(saved.followUp ?? {}) },
        labels: { ...(LEAD_SETTINGS_DEFAULTS.labels ?? {}), ...(saved.labels ?? {}) },
    };
}

async function fetchLeadSettings(): Promise<LeadSettingsConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return LEAD_SETTINGS_DEFAULTS;
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        return mergeLeadSettings(extractLeadSettingData(response.data));
    } catch {
        return LEAD_SETTINGS_DEFAULTS;
    }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the institute's lead settings config.
 * Falls back to safe defaults on error or missing setting so callers never
 * need to handle undefined.
 *
 * @param options.skip  Set to true in contexts where lead settings are irrelevant
 *                      (e.g. learner portal). Skips the network request.
 */
export function useLeadSettings(options?: { skip?: boolean }): LeadSettingsConfig & {
    isLoading: boolean;
} {
    const { data, isLoading } = useQuery({
        queryKey: ['lead-settings-config'],
        queryFn: fetchLeadSettings,
        staleTime: 5 * 60 * 1000, // 5 minutes — settings change rarely
        gcTime: 10 * 60 * 1000,
        enabled: !options?.skip,
    });

    return {
        ...(data ?? LEAD_SETTINGS_DEFAULTS),
        isLoading,
    };
}
