import { COPY_CHAPTER, MOVE_CHAPTER } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCopyChapter = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            packageSessionId,
            moduleId,
            chapterId,
        }: {
            packageSessionId: string;
            moduleId: string;
            chapterId: string;
        }) => {
            try {
                const response = await authenticatedAxiosInstance.post(
                    `${COPY_CHAPTER}?packageSessionId=${packageSessionId}&moduleId=${moduleId}&chapterId=${chapterId}`,
                );
                return response.data;
            } catch (error) {
                throw new Error("Failed to copy chapter");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
            queryClient.invalidateQueries({ queryKey: ["GET_STUDENT_SUBJECTS_PROGRESS"] });
        },
    });
};

export const useMoveChapter = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            existingPackageSessionId,
            newPackageSessionId,
            moduleId,
            chapterId,
        }: {
            existingPackageSessionId: string;
            newPackageSessionId: string;
            moduleId: string;
            chapterId: string;
        }) => {
            try {
                const response = await authenticatedAxiosInstance.post(
                    `${MOVE_CHAPTER}?existingPackageSessionId=${existingPackageSessionId}&newPackageSessionId=${newPackageSessionId}&moduleId=${moduleId}&chapterId=${chapterId}`,
                );
                return response.data;
            } catch (error) {
                throw new Error("Failed to move chapter");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_MODULES_WITH_CHAPTERS"] });
        },
    });
};
