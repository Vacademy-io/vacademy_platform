import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { placeAiCall } from './services/place-ai-call';

interface UsePlaceAiCallOptions {
    /** Extra query keys to invalidate after the call is queued. */
    invalidateKeys?: QueryKey[];
}

/**
 * Mutation hook for the recent-leads "AI Call" action. Unlike usePlaceCall, the
 * AI call is fire-and-forget — there's no counsellor leg and no live SSE; the
 * outcome arrives later on the end-of-call webhook and is processed server-side
 * (assign-or-retry per Settings → AI Calling). So this just POSTs and toasts.
 */
export function usePlaceAiCall({ invalidateKeys = [] }: UsePlaceAiCallOptions = {}) {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    return useMutation({
        mutationFn: (vars: { responseId: string; userId?: string; leadName?: string }) =>
            placeAiCall({ instituteId, responseId: vars.responseId, userId: vars.userId }),
        onSuccess: (_resp, vars) => {
            toast.success(`AI call queued${vars.leadName ? ` for ${vars.leadName}` : ''}`);
            queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
            queryClient.invalidateQueries({ queryKey: ['telephony-call-history'] });
            for (const key of invalidateKeys) {
                queryClient.invalidateQueries({ queryKey: key });
            }
        },
        onError: (err) => toast.error(extractServerErrorMessage(err)),
    });
}

function extractServerErrorMessage(err: unknown): string {
    if (err && typeof err === 'object') {
        const e = err as {
            response?: { data?: { ex?: string; message?: string } };
            message?: string;
        };
        if (typeof e.response?.data?.ex === 'string') return e.response.data.ex;
        if (typeof e.response?.data?.message === 'string') return e.response.data.message;
        if (typeof e.message === 'string') return e.message;
    }
    return 'Could not place AI call';
}
