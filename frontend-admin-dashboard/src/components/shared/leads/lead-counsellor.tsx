import { UserPlus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { LeadAvatar } from './lead-avatar';

/**
 * LeadCounsellor — the "Agent" cell shared by the list and the board card.
 * Shows the assigned counsellor (avatar + name) with a quiet "Reassign" link,
 * or a dashed "Assign" affordance when none is set.
 */

interface LeadCounsellorProps {
    counsellorName?: string | null;
    onAssign?: () => void;
    className?: string;
}

export function LeadCounsellor({ counsellorName, onAssign, className }: LeadCounsellorProps) {
    if (counsellorName) {
        return (
            <div className={cn('flex min-w-0 items-center gap-2', className)}>
                <LeadAvatar name={counsellorName} size="sm" />
                <span className="truncate text-sm text-neutral-800">{counsellorName}</span>
                {onAssign && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAssign();
                        }}
                        className="shrink-0 text-xs text-neutral-400 hover:text-primary-600"
                    >
                        Reassign
                    </button>
                )}
            </div>
        );
    }
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onAssign?.();
            }}
            className={cn(
                'inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-primary-300 hover:text-primary-600',
                className
            )}
        >
            <UserPlus className="size-3.5" />
            Assign
        </button>
    );
}
