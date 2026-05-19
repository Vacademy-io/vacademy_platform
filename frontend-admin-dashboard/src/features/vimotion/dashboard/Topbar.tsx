import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiCreditsQuery } from '@/services/ai-credits/get-ai-credits';
import { TAB_LABELS, TAB_DESCRIPTIONS, type DashboardTab } from './tabsConfig';
import { formatCredits } from './Sidebar';

interface TopbarProps {
    instituteId: string | undefined;
    activeTab: DashboardTab;
}

export function Topbar({ instituteId, activeTab }: TopbarProps) {
    const credits = useAiCreditsQuery(!!instituteId);
    const balance = credits.data ? Number(credits.data.current_balance) || 0 : null;
    const isLow = !!credits.data?.is_low_balance;

    return (
        <header className="flex h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 sm:px-6">
            <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-neutral-900">
                    {TAB_LABELS[activeTab]}
                </h1>
                <p className="hidden truncate text-xs text-neutral-500 sm:block">
                    {TAB_DESCRIPTIONS[activeTab]}
                </p>
            </div>

            {balance != null && (
                <div
                    className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:px-3',
                        isLow
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-neutral-200 bg-white text-neutral-700'
                    )}
                    title="AI credits"
                >
                    <Coins
                        className={cn('size-3.5', isLow ? 'text-red-600' : 'text-primary-500')}
                    />
                    {formatCredits(balance)}
                    <span className="hidden font-normal text-neutral-400 sm:inline">credits</span>
                </div>
            )}
        </header>
    );
}
