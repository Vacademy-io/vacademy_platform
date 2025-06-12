import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { Chapter } from "@/stores/study-library/use-modules-with-chapters-store";
import { ADD_CHAPTER } from "@/constants/urls";

export const useAddChapter = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            moduleId,
            commaSeparatedPackageSessionIds,
            chapter,
        }: {
            moduleId: string;
            commaSeparatedPackageSessionIds: string;
            chapter: Chapter;
        }) => {
            const payload = {
                id: chapter.id,
                chapter_name: chapter.chapter_name,
                status: chapter.status,
                file_id: chapter.file_id,
                description: chapter.description,
                chapter_order: chapter.chapter_order,
            };

            try {
                const response = await authenticatedAxiosInstance.post(
                    `${ADD_CHAPTER}?moduleId=${moduleId}&commaSeparatedPackageSessionIds=${commaSeparatedPackageSessionIds}`,
                    payload,
                );
                return response.data;
            } catch (error) {
                throw new Error("Failed to add chapter");
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
