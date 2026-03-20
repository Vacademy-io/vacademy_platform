import { useQuery } from '@tanstack/react-query';
import { getLiveSessions, LiveSession } from '../-services/utils';

export function useLiveSessions(instituteId: string) {
    return useQuery<LiveSession[], Error>({
        queryKey: ['liveSessions', instituteId],
        queryFn: () => getLiveSessions(instituteId),
        staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    });
}
