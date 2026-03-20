import { useQuery } from '@tanstack/react-query';
import {
    getLiveSessions,
    getUpcomingSessions,
    getPastSessions,
    getDraftSessions,
    getSessionBySessionId,
    LiveSession,
    UpcomingSessionDay,
    PastSessionDay,
    DraftSessionDay,
    SessionBySessionIdResponse,
    searchSessions,
    SessionSearchRequest,
    SessionSearchResponse,
} from '../-services/utils';

export function useLiveSessions(instituteId: string) {
    return useQuery<LiveSession[], Error>({
        queryKey: ['liveSessions', instituteId],
        queryFn: () => getLiveSessions(instituteId),
        staleTime: 0, // Always consider data stale so it refetches on mount
    });
}

export function useUpcomingSessions(instituteId: string) {
    return useQuery<UpcomingSessionDay[], Error>({
        queryKey: ['upcomingSessions', instituteId],
        queryFn: () => getUpcomingSessions(instituteId),
        staleTime: 0,
    });
}

export function usePastSessions(instituteId: string) {
    return useQuery<PastSessionDay[], Error>({
        queryKey: ['pastSessions', instituteId],
        queryFn: () => getPastSessions(instituteId),
        staleTime: 0,
    });
}

export function useDraftSessions(instituteId: string) {
    return useQuery<DraftSessionDay[], Error>({
        queryKey: ['draftSessions', instituteId],
        queryFn: () => getDraftSessions(instituteId),
        staleTime: 0,
    });
}

export function useSessionBySessionId(sessionId: string) {
    return useQuery<SessionBySessionIdResponse, Error>({
        queryKey: ['sessionBySessionId', sessionId],
        queryFn: () => getSessionBySessionId(sessionId),
        enabled: !!sessionId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useSessionSearch(request: SessionSearchRequest) {
    return useQuery<SessionSearchResponse, Error>({
        queryKey: ['sessionSearch', request],
        queryFn: () => searchSessions(request),
        staleTime: 0,
    });
}
