import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { DELETE_MODULE } from "@/constants/urls";

export const useDeleteModule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (moduleId: string) => {
            const payload = [moduleId];
            return authenticatedAxiosInstance.post(`${DELETE_MODULE}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
