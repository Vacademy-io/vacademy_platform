import { TokenKey } from '@/constants/auth/tokens';
import { GET_BATCH_LIST } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { batchesWithStudents } from '@/routes/manage-institute/batches/-types/manage-batches-types';
import { useQuery } from '@tanstack/react-query';

export const fetchBatches = async ({ sessionId }: { sessionId: string }) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.get(GET_BATCH_LIST, {
        params: {
            sessionId: sessionId,
            instituteId: INSTITUTE_ID,
        },
    });
    return response.data;
};

export const useGetBatchesQuery = ({ sessionId }: { sessionId: string }) => {
    return useQuery<batchesWithStudents | null>({
        queryKey: ['GET_BATCHES', sessionId],
        queryFn: async () => {
            const response = fetchBatches({ sessionId: sessionId });
            return response;
        },
        staleTime: 3600000,
        enabled: !!sessionId,
    });
};
