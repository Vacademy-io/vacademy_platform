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
        mutationFn: (vars: {
            responseId: string;
            userId?: string;
            leadName?: string;
            campaignId?: string;
            preferredNumberId?: string;
        }) =>
            placeAiCall({
                instituteId,
                responseId: vars.responseId,
                userId: vars.userId,
                campaignId: vars.campaignId,
                preferredNumberId: vars.preferredNumberId,
            }),
        onSuccess: (resp, vars) => {
            // ACCEPTED BUT WAITING is not a failure. The fleet carries a fixed number of
            // simultaneous AI calls, so when every line is busy the call is queued and
            // dials on its own — status QUEUED with a position and an ETA. This has to be
            // checked BEFORE the dispatched===false branch below, which it would
            // otherwise fall into and be reported as "not placed".
            if (resp && resp.status === 'QUEUED') {
                toast.info(
                    resp.providerMessage ||
                        `AI call queued${vars.leadName ? ` for ${vars.leadName}` : ''}`
                );
                queryClient.invalidateQueries({ queryKey: ['ai-call-queue-summary'] });
                queryClient.invalidateQueries({ queryKey: ['ai-call-queue-items'] });
                return;
            }
            // A skip is HTTP 200 with dispatched=false (lead already assigned, duplicate
            // within 30s, daily cap reached). Toasting "queued" for those told the user a
            // call was placed when nothing was dialled — the phone simply never rang, with
            // no reason shown anywhere. Surface the server's reason instead.
            if (resp && resp.dispatched === false) {
                toast.warning(resp.providerMessage || 'AI call was not placed');
                return;
            }
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
