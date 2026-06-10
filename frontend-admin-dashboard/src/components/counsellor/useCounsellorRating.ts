import { useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    COUNSELLOR_RATING_BATCH,
    COUNSELLOR_RATING_LEADERBOARD,
    COUNSELLOR_RATING_ONE,
} from '@/constants/urls';

/**
 * Cached rating shape — mirrors backend RatingDTO.
 */
export interface CounsellorRating {
    counsellor_user_id: string;
    institute_id: string;
    strategy_type: 'STATIC' | 'STRATEGY_BASED';
    score: number | null;
    conversion_ratio_score: number | null;
    velocity_score: number | null;
    sample_size: number | null;
    last_computed_at: string | null;
}

const QK = (instituteId: string, userId: string) =>
    ['counsellor-rating', instituteId, userId] as const;

/**
 * Single-rating fetcher. Stays trivial — the dropdown / card / leaderboard
 * mounts many of these in parallel and we rely on React Query's per-key cache
 * de-duplication so each rating is fetched at most once per page session.
 *
 * For dense surfaces (assign dropdown opening with 50 counsellors), prefer
 * useCounsellorRatingBatch which warms the same cache keys in one round-trip.
 */
export function useCounsellorRating(instituteId: string | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: QK(instituteId ?? '', userId ?? ''),
        enabled: !!instituteId && !!userId,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get<CounsellorRating>(
                COUNSELLOR_RATING_ONE(instituteId!, userId!)
            );
            return res.data;
        },
    });
}

/**
 * Pre-warm many ratings into the React Query cache with one batch request.
 * Use from list pages (counsellors page rail, leaderboard, dropdown opener)
 * before rendering individual badges so each badge resolves from cache.
 */
export function useCounsellorRatingBatch(
    instituteId: string | undefined,
    counsellorUserIds: string[] | undefined
) {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: ['counsellor-rating-batch', instituteId, (counsellorUserIds ?? []).sort().join(',')],
        enabled: !!instituteId && !!counsellorUserIds && counsellorUserIds.length > 0,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.post<Record<string, CounsellorRating>>(
                COUNSELLOR_RATING_BATCH,
                {
                    institute_id: instituteId,
                    counsellor_user_ids: counsellorUserIds,
                }
            );
            // Hydrate per-id cache entries so any <CounsellorRatingBadge>
            // mounted after this resolves directly from the cache.
            Object.entries(res.data).forEach(([uid, rating]) => {
                queryClient.setQueryData(QK(instituteId!, uid), rating);
            });
            return res.data;
        },
    });
}

export interface LeaderboardEntry {
    rank: number;
    counsellor_user_id: string;
    full_name: string | null;
    score: number;
    conversion_ratio_score: number | null;
    velocity_score: number | null;
    sample_size: number | null;
    strategy_type: string;
}

export function useCounsellorRatingLeaderboard(
    instituteId: string | undefined,
    teamId?: string,
    limit: number = 10
) {
    return useQuery({
        queryKey: ['counsellor-rating-leaderboard', instituteId, teamId ?? null, limit],
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get<LeaderboardEntry[]>(
                COUNSELLOR_RATING_LEADERBOARD(instituteId!, teamId, limit)
            );
            return res.data;
        },
    });
}
