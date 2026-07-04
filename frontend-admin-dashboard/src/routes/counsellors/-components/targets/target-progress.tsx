import { cn } from '@/lib/utils';
import {
    TARGET_METRIC_LABEL,
    type TargetProgressItem,
} from '../../-services/counsellor-target-services';

/** Attainment → token classes (bar fill + text). >=100 hit, tiers below. */
function attainmentTone(pct: number | null): { bar: string; text: string } {
    if (pct == null) return { bar: 'bg-neutral-300', text: 'text-neutral-500' };
    if (pct >= 100) return { bar: 'bg-success-500', text: 'text-success-700' };
    if (pct >= 60) return { bar: 'bg-primary-500', text: 'text-primary-700' };
    if (pct >= 30) return { bar: 'bg-warning-500', text: 'text-warning-700' };
    return { bar: 'bg-danger-500', text: 'text-danger-600' };
}

/** Short metric label for tight spots. */
const SHORT: Record<string, string> = {
    CONVERSIONS: 'Conv',
    LEADS_ASSIGNED: 'Leads',
    CALLS_MADE: 'Calls',
};

function TargetBar({ item, compact }: { item: TargetProgressItem; compact?: boolean }) {
    const pct = item.attainment_pct;
    const tone = attainmentTone(pct);
    const width = pct == null ? 0 : Math.min(100, Math.max(0, pct));
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-caption">
                <span className="text-neutral-600">
                    {(compact ? SHORT[item.metric] : TARGET_METRIC_LABEL[item.metric]) ??
                        item.metric}
                </span>
                <span className={cn('font-medium tabular-nums', tone.text)}>
                    {item.completed}
                    <span className="text-neutral-400">/{item.target_value}</span>
                    {pct != null && <span className="ml-1 text-neutral-400">· {Math.round(pct)}%</span>}
                </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                {/* Width is data-driven; colour comes from a token class. */}
                <div
                    className={cn('h-full rounded-full', tone.bar)}
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    );
}

/**
 * Compact target-vs-completed for one counsellor in the selected window. Shows
 * one bar per metric that has a target set; renders a muted hint when none are.
 */
export function TargetProgress({
    items,
    compact,
    loading,
}: {
    items: TargetProgressItem[] | undefined;
    compact?: boolean;
    loading?: boolean;
}) {
    if (loading) {
        return <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral-100" />;
    }
    const withTarget = (items ?? []).filter((i) => i.target_value != null);
    if (withTarget.length === 0) {
        return <span className="text-caption text-neutral-400">No target set</span>;
    }
    return (
        <div className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
            {withTarget.map((item) => (
                <TargetBar key={item.metric} item={item} compact={compact} />
            ))}
        </div>
    );
}
