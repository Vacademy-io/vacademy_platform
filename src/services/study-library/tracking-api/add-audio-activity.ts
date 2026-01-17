import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ADD_UPDATE_AUDIO_ACTIVITY } from "@/constants/urls";

// Simplified payload matching the backend spec
export interface AudioActivityPayload {
    slide_id: string;
    user_id: string;
    is_new_activity: boolean;
    learner_operation: string;
    audios: {
        start_time_in_millis: number;
        end_time_in_millis: number;
        playback_speed: number;
    }[];
}

export const useAddAudioActivity = () => {
    return useMutation({
        mutationFn: async (payload: AudioActivityPayload) => {
            return authenticatedAxiosInstance.post(
                ADD_UPDATE_AUDIO_ACTIVITY,
                payload,
            );
        }
    });
};
