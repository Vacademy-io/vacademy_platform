import { cn } from '@/lib/utils';
import type { CustomLeadStatus } from '@/hooks/use-lead-settings';

/**
 * Renders a lead's custom pipeline status (e.g. New / Interested / Converted) as a colored chip.
 * The colour is resolved from the institute's configured statuses (matched case-insensitively on key
 * or label). Falls back to a neutral chip when the value doesn't match any configured status, and
 * renders nothing when there's no status.
 */
interface LeadStatusChipProps {
    status?: string | null;
    statuses: CustomLeadStatus[];
    size?: 'sm' | 'md';
    /** Hide the leading colour dot (cleaner pill for dense tables). */
    hideDot?: boolean;
    className?: string;
}

const normalize = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '_');

export function LeadStatusChip({
    status,
    statuses,
    size = 'sm',
    hideDot = false,
    className,
}: LeadStatusChipProps) {
    if (!status || !status.trim()) return null;

    const norm = normalize(status);
    const match = statuses.find(
        (s) => normalize(s.key || '') === norm || normalize(s.label || '') === norm
    );
    const label = match?.label ?? status;
    const color = match?.color;
    const isSmall = size === 'sm';

    // No configured colour → neutral chip using design tokens.
    if (!color) {
        return (
            <span
                className={cn(
                    'inline-flex items-center whitespace-nowrap rounded-full bg-neutral-100 font-medium text-neutral-600',
                    isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                    className
                )}
            >
                {label}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
                isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
                className
            )}
            // Inline style: status colour is arbitrary user-picked hex with no design-token equivalent.
            style={{ backgroundColor: `${color}14`, color, borderColor: `${color}40` }}
        >
            {!hideDot && (
                <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            )}
            {label}
        </span>
    );
}
