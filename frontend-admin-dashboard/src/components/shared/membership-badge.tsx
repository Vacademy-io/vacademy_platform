import { cn } from '@/lib/utils';

interface MembershipBadgeProps {
    /** TRIAL | PAID from the contact row. Null/absent for a lead with no plan. */
    membershipType?: 'TRIAL' | 'PAID' | null;
    /**
     * False for institutes that run no trials, where the distinction is meaningless and
     * every member would read "Paid". Gated the same way the lead columns gate on
     * useLeadSettings().
     */
    available?: boolean;
    className?: string;
}

/**
 * Trial / Paid for an enrolled contact.
 *
 * <p>Renders nothing when the contact has no membership at all — a lead is not a "Paid"
 * member and is not a trial either, so an absent badge is the honest answer rather than a
 * default one.
 */
export function MembershipBadge({ membershipType, available = false, className }: MembershipBadgeProps) {
    if (!available || !membershipType) return null;

    const isTrial = membershipType === 'TRIAL';
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                isTrial
                    ? 'bg-secondary-100 text-secondary-500'
                    : 'bg-success-100 text-success-600',
                className
            )}
        >
            {isTrial ? 'Trial' : 'Paid'}
        </span>
    );
}
