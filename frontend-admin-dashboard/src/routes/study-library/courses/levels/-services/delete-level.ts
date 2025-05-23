import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { DELETE_LEVEL } from "@/constants/urls";

export const useDeleteLevel = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (levelId: string) => {
            return authenticatedAxiosInstance.delete(`${DELETE_LEVEL}`, { data: [levelId] });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_SESSION_DATA"] });
            queryClient.invalidateQueries({ queryKey: ["GET_BATCHES"] });
        },
    });
};
