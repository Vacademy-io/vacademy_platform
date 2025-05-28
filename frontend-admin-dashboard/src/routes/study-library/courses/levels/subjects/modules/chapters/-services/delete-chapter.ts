import { DELETE_CHAPTER } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useDeleteChapter = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            packageSessionIds,
            chapterIds,
        }: {
            packageSessionIds: string;
            chapterIds: string[];
        }) => {
            try {
                const response = await authenticatedAxiosInstance.post(
                    `${DELETE_CHAPTER}?packageSessionIds=${packageSessionIds}`,
                    chapterIds,
                );
                toast.success("Chapter deleted successfully");
                return response.data;
            } catch (error) {
                toast.error("Failed to delete chapter");
                throw new Error("Failed to delete chapter");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};
