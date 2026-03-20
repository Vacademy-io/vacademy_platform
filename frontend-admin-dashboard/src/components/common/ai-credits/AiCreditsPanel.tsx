import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
    useAiCreditsQuery,
    useAiTransactionsQuery,
    useAiUsageAnalyticsQuery,
    useAiUsageForecastQuery,
} from '@/services/ai-credits/get-ai-credits';
import type {
    CreditTransaction,
    UsageByRequestType,
    TopModel,
} from '@/services/ai-credits/get-ai-credits';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    Lightning,
    ArrowDown,
    ArrowUp,
    Clock,
    ChartBar,
    CurrencyCircleDollar,
    CalendarBlank,
    Warning,
    CaretDown,
    Sparkle,
    TrendUp,
    Receipt,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type TabId = 'overview' | 'transactions' | 'analytics';

// ─── Badge (Trigger) ───────────────────────────────
interface AiCreditsBadgeProps {
    currentBalance: string;
    isLowBalance: boolean;
    className?: string;
}

function AiCreditsBadge({ currentBalance, isLowBalance, className }: AiCreditsBadgeProps) {
    const balance = parseFloat(currentBalance || '0');
    return (
        <div
            className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all hover:shadow-md',
                isLowBalance
                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 hover:from-purple-100 hover:to-indigo-100',
                className
            )}
        >
            <Sparkle className="size-3.5" weight="fill" />
            <span className="hidden sm:inline">AI Credits:</span>
            <span className="font-bold">{balance.toFixed(1)}</span>
            {isLowBalance && <Warning className="size-3 text-amber-600" weight="fill" />}
            <CaretDown className="size-3 opacity-60" />
        </div>
    );
}

// ─── Transaction Type Config ─────────────────────────
const txTypeConfig: Record<
    string,
    { label: string; color: string; bgColor: string; icon: typeof ArrowDown }
> = {
    USAGE_DEDUCTION: {
        label: 'Usage',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: ArrowDown,
    },
    INITIAL_GRANT: {
        label: 'Grant',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        icon: ArrowUp,
    },
    ADMIN_GRANT: {
        label: 'Admin Grant',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: ArrowUp,
    },
    REFUND: {
        label: 'Refund',
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        icon: ArrowUp,
    },
};

