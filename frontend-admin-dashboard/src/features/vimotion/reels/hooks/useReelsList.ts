/**
 * TanStack Query hook for listing reels for the current institute.
 *
 * Mirrors the polling pattern from `AssetsTab` — `refetchInterval` adapts
 * to whether any reel is still IN_PROGRESS so the list refreshes as
 * background renders advance, and stops polling when everything is in a
 * terminal state.
 */
import { useQuery } from '@tanstack/react-query';
import { listReels, type ReelResponse } from '../services/reels-api';

interface UseReelsListOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
    /** Optional filter: only return reels derived from this source asset. */
    inputAssetId?: string;
}

export function useReelsList({ apiKey, instituteId, inputAssetId }: UseReelsListOptions) {
    return useQuery({
        queryKey: ['reels-list', instituteId, inputAssetId, apiKey],
        enabled: !!apiKey,
        staleTime: 15_000,
        queryFn: () => listReels(apiKey as string, inputAssetId),
        // Poll while anything is mid-render so progress bars advance.
        // Stop polling when everything is COMPLETED or FAILED.
        refetchInterval: (query) => {
            const data: ReelResponse[] | undefined = query.state.data;
            const hasActive = data?.some(
                (r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS'
            );
            return hasActive ? 4_000 : false;
        },
    });
}
