import { GET_SLIDES_COUNT } from "@/constants/urls";
import axios from "axios";

const fetchSlidesCountDetails = async (packageSessionId: string) => {
    const response = await axios({
        method: "GET",
        url: GET_SLIDES_COUNT,
        params: { packageSessionId },
    });
    return response?.data;
};
export const handleGetSlideCountDetails = (packageSessionId: string) => {
    return {
        queryKey: ["GET_SLIDES_COUNT", packageSessionId],
        queryFn: async () => {
            const data = await fetchSlidesCountDetails(packageSessionId);
            return data;
        },
        staleTime: 60 * 60 * 1000,
        enabled: !!packageSessionId,
    };
};
