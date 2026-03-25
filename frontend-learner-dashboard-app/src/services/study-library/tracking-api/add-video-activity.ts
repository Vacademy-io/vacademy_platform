import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ADD_UPDATE_VIDEO_ACTIVITY } from "@/constants/urls";
import { TrackingDataType } from "@/types/tracking-data-type";

export const useAddVideoActivity = () => {

    return useMutation({
        mutationFn: async ({
            slideId,
            chapterId,
            packageSessionId,
            moduleId,
            subjectId,
            requestPayload
        }: {
            slideId: string;
            chapterId: string;
            packageSessionId: string;
            moduleId: string;
            subjectId: string;
            requestPayload: TrackingDataType;
        }) => {
            const payload = requestPayload

            return authenticatedAxiosInstance.post(
                `${ADD_UPDATE_VIDEO_ACTIVITY}?slideId=${slideId}&chapterId=${chapterId}&packageSessionId=${packageSessionId}&moduleId=${moduleId}&subjectId=${subjectId}`,
                payload,
            );
        }
    });
};
