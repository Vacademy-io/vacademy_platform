import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LATEST_NOTES_BATCH } from '@/constants/urls';

export interface LatestNoteEvent {
    id: string;
    action_type: string;
    title: string;
    description?: string | null;
    actor_name?: string | null;
    created_at: string;
}

export interface LatestNoteSummary {
    /** Most-recent events first. Backend caps the list (currently 5). */
    recent: LatestNoteEvent[];
    count: number;
}

export async function fetchLatestNotesBatch(
    userIds: string[]
): Promise<Record<string, LatestNoteSummary>> {
    if (!userIds.length) return {};
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_LATEST_NOTES_BATCH,
        data: userIds,
    });
    return response.data ?? {};
}

export function useLatestNotesBatch(userIds: string[], enabled = true) {
    const stableKey = userIds.slice().sort().join(',');

    const { data, isLoading } = useQuery({
        queryKey: ['latest-notes-batch', stableKey],
        queryFn: () => fetchLatestNotesBatch(userIds),
        enabled: enabled && userIds.length > 0,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    return {
        notesByUserId: data ?? {},
        isLoading,
    };
}
