import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CurrencyInr, ArrowsClockwise, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchExotelBalance, type ExotelBalance } from '../-services/telephony-admin';

/**
 * Reads the institute's Exotel wallet balance + currency and renders it
 * inline at the top of the Calling settings page. Lets the admin notice a
 * "you're about to run out of credit" situation before it bites a live call.
 *
 * Cached for 60s in the query client so navigating tabs doesn't hammer the
 * Exotel API; explicit Refresh button forces a refetch.
 */
export function TelephonyCreditsCard() {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const query = useQuery<ExotelBalance>({
        queryKey: ['telephony-exotel-balance', instituteId],
        queryFn: () => fetchExotelBalance(instituteId),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });

    const onRefresh = () =>
        queryClient.invalidateQueries({
            queryKey: ['telephony-exotel-balance', instituteId],
        });

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                        <CurrencyInr className="size-5" weight="bold" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                            Exotel credits
                        </p>
                        <BalanceLine query={query} />
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onRefresh}
                    disabled={query.isFetching}
                    title="Refresh balance from Exotel"
                >
                    <ArrowsClockwise
                        className={cn('size-4', query.isFetching && 'animate-spin')}
                    />
                    <span className="ml-1.5">Refresh</span>
                </Button>
            </div>
            {query.data?.dateUpdated && (
                <p className="mt-2 text-caption text-neutral-400">
                    Last updated by Exotel: {query.data.dateUpdated}
                    {query.data.pricingPlan ? ` · Plan: ${query.data.pricingPlan}` : ''}
                </p>
            )}
        </div>
    );
}

function BalanceLine({
    query,
}: {
    query: {
        isLoading: boolean;
        isError: boolean;
        data: ExotelBalance | undefined;
        error: unknown;
    };
}) {
    if (query.isLoading) {
        return <Skeleton className="mt-1 h-6 w-32" />;
    }
    if (query.isError) {
        return (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-warning-700">
                <WarningCircle weight="fill" className="size-4" />
                Could not fetch — check API credentials.
            </p>
        );
    }
    const balance = query.data?.balance;
    const currency = query.data?.currency ?? '';
    if (!balance) {
        return (
            <p className="mt-0.5 text-sm text-neutral-500">
                Balance unavailable. Make sure the provider config is saved with valid
                API credentials.
            </p>
        );
    }
    const formatted = formatCurrency(balance, currency);
    return (
        <p className="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">
            {formatted}
        </p>
    );
}

function formatCurrency(amount: string | number, currency: string): string {
    // Default to ₹ when the response didn't carry a currency — Exotel's
    // simplified Balance response ({"Balance": {"Amount": 618.3}}) doesn't
    // include one and our institute base is India regardless. Falls through
    // to any non-INR string if the response does carry one.
    const symbol = !currency || currency === 'INR' ? '₹' : `${currency} `;
    // Coerce defensively — Exotel's docs say Balance is a string, but in
    // practice some account tiers return it as a JSON number. String() handles
    // both transparently. Without this we crashed with "amount.replace is not
    // a function" on the first refresh.
    const str = String(amount);
    // Strip trailing zeros that aren't meaningful (e.g. "1543.7500" → "1543.75")
    // while keeping the dot if there's a fractional part.
    const trimmed = str.replace(/\.?0+$/, (m) =>
        m.startsWith('.') && m.length > 1 ? '' : m
    );
    return `${symbol}${trimmed}`;
}
