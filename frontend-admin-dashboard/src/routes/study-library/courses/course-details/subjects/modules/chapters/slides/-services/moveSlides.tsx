import { MOVE_SLIDE } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useMoveSlide = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            slideId,
            oldChapterId,
            oldModuleId,
            oldSubjectId,
            oldPackageSessionId,
            newChapterId,
            newModuleId,
            newSubjectId,
            newPackageSessionId,
            slideStatus,
            position,
        }: {
            slideId: string;
            oldChapterId: string;
            oldModuleId: string;
            oldSubjectId: string;
            oldPackageSessionId: string;
            newChapterId: string;
            newModuleId: string;
            newSubjectId: string;
            newPackageSessionId: string;
            /** PUBLISHED | DRAFT. Omitted = the slide keeps the status it already had. */
            slideStatus?: string;
            /** TOP | BOTTOM placement in the destination chapter. Omitted = end of chapter. */
            position?: string;
        }) => {
            try {
                await authenticatedAxiosInstance.post(MOVE_SLIDE, null, {
                    params: {
                        slideId,
                        oldChapterId,
                        oldModuleId,
                        oldSubjectId,
                        oldPackageSessionId,
                        newChapterId,
                        newModuleId,
                        newSubjectId,
                        newPackageSessionId,
                        ...(slideStatus ? { slideStatus } : {}),
                        ...(position ? { position } : {}),
                    },
                });
            } catch {
                throw new Error('Failed to move slide');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
    });
};
