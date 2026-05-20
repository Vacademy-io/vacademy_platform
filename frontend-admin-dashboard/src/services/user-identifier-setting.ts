import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export type UserIdentifier = 'EMAIL' | 'PHONE';

const SETTING_KEY = 'USER_IDENTIFIER';

export const fetchUserIdentifierSetting = async (
    instituteId?: string,
): Promise<UserIdentifier> => {
    const resolvedInstituteId = instituteId || getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId: resolvedInstituteId, settingKey: SETTING_KEY },
    });
    const val = response.data?.data;
    return val === 'PHONE' ? 'PHONE' : 'EMAIL';
};

export const saveUserIdentifierSetting = async (identifier: UserIdentifier): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_INSTITUTE_SETTING,
        { setting_name: 'User Identifier Setting', setting_data: identifier },
        { params: { instituteId, settingKey: SETTING_KEY } },
    );
};

export const userIdentifierQueryKey = (instituteId?: string | null) => [
    'user-identifier-setting',
    instituteId || getCurrentInstituteId(),
];

export const useUserIdentifierSetting = (instituteId?: string) => {
    return useQuery({
        queryKey: userIdentifierQueryKey(instituteId),
        queryFn: () => fetchUserIdentifierSetting(instituteId),
        staleTime: 5 * 60 * 1000,
    });
};
