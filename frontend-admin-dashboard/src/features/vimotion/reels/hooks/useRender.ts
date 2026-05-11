/**
 * TanStack mutation wrapping POST /external/reels/v1/render.
 *
 * `useRender` returns the freshly-created ReelResponse so the caller can
 * navigate to /vim/reels/$reelId with the new id immediately. The reel
 * starts in PENDING state on the server; status polling is on the detail
 * page (slice 4).
 *
 * Invalidates the reels list cache on success so the new reel appears
 * in the dashboard tab on the next visit.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    renderReel,
    type RenderRequest,
    type ReelResponse,
} from '../services/reels-api';

export interface UseRenderOptions {
    apiKey: string | undefined;
}

export function useRender({ apiKey }: UseRenderOptions) {
    const queryClient = useQueryClient();
    return useMutation<ReelResponse, Error, RenderRequest>({
        mutationFn: (request: RenderRequest) => {
            if (!apiKey) {
                return Promise.reject(new Error('Missing apiKey'));
            }
            return renderReel(apiKey, request);
        },
        retry: false,
        onSuccess: () => {
            // The dashboard's `reels-list` query will refetch on next focus;
            // explicit invalidation makes it immediate.
            queryClient.invalidateQueries({ queryKey: ['reels-list'] });
        },
    });
}
