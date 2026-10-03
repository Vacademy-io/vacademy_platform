import { cn } from '@/lib/utils';

interface MembershipBadgeProps {
    /** TRIAL | PAID from the learner row. Null/absent when they have no plan. */
    membershipType?: 'TRIAL' | 'PAID' | null;
    /** False for institutes that run no trials, where every member would read "Paid". */
    available?: boolean;
    className?: string;
}

/**
 * Trial / Paid for an enrolled learner. Renders nothing when the learner has no
 * membership at all: an absent badge is the honest answer, not a defaulted one.
 */
export function MembershipBadge({ membershipType, available = false, className }: MembershipBadgeProps) {
    if (!available || !membershipType) return null;

    const isTrial = membershipType === 'TRIAL';
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                isTrial ? 'bg-yellow-100 text-yellow-800' : 'bg-success-100 text-success-600',
                className
            )}
        >
            {isTrial ? 'Trial' : 'Paid'}
        </span>
    );
}
