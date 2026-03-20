import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CREATE_PLANNING_LOGS } from '@/constants/urls';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import type { CreatePlanningLogsRequest, CreatePlanningLogsResponse } from '../-types/types';
import { useRouter } from '@tanstack/react-router';

export const useCreatePlanningLogs = () => {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: async (data: CreatePlanningLogsRequest) => {
            const instituteId = getInstituteId();
            const response = await authenticatedAxiosInstance.post<CreatePlanningLogsResponse>(
                CREATE_PLANNING_LOGS,
                data,
                {
                    params: { instituteId },
                }
            );
            return response.data;
        },
        onSuccess: () => {
            toast.success('Created successfully');
            // Invalidate planning logs list cache
            queryClient.invalidateQueries({ queryKey: ['planning-logs'] });
            router.history.back();
            // navigate({ to: '/planning/list' });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.message || 'Failed to create planning logs';
            toast.error(errorMessage);
            console.error('Error creating planning logs:', error);
        },
    });
};
