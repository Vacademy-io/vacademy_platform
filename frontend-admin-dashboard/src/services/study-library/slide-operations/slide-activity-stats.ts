import { GET_SLIDE_ACTIVITY } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const fetchSlideActivityStats = async (
    slideId: string,
    page: number,
    size: number,
    packageSessionId?: string,
    search?: string
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
            // Server-side filter on name/email/username/mobile — matches across every page,
            // unlike filtering the page that is already in hand.
            ...(search?.trim() ? { search: search.trim() } : {}),
        },
    });
    return response.data;
};

export const getSlideActivityStats = ({
    slideId,
    page,
    size,
    packageSessionId,
    search,
}: {
    slideId: string;
    page: number;
    size: number;
    packageSessionId?: string;
    search?: string;
}) => {
    return {
        queryKey: ['GET_SLIDE_ACTIVITY_STATS', slideId, page, size, packageSessionId, search ?? ''],
        queryFn: () => fetchSlideActivityStats(slideId, page, size, packageSessionId, search),
        staleTime: 60 * 60 * 1000,
    };
};
