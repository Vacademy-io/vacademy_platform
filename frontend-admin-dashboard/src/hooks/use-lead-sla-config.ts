/**
 * useLeadSlaConfig — table-backed TAT + Follow-up SLA settings (replaces the tatReminder/followUp
 * objects that used to live in the LEAD_SETTING JSON). Read/write via the lead-sla-config endpoint.
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const BASE = '/admin-core-service/v1/lead-sla-config';

export interface LeadSlaSettings {
    tat_enabled: boolean;
    tat_hours: number;
    /** "remind N minutes before the TAT deadline" windows (multiple allowed). */
    tat_before_minutes: number[];
    tat_notify_roles: string[];
    followup_enabled: boolean;
    followup_sla_hours: number;
    followup_remind_before_minutes: number;
    followup_notify_roles: string[];
}

export const LEAD_SLA_CONFIG_QUERY_KEY = ['lead-sla-config'];

export const LEAD_SLA_DEFAULTS: LeadSlaSettings = {
    tat_enabled: false,
    tat_hours: 24,
    tat_before_minutes: [30],
    tat_notify_roles: [],
    followup_enabled: false,
    followup_sla_hours: 24,
    followup_remind_before_minutes: 30,
    followup_notify_roles: [],
};

export async function fetchLeadSlaConfig(): Promise<LeadSlaSettings> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return LEAD_SLA_DEFAULTS;
    try {
        const { data } = await authenticatedAxiosInstance.get(BASE, { params: { instituteId } });
        return { ...LEAD_SLA_DEFAULTS, ...(data ?? {}) };
    } catch {
        return LEAD_SLA_DEFAULTS;
    }
}

export async function saveLeadSlaConfig(dto: LeadSlaSettings): Promise<void> {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.put(BASE, dto, { params: { instituteId } });
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
