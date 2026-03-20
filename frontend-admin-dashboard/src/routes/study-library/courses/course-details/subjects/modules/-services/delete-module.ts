import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { DELETE_MODULE } from '@/constants/urls';

export const useDeleteModule = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            subjectId,
            moduleId,
            commaSeparatedPackageSessionIds,
        }: {
            subjectId: string;
            moduleId: string;
            commaSeparatedPackageSessionIds: string;
        }) => {
            const payload = [moduleId];
            return authenticatedAxiosInstance.post(
                `${DELETE_MODULE}?subjectId=${subjectId}&packageSessionId=${commaSeparatedPackageSessionIds}`,
                payload
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['GET_MODULES_WITH_CHAPTERS'] });
            queryClient.invalidateQueries({ queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS'] });
        },
    });
};
