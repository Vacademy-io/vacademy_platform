import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Slim stat strip — a compact summary bar that doubles as a filter. Each tab
 * shows a label + count on a single line; the active one is accented. Kept
 * deliberately low-profile so it sits quietly above the platform table.
 */

export type StatAccent = 'primary' | 'red' | 'amber' | 'blue' | 'emerald' | 'neutral';

export interface LeadStatTab {
    key: string;
    label: string;
    count?: number;
    accent?: StatAccent;
}

const DOT: Record<StatAccent, string> = {
    primary: 'bg-primary-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    neutral: 'bg-neutral-400',
};

const ACTIVE_BAR: Record<StatAccent, string> = {
    primary: 'bg-primary-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    neutral: 'bg-neutral-500',
};

interface LeadStatTabsProps {
    tabs: LeadStatTab[];
    activeKey: string;
    onSelect: (key: string) => void;
    isLoading?: boolean;
    className?: string;
}

export function LeadStatTabs({
    tabs,
    activeKey,
    onSelect,
    isLoading,
    className,
}: LeadStatTabsProps) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-white',
                className
            )}
        >
            {tabs.map((tab) => {
                const accent = tab.accent ?? 'neutral';
                const active = tab.key === activeKey;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onSelect(tab.key)}
                        className={cn(
                            'relative flex flex-1 items-center gap-2 border-r border-neutral-100 px-3.5 py-2 text-left transition-colors last:border-r-0',
                            active ? 'bg-primary-50/40' : 'hover:bg-neutral-50'
                        )}
                    >
                        <span
                            className={cn(
                                'flex items-center gap-1.5 truncate text-xs font-medium',
                                active ? 'text-neutral-800' : 'text-neutral-500'
                            )}
                        >
                            <span className={cn('size-1.5 shrink-0 rounded-full', DOT[accent])} />
                            <span className="truncate">{tab.label}</span>
                        </span>
                        {isLoading && tab.count === undefined ? (
                            <Skeleton className="h-4 w-6" />
                        ) : (
                            <span
                                className={cn(
                                    'shrink-0 text-sm font-semibold tabular-nums',
                                    active ? 'text-neutral-900' : 'text-neutral-700'
                                )}
                            >
                                {tab.count ?? 0}
                            </span>
                        )}
                        {active && (
                            <span
                                className={cn(
                                    'absolute inset-x-0 bottom-0 h-0.5',
                                    ACTIVE_BAR[accent]
                                )}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
