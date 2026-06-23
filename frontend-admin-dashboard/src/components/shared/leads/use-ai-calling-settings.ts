import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const SETTING_KEY = 'AI_CALLING_SETTING';
const GET_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/get`;

/**
 * Whether the manual "AI call" robot button should appear in lead lists. Driven by
 * the `showInLeadList` toggle in Settings → AI Calling, and deliberately separate
 * from the master `enabled` flag — hiding the button never stops the automated AI
 * workflows. Defaults to false (button hidden) until an admin turns it on.
 */
export function useAiCallButtonEnabled(): boolean {
    const { data } = useQuery({
        queryKey: ['ai-calling-show-in-lead-list'],
        queryFn: async () => {
            const instituteId = getCurrentInstituteId();
            const res = await authenticatedAxiosInstance({
                method: 'GET',
                url: GET_URL,
                params: { instituteId, settingKey: SETTING_KEY },
            });
            return Boolean(res.data?.data?.[SETTING_KEY]?.data?.showInLeadList);
        },
        staleTime: 5 * 60 * 1000,
    });
    return data ?? false;
}
