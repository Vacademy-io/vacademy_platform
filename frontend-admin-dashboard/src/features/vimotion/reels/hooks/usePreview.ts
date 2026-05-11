/**
 * TanStack mutation wrapping POST /external/reels/v1/preview.
 *
 * Mutation (not query) because /preview is a user-triggered action with
 * real LLM cost — we don't want it firing implicitly on cache invalidation
 * or refocus. The backend already caches `enriched` per candidate, so
 * re-previewing the same candidate later returns the same payload almost
 * for free.
 */
import { useMutation } from '@tanstack/react-query';
import {
    previewReelCandidates,
    type PreviewRequest,
    type PreviewResponse,
} from '../services/reels-api';

export interface UsePreviewOptions {
    apiKey: string | undefined;
}

export function usePreview({ apiKey }: UsePreviewOptions) {
    return useMutation<PreviewResponse, Error, PreviewRequest>({
        mutationFn: (request: PreviewRequest) => {
            if (!apiKey) {
                return Promise.reject(new Error('Missing apiKey'));
            }
            return previewReelCandidates(apiKey, request);
        },
        // No retry — if /preview fails (LLM hiccup, network), surface
        // immediately so the user can hit "Try again" rather than waiting
        // through an opaque retry loop.
        retry: false,
    });
}
