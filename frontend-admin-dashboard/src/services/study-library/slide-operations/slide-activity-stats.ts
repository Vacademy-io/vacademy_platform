import { GET_SLIDE_ACTIVITY } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

export const fetchSlideActivityStats = async (slideId: string, page: number, size: number) => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: GET_SLIDE_ACTIVITY,
        params: {
            slideId,
            page,
            size,
        },
    });
    return response.data;
};

export const getSlideActivityStats = ({
    slideId,
    page,
    size,
}: {
    slideId: string;
    page: number;
    size: number;
}) => {
    return {
        queryKey: ["GET_SLIDE_ACTIVITY_STATS", slideId, page, size],
        queryFn: () => fetchSlideActivityStats(slideId, page, size),
        staleTime: 60 * 60 * 1000,
    };
};
