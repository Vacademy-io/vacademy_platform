import { useQuery } from '@tanstack/react-query';
import { getWaitlistCount } from '../api/waitlist';

interface LiveCounterProps {
    seed?: number;
    label?: string;
}

export function LiveCounter({ seed, label = 'creators on the waitlist' }: LiveCounterProps) {
    const { data } = useQuery({
        queryKey: ['vimotion', 'waitlist', 'count'],
        queryFn: getWaitlistCount,
        refetchInterval: 30_000,
        // Use the seed from the join response as the initial number so the
        // user never sees a momentary "0" before the first poll lands.
        initialData: seed !== undefined ? { total: seed } : undefined,
    });

    const total = data?.total ?? 0;
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs text-neutral-700 shadow-sm backdrop-blur">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            <span>
                <span className="font-semibold text-neutral-900">{total.toLocaleString()}</span>{' '}
                {label}
            </span>
        </div>
    );
}