// ─── Overview Tab ──────────────────────────────────
function OverviewTab() {
    const { data: credits, isLoading: isCreditsLoading } = useAiCreditsQuery(true);
    const { data: forecast, isLoading: isForecastLoading } = useAiUsageForecastQuery(true);
    const { data: analytics, isLoading: isAnalyticsLoading } = useAiUsageAnalyticsQuery(7, true);

    const totalCredits = parseFloat(credits?.total_credits || '0');
    const usedCredits = parseFloat(credits?.used_credits || '0');
    const currentBalance = parseFloat(credits?.current_balance || '0');
    const usagePercent = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;

    const getBarColor = () => {
        if (usagePercent > 80) return 'bg-red-500';
        if (usagePercent > 60) return 'bg-amber-500';
        return 'bg-gradient-to-r from-purple-500 to-indigo-500';
    };

    if (isCreditsLoading) {
        return (
            <div className="space-y-4 p-1">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Credit Balance Card */}
            <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/80 via-indigo-50/50 to-white p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-500">Total Balance</span>
                    <span className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-purple-600 shadow-sm">
                        <CurrencyCircleDollar className="size-3" weight="fill" />
                        Credits
                    </span>
                </div>
                <div className="mb-3 flex items-end gap-2">
                    <span className="text-2xl font-bold text-neutral-900">
                        {currentBalance.toFixed(2)}
                    </span>
                    <span className="mb-0.5 text-xs text-neutral-400">
                        / {totalCredits.toFixed(0)}
                    </span>
                </div>
                {/* Progress bar */}
                <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                        className={cn(
                            'h-full rounded-full transition-all duration-500',
                            getBarColor()
                        )}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-400">
                    <span>{usedCredits.toFixed(1)} used</span>
                    <span>{usagePercent.toFixed(0)}% consumed</span>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
                {/* Forecast */}
                <div className="rounded-xl border bg-white p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                        <div className="rounded-md bg-blue-50 p-1">
                            <CalendarBlank className="size-3 text-blue-500" weight="fill" />
                        </div>
                        <span className="text-[10px] font-medium text-neutral-500">Days Left</span>
                    </div>
                    {isForecastLoading ? (
                        <Skeleton className="h-6 w-12" />
                    ) : (
                        <div className="text-lg font-bold text-neutral-800">
                            {forecast?.estimated_days_remaining ?? '—'}
                        </div>
                    )}
                </div>

                {/* Avg daily */}
                <div className="rounded-xl border bg-white p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                        <div className="rounded-md bg-amber-50 p-1">
                            <TrendUp className="size-3 text-amber-500" weight="fill" />
                        </div>
                        <span className="text-[10px] font-medium text-neutral-500">Daily Avg</span>
                    </div>
                    {isForecastLoading ? (
                        <Skeleton className="h-6 w-12" />
                    ) : (
                        <div className="text-lg font-bold text-neutral-800">
                            {forecast?.average_daily_usage != null
                                ? Number(forecast.average_daily_usage).toFixed(2)
                                : '—'}
                        </div>
                    )}
                </div>

                {/* Total requests (7d) */}
                <div className="rounded-xl border bg-white p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                        <div className="rounded-md bg-emerald-50 p-1">
                            <Lightning className="size-3 text-emerald-500" weight="fill" />
                        </div>
                        <span className="text-[10px] font-medium text-neutral-500">
                            Requests (7d)
                        </span>
                    </div>
                    {isAnalyticsLoading ? (
                        <Skeleton className="h-6 w-12" />
                    ) : (
                        <div className="text-lg font-bold text-neutral-800">
                            {analytics?.total_requests ?? '—'}
                        </div>
                    )}
                </div>

                {/* Credits used (7d) */}
                <div className="rounded-xl border bg-white p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                        <div className="rounded-md bg-purple-50 p-1">
                            <ChartBar className="size-3 text-purple-500" weight="fill" />
                        </div>
                        <span className="text-[10px] font-medium text-neutral-500">Used (7d)</span>
                    </div>
                    {isAnalyticsLoading ? (
                        <Skeleton className="h-6 w-12" />
                    ) : (
                        <div className="text-lg font-bold text-neutral-800">
                            {analytics?.total_credits_used != null
                                ? Number(analytics.total_credits_used).toFixed(1)
                                : '—'}
                        </div>
                    )}
                </div>
            </div>

            {/* Forecast recommendation */}
            {forecast?.recommendation && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                    <p className="text-[11px] leading-relaxed text-blue-700">
                        💡 {forecast.recommendation}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Transactions Tab ──────────────────────────────
function TransactionsTab() {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useAiTransactionsQuery(page, 8, undefined, true);

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    const transactions = data?.transactions || [];

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-neutral-400">
                <Receipt className="mb-2 size-8 text-neutral-300" />
                No transactions yet
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {transactions.map((tx: CreditTransaction) => {
                const cfg = txTypeConfig[tx.transaction_type] ?? {
                    label: 'Transaction',
                    color: 'text-neutral-600',
                    bgColor: 'bg-neutral-50',
                    icon: ArrowDown,
                };
                const Icon = cfg.icon;
                const isPositive = tx.amount > 0;
                return (
                    <div
                        key={tx.id}
                        className="flex items-center gap-2.5 rounded-lg border bg-white px-2.5 py-2 transition-colors hover:bg-neutral-50"
                    >
                        <div className={cn('rounded-lg p-1.5', cfg.bgColor)}>
                            <Icon className={cn('size-3', cfg.color)} weight="bold" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-medium text-neutral-800">
                                    {tx.description || cfg.label}
                                </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-400">
                                {tx.model_name && (
                                    <span className="truncate rounded bg-neutral-100 px-1 py-0.5 font-mono text-[9px]">
                                        {tx.model_name.split('/').pop()}
                                    </span>
                                )}
                                <span>
                                    {new Date(tx.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span
                                className={cn(
                                    'text-xs font-bold',
                                    isPositive ? 'text-emerald-600' : 'text-red-500'
                                )}
                            >
                                {isPositive ? '+' : ''}
                                {Number(tx.amount).toFixed(2)}
                            </span>
                            <div className="text-[10px] text-neutral-400">
                                Bal: {Number(tx.balance_after).toFixed(1)}
                            </div>
                        </div>
                    </div>
                );
            })}
            {/* Pagination */}
            {data && data.total_pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-md border px-2.5 py-1 text-[10px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <span className="text-[10px] text-neutral-500">
                        {page} / {data.total_pages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                        disabled={page >= data.total_pages}
                        className="rounded-md border px-2.5 py-1 text-[10px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Analytics Tab ─────────────────────────────────
function AnalyticsTab() {
    const [days, setDays] = useState(30);
    const { data: analytics, isLoading } = useAiUsageAnalyticsQuery(days, true);

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-neutral-400">
                <ChartBar className="mb-2 size-8 text-neutral-300" />
                No analytics data available
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Period selector */}
            <div className="flex items-center gap-1.5">
                {[7, 14, 30].map((d) => (
                    <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={cn(
                            'rounded-full px-2.5 py-1 text-[10px] font-medium transition-all',
                            days === d
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        )}
                    >
                        {d}d
                    </button>
                ))}
            </div>

            {/* Usage by type */}
            {analytics.by_request_type && analytics.by_request_type.length > 0 && (
                <div className="rounded-xl border bg-white p-3">
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Usage by Type
                    </h4>
                    <div className="space-y-2">
                        {analytics.by_request_type.map((item: UsageByRequestType) => (
                            <div key={item.request_type}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium capitalize text-neutral-700">
                                        {item.request_type}
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                        {Number(item.total_credits).toFixed(1)} credits
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 transition-all duration-500"
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                                <div className="mt-0.5 flex justify-between text-[10px] text-neutral-400">
                                    <span>{item.total_requests} requests</span>
                                    <span>{Number(item.percentage).toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top models */}
            {analytics.top_models && analytics.top_models.length > 0 && (
                <div className="rounded-xl border bg-white p-3">
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Top Models
                    </h4>
                    <div className="space-y-1.5">
                        {analytics.top_models.slice(0, 5).map((model: TopModel, i: number) => (
                            <div
                                key={model.model}
                                className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2 py-1.5"
                            >
                                <span className="flex size-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-600">
                                    {i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <span className="block truncate text-[11px] font-medium text-neutral-700">
                                        {model.model.split('/').pop()}
                                    </span>
                                </div>
                                <div className="text-right text-[10px] text-neutral-500">
                                    <span className="font-semibold text-neutral-700">
                                        {Number(model.credits).toFixed(1)}
                                    </span>{' '}
                                    · {model.requests}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Daily usage mini chart */}
            {analytics.by_day && analytics.by_day.length > 0 && (
                <div className="rounded-xl border bg-white p-3">
                    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                        Daily Usage
                    </h4>
                    <DailyUsageChart data={analytics.by_day} />
                </div>
            )}
        </div>
    );
}

// ─── Mini Bar Chart ────────────────────────────────
function DailyUsageChart({ data }: { data: { date: string; total_credits: number }[] }) {
    const maxCredits = useMemo(
        () => Math.max(...data.map((d) => Number(d.total_credits)), 0.1),
        [data]
    );
    const last7 = data.slice(-7);

    return (
        <div className="flex items-end gap-1" style={{ height: 48 }}>
            {last7.map((day) => {
                const h = Math.max((Number(day.total_credits) / maxCredits) * 100, 4);
                return (
                    <div
                        key={day.date}
                        className="group relative flex flex-1 flex-col items-center"
                    >
                        <div
                            className="w-full rounded-t bg-gradient-to-t from-purple-400 to-indigo-300 transition-all group-hover:from-purple-500 group-hover:to-indigo-400"
                            style={{ height: `${h}%` }}
                        />
                        <span className="mt-1 text-[8px] text-neutral-400">
                            {new Date(day.date).toLocaleDateString('en-US', {
                                weekday: 'narrow',
                            })}
                        </span>
                        {/* Tooltip */}
                        <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] text-white shadow-lg transition-transform group-hover:scale-100">
                            {Number(day.total_credits).toFixed(2)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Tab buttons ───────────────────────────────────
const tabs: { id: TabId; label: string; icon: typeof ChartBar }[] = [
    { id: 'overview', label: 'Overview', icon: ChartBar },
    { id: 'transactions', label: 'History', icon: Clock },
    { id: 'analytics', label: 'Analytics', icon: Lightning },
];

// ─── Main Component ────────────────────────────────
interface AiCreditsPanelProps {
    className?: string;
}

export function AiCreditsPanel({ className }: AiCreditsPanelProps) {
    const { data: credits, isError } = useAiCreditsQuery(true);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [isOpen, setIsOpen] = useState(false);

    if (!credits || isError) return null;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button className={cn('cursor-pointer outline-none', className)}>
                    <AiCreditsBadge
                        currentBalance={credits.current_balance}
                        isLowBalance={credits.is_low_balance}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[340px] rounded-2xl border border-neutral-200 bg-neutral-50 p-0 shadow-xl sm:w-[380px]"
            >
                {/* Header */}
                <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-white/20 p-1.5">
                            <Sparkle className="size-4 text-white" weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">AI Credits</h3>
                            <p className="text-[10px] text-purple-200">Usage & Analytics</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-bold text-white">
                            {parseFloat(credits.current_balance || '0').toFixed(1)}
                        </div>
                        <div className="text-[10px] text-purple-200">remaining</div>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex gap-0.5 border-b bg-white px-2 pt-1.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-1 rounded-t-lg px-3 py-1.5 text-[11px] font-medium transition-all',
                                    activeTab === tab.id
                                        ? 'border-b-2 border-purple-600 bg-purple-50 text-purple-700'
                                        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                                )}
                            >
                                <Icon
                                    className="size-3"
                                    weight={activeTab === tab.id ? 'fill' : 'regular'}
                                />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="max-h-[400px] overflow-y-auto">
                    <div className="p-3">
                        {activeTab === 'overview' && <OverviewTab />}
                        {activeTab === 'transactions' && <TransactionsTab />}
                        {activeTab === 'analytics' && <AnalyticsTab />}
                    </div>
                </div>

                {/* Footer */}
                <Separator />
                <div className="flex items-center justify-between rounded-b-2xl bg-white px-4 py-2">
                    <Link
                        to="/explore-ai"
                        className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-1.5 text-[11px] font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                    >
                        <Sparkle className="size-3" weight="fill" />
                        Explore AI Tools
                    </Link>

                    {credits.is_low_balance ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                            <Warning className="size-3" weight="fill" />
                            Low Balance
                        </span>
                    ) : (
                        <span className="text-[10px] text-neutral-400">
                            Updated{' '}
                            {credits.updated_at
                                ? new Date(credits.updated_at).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : 'recently'}
                        </span>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
