import { cn } from '@/lib/utils';

/**
 * Visual-only SLA indicator for a lead. Reflects the TAT / follow-up reminder stage the backend
 * scheduler has reached for the lead (no notification logic lives here). Renders nothing when the
 * lead has no active SLA flag.
 */
interface TatStatusBadgeProps {
    tatOverdue?: boolean | null;
    tatDueSoon?: boolean | null;
    followUpOverdue?: boolean | null;
    size?: 'sm' | 'md';
    className?: string;
}

export function TatStatusBadge({
    tatOverdue,
    tatDueSoon,
    followUpOverdue,
    size = 'sm',
    className,
}: TatStatusBadgeProps) {
    let label: string | null = null;
    let style = '';

    if (tatOverdue) {
        label = 'TAT overdue';
        style = 'bg-red-100 text-red-700';
    } else if (followUpOverdue) {
        label = 'Follow-up overdue';
        style = 'bg-orange-100 text-orange-700';
    } else if (tatDueSoon) {
        label = 'Due soon';
        style = 'bg-amber-100 text-amber-700';
    }

    if (!label) return null;

    const isSmall = size === 'sm';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full font-medium',
                style,
                isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                className
            )}
        >
            {label}
        </span>
    );
}
