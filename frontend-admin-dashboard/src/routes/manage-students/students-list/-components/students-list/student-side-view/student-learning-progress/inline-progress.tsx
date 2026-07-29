import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * Compact inline progress readout (thin bar + % label) for the side-view Progress
 * tab — used on both chapter rows and slide rows so a learner's percentage is
 * visible at every level, not just the subject/module. Kept small so it sits on a
 * single row next to a title.
 */
export const InlineProgress = ({
    percentage,
    className,
}: {
    percentage: number | null | undefined;
    className?: string;
}) => {
    const pct = Math.min(Math.max(Math.round(percentage ?? 0), 0), 100);
    return (
        <div className={cn('flex shrink-0 items-center gap-2', className)}>
            <Progress value={pct} className="h-2 w-20 !bg-neutral-200" />
            <span className="w-9 text-right text-caption font-medium text-neutral-600">{pct}%</span>
        </div>
    );
};
