import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchTeamCallIntelligence } from './services/call-intelligence';

const SETTING_KEY = 'CRM_INTELLIGENCE_SETTING';
const GET_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/get`;

/**
 * Whether Call Intelligence (transcription + AI analysis of call recordings) is
 * enabled for the current institute — i.e. the master switch AND the calls block
 * are both on in Settings → CRM Intelligence. The per-call analysis panel, the
 * analytics roll-ups and the manual-upload button all self-gate on this so they
 * never appear when the feature is off (which would otherwise show an "AI
 * analysis" affordance that always says "not analyzed"). Defaults to false until
 * loaded, so nothing flashes before the setting resolves.
 */
export function useCallIntelligenceEnabled(): boolean {
    const { data } = useQuery({
        queryKey: ['crm-intelligence-enabled'],
        queryFn: async () => {
            const instituteId = getCurrentInstituteId();
            const res = await authenticatedAxiosInstance({
                method: 'GET',
                url: GET_URL,
                params: { instituteId, settingKey: SETTING_KEY },
            });
            // `/get` returns a SettingDto shape: { key, name, data }.
            const cfg = res.data?.data as
                | { enabled?: boolean; calls?: { enabled?: boolean } }
                | undefined;
            return Boolean(cfg?.enabled && cfg?.calls?.enabled);
        },
        staleTime: 5 * 60 * 1000,
    });
    return data ?? false;
}

/**
 * Whether the institute has ANY previously-analyzed call data (all-time). Lets the
 * AI Intelligence tab/page keep surfacing historical insights after Call
 * Intelligence is switched off ("off, no new data is being analyzed"). RBAC-scoped
 * to the caller's descendants like the analytics endpoints, so a rep only counts
 * calls in their own scope. Pass {@code enabled=false} to skip the network call
 * when the feature is already on (the tab/page shows regardless in that case).
 */
export function useHasCallIntelligenceData(enabled = true): boolean {
    const instituteId = getCurrentInstituteId();
    const { data } = useQuery({
        queryKey: ['crm-intelligence-has-data', instituteId],
        queryFn: async () => {
            // from=0 → all-time; totalAnalyzed>0 means at least one call was analyzed.
            const res = await fetchTeamCallIntelligence(instituteId ?? '', 0, Date.now());
            return (res?.totalAnalyzed ?? 0) > 0;
        },
        enabled: enabled && !!instituteId,
        staleTime: 5 * 60 * 1000,
    });
    return data ?? false;
}
