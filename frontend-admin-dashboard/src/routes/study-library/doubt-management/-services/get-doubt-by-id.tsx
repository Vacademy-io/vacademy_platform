import axios from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_DOUBT_BY_ID } from '@/constants/urls';
import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetch a single doubt by id, mapped to the same shape as the inbox list items.
 *
 * Backs the doubt-management deep link (?doubtId=X): when a teacher/admin opens the CTA from a
 * "doubt raised" email, the target doubt may not be on the first page of the paginated inbox — this
 * loads it directly so the inbox can still open it. Enabled only when a doubtId is present and the
 * doubt isn't already in the loaded page (caller controls `enabled`). A 404 (deleted/unknown id)
 * resolves to null rather than retrying.
 */
export const useGetDoubtById = (doubtId?: string | null, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: ['GET_DOUBT_BY_ID', doubtId],
        queryFn: async (): Promise<Doubt | null> => {
            if (!doubtId) return null;
            try {
                const response = await authenticatedAxiosInstance.get<Doubt>(
                    `${GET_DOUBT_BY_ID}/${doubtId}`
                );
                return response.data ?? null;
            } catch (e) {
                // A deleted/unknown doubt returns 404 — for the deep-link flow that's simply "no
                // target", not an error. Resolve to null so the inbox falls back to the newest doubt
                // instead of surfacing an error. Re-throw anything else (auth/5xx) to the caller.
                if (axios.isAxiosError(e) && e.response?.status === 404) return null;
                throw e;
            }
        },
        enabled: !!doubtId && options?.enabled !== false,
        retry: false,
        staleTime: 60_000,
    });
};
