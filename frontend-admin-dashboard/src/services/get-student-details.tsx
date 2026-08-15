import { GET_USER_DETAILS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useQuery, type QueryClient } from '@tanstack/react-query';

/**
 * The user-record fields callers need to seed the shared student/lead side-sheet
 * before its own tabs hydrate. Every field is optional because a lead (as
 * opposed to an enrolled learner) typically has only a name and one contact
 * channel filled in.
 *
 * The endpoint returns considerably more than this, and existing consumers read
 * those extra fields directly off the response, so the index signature keeps
 * them reachable — narrow only what you actually need.
 */
export interface StudentDetailsResponse {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
    id?: string;
    user_id?: string;
    username?: string | null;
    full_name?: string;
    email?: string;
    mobile_number?: string;
    gender?: string;
    city?: string;
    region?: string | null;
    pin_code?: string;
    address_line?: string;
    date_of_birth?: string;
    fathers_name?: string;
    mothers_name?: string;
    parents_mobile_number?: string;
    parents_email?: string;
    face_file_id?: string | null;
    institute_enrollment_id?: string;
}

export const studentDetailsKey = (userId: string) => ['STUDENT_DETAILS', userId] as const;

const STUDENT_DETAILS_STALE_TIME = 1000 * 60 * 60 * 5;

async function fetchStudentDetails(userId: string): Promise<StudentDetailsResponse> {
    const response = await authenticatedAxiosInstance.get(GET_USER_DETAILS, {
        params: { userId },
    });
    return response.data;
}

export const useGetStudentDetails = (userId: string) => {
    return useQuery({
        queryKey: studentDetailsKey(userId),
        queryFn: () => fetchStudentDetails(userId),
        staleTime: STUDENT_DETAILS_STALE_TIME,
        enabled: !!userId,
    });
};

/**
 * Imperative sibling of {@link useGetStudentDetails} for callers that must have
 * the record in hand before rendering (e.g. seeding the side-sheet on a row
 * click). Shares the query key and staleTime, so the hook-based consumers inside
 * the sheet read the same cached entry instead of re-fetching.
 */
export const fetchStudentDetailsOnce = (
    queryClient: QueryClient,
    userId: string
): Promise<StudentDetailsResponse> =>
    queryClient.fetchQuery({
        queryKey: studentDetailsKey(userId),
        queryFn: () => fetchStudentDetails(userId),
        staleTime: STUDENT_DETAILS_STALE_TIME,
    });
