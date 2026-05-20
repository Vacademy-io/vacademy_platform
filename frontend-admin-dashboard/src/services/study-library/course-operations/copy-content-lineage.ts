import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { COPY_CONTENT_LINEAGE } from '@/constants/urls';

export type CopyContentMode = 'VALUE' | 'REFERENCE';

export interface CopyContentBatchRef {
    packageSessionId: string;
    courseId: string | null;
    courseName: string | null;
    sessionName: string | null;
    levelName: string | null;
    /** Mode the child used when copying. Null on the upstream side. */
    copiedBy: CopyContentMode | null;
}

export interface CopyContentLineage {
    packageSessionId: string;
    /** Mode this batch was seeded with, or null if it was not seeded from another. */
    copiedBy: CopyContentMode | null;
    /** Upstream source (null when this batch was created from scratch). */
    copiedFrom: CopyContentBatchRef | null;
    /** Batches that have been seeded from this one (each with its own mode). */
    copiedTo: CopyContentBatchRef[];
}

/**
 * Fetch the content-copy lineage for a batch. Used by the (i) tooltip in the
 * course structure header to show "copied from X" and "used as source by Y".
 */
export const useCopyContentLineage = (packageSessionId: string | null | undefined) => {
    return useQuery<CopyContentLineage>({
        queryKey: ['COPY_CONTENT_LINEAGE', packageSessionId],
        enabled: !!packageSessionId,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get<CopyContentLineage>(
                `${COPY_CONTENT_LINEAGE}/${packageSessionId}`
            );
            return res.data;
        },
    });
};
