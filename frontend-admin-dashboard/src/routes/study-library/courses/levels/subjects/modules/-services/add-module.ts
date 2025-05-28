import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ADD_MODULE } from "@/constants/urls";
import { Module } from "@/stores/study-library/use-modules-with-chapters-store";

export const useAddModule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ subjectId, module }: { subjectId: string; module: Module }) => {
            const payload = {
                id: module.id,
                module_name: module.module_name,
                status: module.status,
                description: module.description,
                thumbnail_id: module.thumbnail_id,
            };

            return authenticatedAxiosInstance.post(`${ADD_MODULE}?subjectId=${subjectId}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
