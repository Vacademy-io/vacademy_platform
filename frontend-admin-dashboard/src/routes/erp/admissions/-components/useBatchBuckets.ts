import { useMemo } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getBatchOwnName } from '@/utils/helpers/student-management/batch-display-name';

/** The batch name the migration gives a learner who was admitted without a named batch. */
export const FLEXI_BATCH_NAME = 'Flexi Batch';

/**
 * Split the institute's batches into the flexi ones and everything else.
 *
 * Returns `null` for both while the institute details are still loading, so a caller
 * can tell "no batches" apart from "not known yet" — passing an empty list to the
 * learner endpoint would quietly return every learner instead of none.
 */
export function useBatchBuckets() {
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);

    return useMemo(() => {
        const batches = instituteDetails?.batches_for_sessions;
        if (!batches) {
            return { flexiIds: null, enrolledIds: null };
        }
        const flexiIds: string[] = [];
        const enrolledIds: string[] = [];
        batches.forEach((b) => {
            const own = getBatchOwnName(b).trim().toLowerCase();
            (own === FLEXI_BATCH_NAME.toLowerCase() ? flexiIds : enrolledIds).push(b.id);
        });
        return { flexiIds, enrolledIds };
    }, [instituteDetails]);
}
