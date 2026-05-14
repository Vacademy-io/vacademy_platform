import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CurrencyDollar,
    WarningCircle,
    ClipboardText,
    ArrowRight,
    type Icon,
} from '@phosphor-icons/react';
import { fetchPendingAdjustments, getPendingAdjustmentsQueryKey } from '@/services/manage-finances';

const formatINR = (n: number, compact = false): string => {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
            notation: compact ? 'compact' : 'standard',
        }).format(n);
    } catch {
        return `₹${Math.round(n).toLocaleString('en-IN')}`;
    }
};

interface Tile {
    label: string;
    Icon: Icon;
    iconBg: string;
    iconColor: string;
    valueNode: ReactNode;
}

export default function FinanceSummaryWidget() {
    const navigate = useNavigate();
    const { data, isLoading, isError } = useQuery({
        queryKey: getPendingAdjustmentsQueryKey(),
        queryFn: fetchPendingAdjustments,
        staleTime: 60_000,
        retry: false,
    });

    if (isError) return null;

    const rows = data || [];
    const overdue = rows.filter((r) => r.is_overdue || r.status === 'OVERDUE');
    const outstanding = overdue.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const pendingApprovals = rows.filter((r) => r.adjustment_status === 'PENDING_APPROVAL').length;

    const tiles: Tile[] = [
        {
            label: 'Outstanding',
            Icon: CurrencyDollar,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            valueNode: isLoading ? (
                <Skeleton className="h-5 w-16" />
            ) : (
                formatINR(outstanding, true)
            ),
        },
        {
            label: 'Overdue',
            Icon: WarningCircle,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            valueNode: isLoading ? <Skeleton className="h-5 w-8" /> : overdue.length,
        },
        {
            label: 'Approvals',
            Icon: ClipboardText,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            valueNode: isLoading ? <Skeleton className="h-5 w-8" /> : pendingApprovals,
        },
    ];

    const go = () => navigate({ to: '/financial-management/collection-dashboard' });

    return (
        <Card className="flex flex-col self-start bg-white shadow-sm">
            <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <CurrencyDollar size={14} weight="duotone" />
                        </span>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold">
                                Finance snapshot
                            </CardTitle>
                            <CardDescription className="line-clamp-1 text-[11px] text-neutral-500 sm:text-xs">
                                Money flow at a glance
                            </CardDescription>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={go}
                        className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700"
                    >
                        Open
                        <ArrowRight size={12} weight="bold" />
                    </button>
                </div>
            </CardHeader>
            <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                {tiles.map((t) => {
                    const TileIcon = t.Icon;
                    return (
                        <button
                            key={t.label}
                            type="button"
                            onClick={go}
                            className="group flex flex-col items-center justify-center gap-1.5 rounded-md border border-neutral-200 p-3 text-center transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                        >
                            <span
                                className={`flex size-8 items-center justify-center rounded-full ${t.iconBg} ${t.iconColor}`}
                            >
                                <TileIcon size={14} weight="bold" />
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                {t.label}
                            </span>
                            <span className="text-base font-semibold tabular-nums text-neutral-900">
                                {t.valueNode}
                            </span>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}
