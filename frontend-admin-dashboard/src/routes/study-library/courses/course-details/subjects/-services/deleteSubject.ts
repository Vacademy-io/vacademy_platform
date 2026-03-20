import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { DELETE_SUBJECT } from '@/constants/urls';

export const useDeleteSubject = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            subjectId,
            commaSeparatedPackageSessionIds,
        }: {
            subjectId: string;
            commaSeparatedPackageSessionIds: string;
        }) => {
            return authenticatedAxiosInstance.delete(
                `${DELETE_SUBJECT}?packageSessionId=${commaSeparatedPackageSessionIds}`,
                { data: [subjectId] }
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
        },
    });
};
