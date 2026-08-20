import { useQuery } from '@tanstack/react-query';
import { getInstituteId } from '@/constants/helper';
import { fetchMyMentorProfile } from '@/routes/mentorship/-services/mentorship-service';

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
 * Fail-closed, like the sidebar's chat gate directly above it: `false` while loading
 * and on error. A real mentor briefly not seeing the entry on a flaky request is a
 * far smaller problem than every non-mentor admin permanently seeing a broken one.
 */
export function useIsMentor(): { isMentor: boolean; isLoading: boolean } {
    const instituteId = getInstituteId();
    const query = useQuery({
        queryKey: ['mentorship-my-mentor-profile', instituteId],
        queryFn: () => fetchMyMentorProfile(instituteId ?? ''),
        enabled: !!instituteId,
        // Not being a mentor is a permanent answer, not a blip — retrying only delays it.
        retry: false,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
    return { isMentor: !!query.data, isLoading: query.isLoading };
}
