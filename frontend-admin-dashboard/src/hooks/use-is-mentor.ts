import { useQuery } from '@tanstack/react-query';
import { getInstituteId } from '@/constants/helper';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { fetchMyMentorProfile } from '@/routes/mentorship/-services/mentorship-service';

const MENTOR_ROLE = 'MENTOR';

/** Does the access token already say the caller is a mentor IN THIS institute? */
function hasMentorRoleInToken(instituteId: string | null | undefined): boolean {
    if (!instituteId) return false;
    const decoded = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken) || '');
    const roles = decoded?.authorities?.[instituteId]?.roles ?? [];
    // Institute-scoped on purpose: being a mentor in one institute says nothing about another.
    return roles.some((r) => r?.toUpperCase() === MENTOR_ROLE);
}

/**
 * Whether the signed-in user is a mentor in this institute.
 *
 * "My Mentorship" is the MENTOR's own workspace — their mentees, availability and
 * booking link — not an admin view of everyone's. The four admin screens beside it
 * (Overview / Mentors / Sessions / Requests) are the management views.
 *
 * The backend refuses `/my-mentor-profile` with "You are not a mentor in this
 * institute" for everyone else, so without this check the entry is offered to every
 * admin and lands them on an error card they can do nothing about.
 *
 * The answer is taken from the access token first, because promoting someone to
 * mentor also grants them the auth MENTOR role. That costs nothing and covers every
 * mentor whose token was issued after they were promoted — so the common case makes
 * NO request at all.
 *
 * The `/my-mentor-profile` probe is only the fallback for the two cases the token
 * can't answer: the role grant is best-effort server-side and may have failed, and a
 * token issued before the promotion won't carry the role until the user signs in
 * again. Without the fallback a real mentor would lose their only workspace, so it
 * stays — but it is now:
 *   - skipped entirely when the caller is on `enabled: false` (the Mentorship entry
 *     is hidden for this institute or role, so the answer changes nothing), and
 *   - cached for the whole session rather than re-asked every few minutes, since
 *     "you are not a mentor" does not change while the user is signed in.
 *
 * Fail-closed, like the sidebar's chat gate: `false` while loading and on error. A
 * real mentor briefly not seeing the entry on a flaky request is a far smaller
 * problem than every non-mentor admin permanently seeing a broken one.
 *
 * @param enabled Pass false to suppress the probe where the answer is not needed.
 */
export function useIsMentor(enabled = true): { isMentor: boolean; isLoading: boolean } {
    const instituteId = getInstituteId();
    const mentorByToken = hasMentorRoleInToken(instituteId);

    const query = useQuery({
        queryKey: ['mentorship-my-mentor-profile', instituteId],
        queryFn: () => fetchMyMentorProfile(instituteId ?? ''),
        // No request when the token already answered, or when the caller doesn't need it.
        enabled: !!instituteId && enabled && !mentorByToken,
        // Not being a mentor is a permanent answer, not a blip — retrying only delays it.
        retry: false,
        // Mentor-ness cannot change mid-session (promotion re-issues the token), so ask once.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    if (mentorByToken) return { isMentor: true, isLoading: false };
    return { isMentor: !!query.data, isLoading: query.isLoading };
}
