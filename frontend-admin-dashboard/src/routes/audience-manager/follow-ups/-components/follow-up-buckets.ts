import type { LeadCardVM } from '@/components/shared/leads';

/**
 * follow-up-buckets — client-side classifier that splits leads into
 * Pending (overdue) / Today / Upcoming buckets for the Follow-ups page.
 *
 * UI-only stand-in: when a server `is_pending_follow_up` filter + bucket counts
 * endpoint lands later, swap the page's call to `classify(...)` for a server
 * value. The page layout doesn't change because the bucket vocabulary is the
 * same.
 */

export type FollowUpBucket = 'overdue' | 'today' | 'upcoming' | 'all';

/**
 * Effective due time for a lead — prefer the next follow-up deadline; fall back
 * to the first-touch TAT deadline (no counsellor activity yet). Returns
 * `+Infinity` when both are missing so such rows sink to the bottom of any sort.
 */
export const effectiveDueMs = (vm: LeadCardVM): number => {
    const raw = vm.followUpDueAt ?? vm.tatDueAt;
    if (!raw) return Number.POSITIVE_INFINITY;
    // Backend serialises Timestamps as bare ISO strings without a TZ marker.
    // Treat them as UTC so a local user sees the right wall-clock.
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
    const normalized = hasTimezone ? raw : `${raw.replace(' ', 'T')}Z`;
    const t = Date.parse(normalized);
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/** True when the lead has any pending SLA — first-touch or follow-up. */
export const isPendingFollowUp = (vm: LeadCardVM): boolean => !!vm.tatDueAt || !!vm.followUpDueAt;

/** Classify a lead into a bucket based on its effective due time and the SLA flags. */
export const classify = (vm: LeadCardVM, now: Date = new Date()): FollowUpBucket => {
    if (vm.tatOverdue || vm.followUpOverdue) return 'overdue';
    const dueMs = effectiveDueMs(vm);
    if (!Number.isFinite(dueMs)) return 'upcoming';
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    if (dueMs < startOfToday.getTime()) return 'overdue';
    if (dueMs <= endOfToday.getTime()) return 'today';
    return 'upcoming';
};

/** Counts per bucket across an array of VMs (current page only). `all` = vms.length. */
export const bucketCounts = (
    vms: LeadCardVM[],
    now: Date = new Date()
): Record<FollowUpBucket, number> => {
    const counts: Record<FollowUpBucket, number> = {
        overdue: 0,
        today: 0,
        upcoming: 0,
        all: vms.length,
    };
    for (const vm of vms) {
        const b = classify(vm, now);
        if (b !== 'all') counts[b] += 1;
    }
    return counts;
};

/** Filter VMs to a specific bucket (or all). */
export const filterToBucket = (
    vms: LeadCardVM[],
    bucket: FollowUpBucket,
    now: Date = new Date()
): LeadCardVM[] => (bucket === 'all' ? vms : vms.filter((vm) => classify(vm, now) === bucket));
