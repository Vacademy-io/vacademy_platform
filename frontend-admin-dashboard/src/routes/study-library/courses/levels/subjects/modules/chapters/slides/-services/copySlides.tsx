import { COPY_SLIDE } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCopySlide = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            slideId,
            newChapterId,
        }: {
            slideId: string;
            newChapterId: string;
        }) => {
            try {
                await authenticatedAxiosInstance.post(
                    `${COPY_SLIDE}?slideId=${slideId}&newChapterId=${newChapterId}`,
                );
            } catch {
                throw new Error("Failed to copy slide");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["slides"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SLIDES_PROGRESS"] });
        },
    });
};
