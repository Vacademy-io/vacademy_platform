import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { UPDATE_PLANNING_LOG } from '@/constants/urls';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import type { UpdatePlanningLogInput, PlanningLog } from '../-types/types';

interface UpdatePlanningLogParams {
    logId: string;
    data: UpdatePlanningLogInput;
}

export const useUpdatePlanningLog = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ logId, data }: UpdatePlanningLogParams) => {
            const instituteId = getInstituteId();
            const response = await authenticatedAxiosInstance.patch<PlanningLog>(
                UPDATE_PLANNING_LOG(logId),
                data,
                {
                    params: { instituteId },
                }
            );
            return response.data;
        },
        onSuccess: () => {
            toast.success('Planning log updated successfully');
            // Invalidate planning logs list cache
            queryClient.invalidateQueries({ queryKey: ['planning-logs'] });
        },
        onError: (error: any) => {
            const errorMessage =
                error?.response?.data?.message || 'Failed to update planning log';
            
            // Handle permission errors
            if (error?.response?.status === 403) {
                toast.error('You do not have permission to update this planning log');
            } else {
                toast.error(errorMessage);
            }
            
            console.error('Error updating planning log:', error);
        },
    });
};

// Hook to soft delete a planning log
export const useDeletePlanningLog = () => {
    const updateMutation = useUpdatePlanningLog();

    return useMutation({
        mutationFn: async (logId: string) => {
            return updateMutation.mutateAsync({
                logId,
                data: { status: 'DELETED' },
            });
        },
    });
};
