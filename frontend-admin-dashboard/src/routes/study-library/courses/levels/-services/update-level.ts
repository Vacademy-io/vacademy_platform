// services/study-library/course-operations/update-course.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { UPDATE_LEVEL } from "@/constants/urls";
import { AddLevelData } from "@/routes/study-library/courses/levels/-components/add-level-form";

export const useUpdateLevel = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestData }: { requestData: AddLevelData }) => {
            const payload = {
                id: requestData.id,
                level_name: requestData.level_name,
                duration_in_days: requestData.duration_in_days,
                thumbnail_file_id: requestData.thumbnail_file_id,
            };

            return authenticatedAxiosInstance.put(`${UPDATE_LEVEL}/${requestData.id}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_SESSION_DATA"] });
            queryClient.invalidateQueries({ queryKey: ["GET_BATCHES"] });
        },
    });
};
