import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ADD_UPDATE_AUDIO_ACTIVITY } from "@/constants/urls";
import { TrackingDataType } from "@/types/tracking-data-type";

// The audio endpoint has the same contract as video/document: an
// ActivityLogDTO body plus the four cascade ids as query params. Without the
// cascade ids the backend can only update the slide row — chapter, module,
// subject and course percentages would silently keep their previous values.
export interface AddAudioActivityRequest {
    slideId: string;
    chapterId: string;
    moduleId: string;
    subjectId: string;
    packageSessionId: string;
    requestPayload: TrackingDataType;
}

export const useAddAudioActivity = () => {
    return useMutation({
        mutationFn: async ({
            slideId,
            chapterId,
            moduleId,
            subjectId,
            packageSessionId,
            requestPayload,
        }: AddAudioActivityRequest) => {
            return authenticatedAxiosInstance.post(
                ADD_UPDATE_AUDIO_ACTIVITY,
                requestPayload,
                {
                    params: {
                        slideId,
                        chapterId,
                        packageSessionId,
                        moduleId,
                        subjectId,
                    },
                }
            );
        },
    });
};
