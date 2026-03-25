import { useMemo } from 'react';
import { format } from 'date-fns';
import type { PolicyAction } from '@/types/membership-expiry';
import { Bell, CreditCard, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PolicyActionsTimelineProps {
    actions: PolicyAction[];
    className?: string;
    compact?: boolean;
}

const getActionIcon = (actionType: string) => {
    switch (actionType) {
        case 'NOTIFICATION':
            return <Bell className="size-3" />;
        case 'PAYMENT_ATTEMPT':
            return <CreditCard className="size-3" />;
        case 'FINAL_EXPIRY':
            return <XCircle className="size-3" />;
        default:
            return <Bell className="size-3" />;
    }
};

const getActionColor = (actionType: string) => {
    switch (actionType) {
        case 'NOTIFICATION':
            return {
                bg: 'bg-blue-100',
                text: 'text-blue-700',
                line: 'bg-blue-200',
                dot: 'bg-blue-500',
            };
        case 'PAYMENT_ATTEMPT':
            return {
                bg: 'bg-amber-100',
                text: 'text-amber-700',
                line: 'bg-amber-200',
                dot: 'bg-amber-500',
            };
        case 'FINAL_EXPIRY':
            return {
                bg: 'bg-red-100',
                text: 'text-red-700',
                line: 'bg-red-200',
                dot: 'bg-red-500',
            };
        default:
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
                line: 'bg-gray-200',
                dot: 'bg-gray-500',
            };
    }
};

const formatDaysLabel = (days: number): string => {
    if (days === 0) return 'On expiry';
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} before`;
    return `${days} day${days > 1 ? 's' : ''} after`;
};

export function PolicyActionsTimeline({ actions, className, compact = false }: PolicyActionsTimelineProps) {
    // Sort actions by days_past_or_before_expiry
    const sortedActions = useMemo(() => {
        return [...actions].sort((a, b) => a.days_past_or_before_expiry - b.days_past_or_before_expiry);
    }, [actions]);

    if (!sortedActions.length) {
        return null;
    }

    return (
        <div className={cn('relative', className)}>
            {sortedActions.map((action, index) => {
                const colors = getActionColor(action.action_type);
                const isLast = index === sortedActions.length - 1;

                return (
                    <div key={index} className="relative flex items-start gap-3">
                        {/* Timeline line */}
                        {!isLast && (
                            <div
                                className={cn(
                                    'absolute left-[9px] top-5 h-full w-0.5',
                                    colors.line
                                )}
                            />
                        )}

                        {/* Timeline dot */}
                        <div
                            className={cn(
                                'relative z-10 mt-0.5 size-[18px] rounded-full flex items-center justify-center shrink-0',
                                colors.bg
                            )}
                        >
                            <span className={colors.text}>{getActionIcon(action.action_type)}</span>
                        </div>

                        {/* Content */}
                        <div className={cn('pb-4 min-w-0 flex-1', compact ? 'pb-2' : 'pb-4')}>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className={cn(
                                        'text-xs font-medium px-1.5 py-0.5 rounded',
                                        colors.bg,
                                        colors.text
                                    )}
                                >
                                    {action.action_type.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {formatDaysLabel(action.days_past_or_before_expiry)}
                                </span>
                            </div>

                            {action.scheduled_date && !compact && (
                                <div className="mt-1 text-xs text-gray-600">
                                    {format(new Date(action.scheduled_date), 'MMM dd, yyyy')}
                                </div>
                            )}

                            {action.description && !compact && (
                                <div className="mt-0.5 text-xs text-gray-500">
                                    {action.description}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default PolicyActionsTimeline;
