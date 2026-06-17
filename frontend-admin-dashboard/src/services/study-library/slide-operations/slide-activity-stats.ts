import { GET_SLIDE_ACTIVITY } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const fetchSlideActivityStats = async (
    slideId: string,
    page: number,
    size: number,
    packageSessionId?: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SLIDE_ACTIVITY,
        params: {
            slideId,
            page,
            size,
            // Scopes the list to the batch being viewed; a slide is shared across batches, so
            // omitting this leaks learners from other batches.
            ...(packageSessionId ? { packageSessionId } : {}),
        },
    });
    return response.data;
};

export const getSlideActivityStats = ({
    slideId,
    page,
    size,
    packageSessionId,
}: {
    slideId: string;
    page: number;
    size: number;
    packageSessionId?: string;
}) => {
    return {
        queryKey: ['GET_SLIDE_ACTIVITY_STATS', slideId, page, size, packageSessionId],
        queryFn: () => fetchSlideActivityStats(slideId, page, size, packageSessionId),
        staleTime: 60 * 60 * 1000,
    };
};
