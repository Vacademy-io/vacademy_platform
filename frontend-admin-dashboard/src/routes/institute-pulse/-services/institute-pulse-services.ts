import {
    INSTITUTE_PULSE_ASSESSMENTS,
    INSTITUTE_PULSE_CONTENT_MAP,
    INSTITUTE_PULSE_FEED,
    INSTITUTE_PULSE_LIVE_CLASSES,
    INSTITUTE_PULSE_SUMMARY,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import type {
    InstituteAssessmentsResponse,
    InstituteContentMapResponse,
    InstituteLiveClassesResponse,
    InstitutePulseFeedResponse,
    InstitutePulseSummaryResponse,
} from '../-types/institute-pulse-types';

/**
 * Institute scope is an order of magnitude more expensive per refresh than the batch-scoped
 * Course Pulse, so this polls at 30s rather than 15s. `refetchIntervalInBackground` defaults to
 * false, so polling pauses when the browser tab is hidden.
 */
const POLL_MS = 30000;

/**
 * The assessments rail is served by assessment_service against a 5-connection pool and is cached
 * there for 30s. Polling it faster than the server-side TTL would only add load without adding
 * freshness, so it gets its own slower interval.
 */
const ASSESSMENT_POLL_MS = 60000;

/**
 * Omit the param entirely when unscoped rather than sending an empty string — keeps the
 * institute-wide URL (and therefore the shared server-side cache key) identical to before the
 * filter existed.
 */
const batchParam = (packageSessionId?: string) => (packageSessionId ? { packageSessionId } : {});

export const getInstitutePulseSummary = async (
    instituteId: string,
    packageSessionId: string,
    page = 0,
    limit?: number
): Promise<InstitutePulseSummaryResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: INSTITUTE_PULSE_SUMMARY,
        params: { instituteId, page, ...batchParam(packageSessionId), ...(limit ? { limit } : {}) },
    });
    return response.data;
};

/**
 * Page 0 polls; deeper pages do not — same reasoning as the assessments rail. Polling every
 * loaded page would make pagination cost more than not paginating at all.
 */
export const institutePulseSummaryQueryOptions = (
    instituteId: string,
    enabled = true,
    page = 0,
    packageSessionId = ''
) => ({
    queryKey: ['institute-pulse-summary', instituteId, packageSessionId, page],
    queryFn: () => getInstitutePulseSummary(instituteId, packageSessionId, page),
    refetchInterval: page === 0 ? POLL_MS : (false as const),
    enabled: enabled && !!instituteId,
});

export const getInstituteContentMap = async (
    instituteId: string,
    packageSessionId: string
): Promise<InstituteContentMapResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: INSTITUTE_PULSE_CONTENT_MAP,
        params: { instituteId, ...batchParam(packageSessionId) },
    });
    return response.data;
};

export const instituteContentMapQueryOptions = (
    instituteId: string,
    enabled: boolean,
    packageSessionId = ''
) => ({
    queryKey: ['institute-pulse-content-map', instituteId, packageSessionId],
    queryFn: () => getInstituteContentMap(instituteId, packageSessionId),
    refetchInterval: POLL_MS,
    enabled: enabled && !!instituteId,
});

export const getInstituteLiveClasses = async (
    instituteId: string,
    packageSessionId: string,
    onAirPage = 0,
    upcomingPage = 0
): Promise<InstituteLiveClassesResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: INSTITUTE_PULSE_LIVE_CLASSES,
        params: { instituteId, onAirPage, upcomingPage, ...batchParam(packageSessionId) },
    });
    return response.data;
};

export const instituteLiveClassesQueryOptions = (
    instituteId: string,
    enabled: boolean,
    onAirPage = 0,
    upcomingPage = 0,
    packageSessionId = ''
) => ({
    queryKey: [
        'institute-pulse-live-classes',
        instituteId,
        packageSessionId,
        onAirPage,
        upcomingPage,
    ],
    queryFn: () => getInstituteLiveClasses(instituteId, packageSessionId, onAirPage, upcomingPage),
    // Only the first slice of both lists polls; expanded pages sit frozen.
    refetchInterval: onAirPage === 0 && upcomingPage === 0 ? POLL_MS : (false as const),
    enabled: enabled && !!instituteId,
});

export const getInstituteAssessments = async (
    instituteId: string,
    packageSessionId: string,
    page = 0,
    limit?: number
): Promise<InstituteAssessmentsResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: INSTITUTE_PULSE_ASSESSMENTS,
        // assessment_service names it batchId; it is the same package_session_id.
        params: {
            instituteId,
            page,
            ...(packageSessionId ? { batchId: packageSessionId } : {}),
            ...(limit ? { limit } : {}),
        },
    });
    return response.data;
};

/**
 * Page 0 polls; deeper pages do not.
 *
 * Polling every loaded page would make pagination counter-productive — five loaded pages would
 * mean five queries per tick, more load than the single unpaginated call it replaced. So the top
 * of the list stays live and anything the user has expanded is a snapshot until they refresh or
 * hit Pause/Resume.
 */
export const instituteAssessmentsQueryOptions = (
    instituteId: string,
    enabled: boolean,
    page = 0,
    packageSessionId = ''
) => ({
    queryKey: ['institute-pulse-assessments', instituteId, packageSessionId, page],
    queryFn: () => getInstituteAssessments(instituteId, packageSessionId, page),
    refetchInterval: page === 0 ? ASSESSMENT_POLL_MS : (false as const),
    enabled: enabled && !!instituteId,
});

export const getInstitutePulseFeed = async (
    instituteId: string,
    packageSessionId: string,
    windowMinutes?: number,
    limit?: number
): Promise<InstitutePulseFeedResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: INSTITUTE_PULSE_FEED,
        params: {
            instituteId,
            ...batchParam(packageSessionId),
            ...(windowMinutes ? { windowMinutes } : {}),
            ...(limit ? { limit } : {}),
        },
    });
    return response.data;
};

/**
 * The feed GROWS its limit instead of paging. A time-ordered live feed shifts as new events
 * arrive, so offset pages would duplicate or skip rows between polls; asking for a larger
 * newest-N is always internally consistent — and it keeps polling while expanded.
 */
export const institutePulseFeedQueryOptions = (
    instituteId: string,
    enabled: boolean,
    limit = 10,
    packageSessionId = ''
) => ({
    queryKey: ['institute-pulse-feed', instituteId, packageSessionId, limit],
    queryFn: () => getInstitutePulseFeed(instituteId, packageSessionId, undefined, limit),
    refetchInterval: POLL_MS,
    enabled: enabled && !!instituteId,
});
