import { DUPLICATE_STUDY_MATERIAL_FROM_SESSION } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCopyStudyMaterialFromSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            fromPackageSessionId,
            toPackageSessionId,
        }: {
            fromPackageSessionId: string;
            toPackageSessionId: string;
        }) => {
            const response = await authenticatedAxiosInstance.post(
                `${DUPLICATE_STUDY_MATERIAL_FROM_SESSION}?fromPackageSessionId=${fromPackageSessionId}&toPackageSessionId=${toPackageSessionId}`
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_INSTITUTE'] });
            queryClient.invalidateQueries({ queryKey: ['GET_SESSION_DATA'] });
            queryClient.invalidateQueries({ queryKey: ['GET_BATCHES'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['slides'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SLIDES_PROGRESS'] });
        },
        onError: (error) => {
            console.error('Error copying study material from session:', error);
        },
    });
};
