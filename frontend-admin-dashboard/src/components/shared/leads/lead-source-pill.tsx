import { cn } from '@/lib/utils';

/**
 * LeadSourcePill — the neutral gray pill used for a lead's source/audience
 * (mirrors the "Lead source" column in the reference CRM).
 */
export function LeadSourcePill({
    label,
    className,
}: {
    label?: string | null;
    className?: string;
}) {
    if (!label || label === '-') return <span className="text-sm text-neutral-400">—</span>;
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center truncate rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600',
                className
            )}
            title={label}
        >
            {label}
        </span>
    );
}
