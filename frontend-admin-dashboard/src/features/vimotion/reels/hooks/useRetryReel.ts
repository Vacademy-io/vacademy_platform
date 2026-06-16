/**
 * TanStack mutation wrapping POST /external/reels/v1/{reel_id}/retry.
 *
 * Used by the detail page's Failed branch: the server resets the reel to
 * PENDING and re-dispatches the render from the persisted config snapshot.
 * On success we seed the reel query with the returned record (instant flip
 * to the Running branch) and invalidate so `useReel`'s adaptive polling
 * takes over; the reels-list cache is invalidated for the dashboard tab.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { retryReel, type ReelResponse } from '../services/reels-api';

export interface UseRetryReelOptions {
    apiKey: string | undefined;
    reelId: string | undefined;
}

export function useRetryReel({ apiKey, reelId }: UseRetryReelOptions) {
    const queryClient = useQueryClient();
    return useMutation<ReelResponse, Error, void>({
        mutationFn: () => {
            if (!apiKey || !reelId) {
                return Promise.reject(new Error('Missing apiKey or reelId'));
            }
            return retryReel(apiKey, reelId);
        },
        retry: false,
        onSuccess: (data) => {
            // Key shape matches useReel: ['reel', reelId, apiKey].
            queryClient.setQueryData(['reel', reelId, apiKey], data);
            queryClient.invalidateQueries({ queryKey: ['reel', reelId] });
            queryClient.invalidateQueries({ queryKey: ['reels-list'] });
        },
    });
}
