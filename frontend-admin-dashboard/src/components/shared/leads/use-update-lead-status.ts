import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { updateLeadStatus } from './services/update-lead-status';

interface UseUpdateLeadStatusOptions {
    /** Extra query keys to invalidate after a successful status change (list/board/KPI). */
    invalidateKeys?: QueryKey[];
}

/**
 * Mutation hook powering the inline "Status" chip + the menu's "Set status".
 * On success it invalidates the shared lead-profiles batch (so chips refresh
 * everywhere) plus any caller-supplied keys.
 */
export function useUpdateLeadStatus({ invalidateKeys = [] }: UseUpdateLeadStatusOptions = {}) {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    return useMutation({
        mutationFn: ({ userId, status }: { userId: string; status: string; userName?: string }) =>
            updateLeadStatus(userId, instituteId, status),
        onSuccess: (_data, { status }) => {
            toast.success(`Lead marked as ${status.toLowerCase()}`);
            queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
            for (const key of invalidateKeys) {
                queryClient.invalidateQueries({ queryKey: key });
            }
        },
        onError: () => toast.error('Failed to update lead status'),
    });
}
