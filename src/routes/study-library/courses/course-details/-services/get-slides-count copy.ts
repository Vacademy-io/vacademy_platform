import { GET_SLIDES_COUNT } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

const fetchSlidesCountDetails = async (packageSessionId: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SLIDES_COUNT,
        params: { packageSessionId },
    });
    return response?.data;
};
export const handleGetSlideCountDetails = (packageSessionId: string) => {
    return {
        queryKey: ['GET_SLIDES_COUNT', packageSessionId],
        queryFn: async () => {
            const data = await fetchSlidesCountDetails(packageSessionId);
            return data;
        },
        staleTime: 60 * 60 * 1000,
    };
};
