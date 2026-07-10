// Track B — Teacher flow: link recording/class material to course chapters.
//
// Thin typed wrapper around the already-deployed admin-core-service endpoints
// (see docs/LIVE_CLASS_PAST_SESSIONS_AND_CONTENT_LINKING_PLAN.md, "Track B").
// Request/response field names are kept snake_case to match the backend
// contract exactly — do not camelCase these.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    LIVE_SESSION_CONTENT_LINK,
    LIVE_SESSION_CONTENT_LINKS,
    LIVE_SESSION_CONTENT_UNLINK,
} from '@/constants/urls';

export type ContentLinkSourceKind = 'RECORDING' | 'UPLOAD_PDF' | 'UPLOAD_VIDEO' | 'YOUTUBE';

export interface ContentLinkSource {
    kind: ContentLinkSourceKind;
    recording_id?: string;
    file_id?: string;
    url?: string;
}

export interface ContentLinkDestination {
    package_session_id: string;
    chapter_id: string;
    module_id: string;
    subject_id: string;
}

export type SlideStatus = 'PUBLISHED' | 'DRAFT';
export type ContentLinkPosition = 'TOP' | 'BOTTOM';

export interface LinkSessionContentRequest {
    session_id: string;
    schedule_id?: string;
    source: ContentLinkSource;
    title: string;
    description?: string;
    slide_status: SlideStatus;
    notify: boolean;
    position: ContentLinkPosition;
    destinations: ContentLinkDestination[];
}

export type ContentLinkOutcomeType = 'CREATED' | 'ALREADY_LINKED' | 'SHARED_CHAPTER_DEDUPED';

export interface ContentLinkOutcome {
    outcome: ContentLinkOutcomeType;
    slide_id: string;
    chapter_id: string;
    package_session_id: string;
}

export type ContentLinkContentType = 'RECORDING' | 'MATERIAL_PDF' | 'MATERIAL_VIDEO';

export interface SessionContentLink {
    id: string;
    session_id: string;
    schedule_id: string | null;
    recording_id: string | null;
    content_type: ContentLinkContentType;
    slide_id: string;
    slide_title: string;
    chapter_id: string;
    chapter_name: string;
    package_session_id: string;
    created_at: string;
}

export const linkSessionContent = async (
    payload: LinkSessionContentRequest
): Promise<ContentLinkOutcome[]> => {
    const response = await authenticatedAxiosInstance.post<ContentLinkOutcome[]>(
        LIVE_SESSION_CONTENT_LINK,
        payload
    );
    return response.data;
};

export const getSessionContentLinks = async (
    sessionId: string
): Promise<SessionContentLink[]> => {
    const response = await authenticatedAxiosInstance.get<SessionContentLink[]>(
        LIVE_SESSION_CONTENT_LINKS,
        { params: { sessionId } }
    );
    return response.data;
};

export const unlinkSessionContent = async (linkId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(LIVE_SESSION_CONTENT_UNLINK(linkId));
};

/** Human summary of a link response, e.g. "Added to 2 chapters, 1 already linked". */
export const summarizeContentLinkOutcomes = (outcomes: ContentLinkOutcome[]): string => {
    const created = outcomes.filter((o) => o.outcome === 'CREATED').length;
    const deduped = outcomes.filter((o) => o.outcome === 'SHARED_CHAPTER_DEDUPED').length;
    const alreadyLinked = outcomes.filter((o) => o.outcome === 'ALREADY_LINKED').length;
    const parts: string[] = [];
    if (created > 0) parts.push(`Added to ${created} chapter${created === 1 ? '' : 's'}`);
    if (deduped > 0) parts.push(`${deduped} shared chapter${deduped === 1 ? '' : 's'} (deduped)`);
    if (alreadyLinked > 0) parts.push(`${alreadyLinked} already linked`);
    return parts.length > 0 ? parts.join(', ') : 'No changes made';
};

export const sessionContentLinksQueryKey = (sessionId: string) => [
    'LIVE_SESSION_CONTENT_LINKS',
    sessionId,
];

/** All content (recording/material) links for a session — drives the "Added to X" state. */
export const useSessionContentLinks = (sessionId: string | undefined) => {
    return useQuery({
        queryKey: sessionContentLinksQueryKey(sessionId ?? ''),
        queryFn: () => getSessionContentLinks(sessionId as string),
        enabled: !!sessionId,
        staleTime: 30_000,
    });
};

/** Creates the destination slide(s) for one source (recording/upload/YouTube). */
export const useLinkSessionContent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: LinkSessionContentRequest) => linkSessionContent(payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: sessionContentLinksQueryKey(variables.session_id),
            });
        },
    });
};

/** Soft-deletes a link and removes the slide from its chapter. */
export const useUnlinkSessionContent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (linkId: string) => unlinkSessionContent(linkId),
        onSuccess: () => {
            // sessionId isn't known at the mutation call site in every caller,
            // so invalidate every content-links query — cheap and infrequent.
            queryClient.invalidateQueries({ queryKey: ['LIVE_SESSION_CONTENT_LINKS'] });
        },
    });
};
