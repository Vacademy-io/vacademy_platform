import { STUDENT_RE_REGISTER_OPERATION } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ReRegisterStudentRequestType {
    user_ids: string[];
    institute_id: string;
    learner_batch_register_infos: {
        package_session_id: string;
        access_days: number;
    }[];
    access_days: number;
}

export const useReRegisterStudent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ request }: { request: ReRegisterStudentRequestType }) => {
            const response = await authenticatedAxiosInstance.post(
                STUDENT_RE_REGISTER_OPERATION,
                request
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to re-register student');
        },
    });
};
