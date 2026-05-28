import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { updateLeadTier } from './services/update-lead-tier';

interface UseUpdateLeadTierOptions {
    /** Extra query keys to invalidate after a successful tier change (list/board/KPI). */
    invalidateKeys?: QueryKey[];
}

/**
 * Mutation hook powering the per-card "Set tier" action. On success it
 * invalidates the shared lead-profiles batch (so stage chips + score refresh
 * everywhere) plus any caller-supplied keys for the active list / board / KPI
 * queries.
 */
export function useUpdateLeadTier({ invalidateKeys = [] }: UseUpdateLeadTierOptions = {}) {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    return useMutation({
        mutationFn: ({ userId, tier }: { userId: string; tier: string; userName?: string }) =>
            updateLeadTier(userId, instituteId, tier),
        onSuccess: (_data, { tier }) => {
            toast.success(`Lead tier set to ${tier}`);
            queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
            for (const key of invalidateKeys) {
                queryClient.invalidateQueries({ queryKey: key });
            }
        },
        onError: () => toast.error('Failed to update lead tier'),
    });
}
