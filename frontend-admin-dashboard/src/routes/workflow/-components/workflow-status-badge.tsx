import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Lifecycle badge for a workflow. Both the list card and the detail header used to hard-code
 * green here, so a DRAFT (which never fires) looked identical to a live ACTIVE workflow.
 */
const STATUS_STYLES: Record<string, string> = {
    ACTIVE: 'bg-success-100 text-success-600 hover:bg-success-100',
    DRAFT: 'bg-warning-100 text-warning-600 hover:bg-warning-100',
    INACTIVE: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-100',
};

export function WorkflowStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const style = STATUS_STYLES[status?.toUpperCase()] ?? STATUS_STYLES.INACTIVE;
    return (
        <Badge variant="secondary" className={cn('shrink-0', style, className)}>
            {status}
        </Badge>
    );
}
