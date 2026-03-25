import { getInstituteId } from '@/constants/helper';
import { GET_REFERRAL_LIST_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const getReferralProgramDetailsData = async () => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_REFERRAL_LIST_URL,
        params: {
            source: 'INSTITUTE',
            sourceId: instituteId,
        },
    });
    return response?.data;
};
export const handleGetReferralProgramDetails = () => {
    return {
        queryKey: ['GET_REFERRAL_PROGRAM_DETAILS'],
        queryFn: () => getReferralProgramDetailsData(),
        staleTime: 60 * 60 * 1000,
    };
};
