import type { AssignmentResult } from '../-types/mentorship-types';

/**
 * Human summary of an assignment run. Every selected student must be accounted
 * for: assigned, skipped (already paired with that mentor), or blocked because the
 * mentor is at their mentee limit. Capacity is the newest of the three and the one
 * an admin can act on, so it always names the fix.
 */
export function assignmentResultMessage(
    result: AssignmentResult,
    /** MANUAL wording says "already assigned"; round-robin says "skipped". */
    variant: 'manual' | 'bulk' = 'manual'
): string {
    const assigned = result.assigned ?? 0;
    const skipped = result.skipped ?? 0;
    const capacityFull = result.capacity_full ?? 0;

    const parts: string[] = [`Assigned ${assigned}`];
    if (skipped > 0) {
        parts.push(variant === 'manual' ? `${skipped} already assigned` : `${skipped} skipped`);
    }
    if (capacityFull > 0) {
        parts.push(
            `${capacityFull} left out — ${
                variant === 'manual' ? 'mentor is at their limit' : 'all mentors at their limit'
            }`
        );
    }
    return parts.join(', ');
}

/**
 * True when the run couldn't place everyone. The caller shows a warning toast
 * instead of a success one — "Assigned 0" is not a success.
 */
export function assignmentNeedsAttention(result: AssignmentResult): boolean {
    return (result.capacity_full ?? 0) > 0 || (result.assigned ?? 0) === 0;
}
