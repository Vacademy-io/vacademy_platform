/**
 * useLeadSlaConfig — table-backed TAT + Follow-up SLA settings (replaces the tatReminder/followUp
 * objects that used to live in the LEAD_SETTING JSON). Read/write via the lead-sla-config endpoint.
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { BASE_URL } from '@/constants/urls';

// authenticatedAxiosInstance has no baseURL and there's no Vite dev proxy for
// /admin-core-service, so the endpoint must include the backend host.
// authenticatedAxiosInstance has no baseURL, so endpoints must include the backend host.
const BASE = `${BASE_URL}/admin-core-service/v1/lead-sla-config`;

export interface LeadSlaSettings {
    tat_enabled: boolean;
    /** TAT duration in minutes (e.g. 90 = 1h 30m) — what the backend computes deadlines from. */
    tat_minutes: number;
    /** Legacy whole hours (rounded up). Derived from tat_minutes on save; don't edit directly. */
    tat_hours: number;
    /** "remind N minutes before the TAT deadline" windows (multiple allowed). */
    tat_before_minutes: number[];
    tat_notify_roles: string[];
    followup_enabled: boolean;
    /** Follow-up SLA duration in minutes. */
    followup_sla_minutes: number;
    /** Legacy whole hours (rounded up). Derived from followup_sla_minutes on save. */
    followup_sla_hours: number;
    followup_remind_before_minutes: number;
    followup_notify_roles: string[];
}

export const LEAD_SLA_CONFIG_QUERY_KEY = ['lead-sla-config'];

export const LEAD_SLA_DEFAULTS: LeadSlaSettings = {
    tat_enabled: false,
    tat_minutes: 24 * 60,
    tat_hours: 24,
    tat_before_minutes: [30],
    tat_notify_roles: [],
    followup_enabled: false,
    followup_sla_minutes: 24 * 60,
    followup_sla_hours: 24,
    followup_remind_before_minutes: 30,
    followup_notify_roles: [],
};

export async function fetchLeadSlaConfig(): Promise<LeadSlaSettings> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return LEAD_SLA_DEFAULTS;
    try {
        const { data } = await authenticatedAxiosInstance.get(BASE, { params: { instituteId } });
        const merged: LeadSlaSettings = { ...LEAD_SLA_DEFAULTS, ...(data ?? {}) };
        // A backend without the *_minutes fields only sends hours — derive minutes from them.
        if (data && data.tat_minutes == null && data.tat_hours != null) {
            merged.tat_minutes = data.tat_hours * 60;
        }
        if (data && data.followup_sla_minutes == null && data.followup_sla_hours != null) {
            merged.followup_sla_minutes = data.followup_sla_hours * 60;
        }
        return merged;
    } catch {
        return LEAD_SLA_DEFAULTS;
    }
}

export async function saveLeadSlaConfig(dto: LeadSlaSettings): Promise<void> {
    const instituteId = getCurrentInstituteId();
    // Minutes are the source of truth; the hours fields ride along (rounded up) for older backends.
    const payload: LeadSlaSettings = {
        ...dto,
        tat_hours: Math.max(1, Math.ceil(dto.tat_minutes / 60)),
        followup_sla_hours: Math.max(1, Math.ceil(dto.followup_sla_minutes / 60)),
    };
    await authenticatedAxiosInstance.put(BASE, payload, { params: { instituteId } });
}

/** Split a minute count into whole hours + remaining minutes (for the hour : minute inputs). */
export function splitMinutes(total: number): { hours: number; minutes: number } {
    const safe = Math.max(0, Math.round(total || 0));
    return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function useLeadSlaConfig(): { config: LeadSlaSettings; isLoading: boolean } {
    const { data, isLoading } = useQuery({
        queryKey: LEAD_SLA_CONFIG_QUERY_KEY,
        queryFn: fetchLeadSlaConfig,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    return { config: data ?? LEAD_SLA_DEFAULTS, isLoading };
}
