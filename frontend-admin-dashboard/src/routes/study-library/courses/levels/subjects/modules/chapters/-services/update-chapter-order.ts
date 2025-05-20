import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { UPDATE_CHAPTER_ORDER } from "@/constants/urls";
import { orderChapterPayloadType } from "@/routes/study-library/courses/-types/order-payload";

export const useUpdateChapterOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderPayload: orderChapterPayloadType[]) => {
            const payload = orderPayload;

            return authenticatedAxiosInstance.put(`${UPDATE_CHAPTER_ORDER}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
