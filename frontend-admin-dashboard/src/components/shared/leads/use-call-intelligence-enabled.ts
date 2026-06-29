import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

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
