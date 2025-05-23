import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { UPDATE_MODULE } from "@/constants/urls";
import { Module } from "@/stores/study-library/use-modules-with-chapters-store";

export const useUpdateModule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ moduleId, module }: { moduleId: string; module: Module }) => {
            const payload = {
                id: module.id,
                module_name: module.module_name,
                status: module.status,
                description: module.description,
                thumbnail_id: module.thumbnail_id,
            };
            return authenticatedAxiosInstance.put(`${UPDATE_MODULE}?moduleId=${moduleId}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
