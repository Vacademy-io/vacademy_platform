import EmptyInvitePage from '@/assets/svgs/empty-invite-page.svg';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';

/**
 * LeadEmptyState — shared empty / no-results state for the leads views.
 * Replaces the ad-hoc text blocks the two pages used to inline.
 */

interface LeadEmptyStateProps {
    title?: string;
    description?: string;
    /** When provided, renders a "Clear filters" affordance. */
    onClear?: () => void;
    className?: string;
}

export function LeadEmptyState({
    title = 'No leads found',
    description = 'Try adjusting the filters or clearing them to see more results.',
    onClear,
    className,
}: LeadEmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center',
                className
            )}
        >
            <EmptyInvitePage className="h-28 w-auto opacity-90" />
            <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-700">{title}</p>
                <p className="text-xs text-neutral-500">{description}</p>
            </div>
            {onClear && (
                <MyButton buttonType="secondary" scale="small" onClick={onClear}>
                    Clear filters
                </MyButton>
            )}
        </div>
    );
}
