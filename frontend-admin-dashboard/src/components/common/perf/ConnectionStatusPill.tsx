import { useEffect, useState } from 'react';
import { CloudSlash, WifiSlash } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_URL } from '@/constants/urls';
import {
    getSnapshot,
    startPingLoop,
    subscribe,
    type PerfSnapshot,
} from '@/lib/perf/network-health';
import { cn } from '@/lib/utils';

/**
 * Tells the user which side is slow, and stays out of the way otherwise.
 *
 * Deliberately renders NOTHING while things are healthy — or while there isn't
 * enough data to be sure. A permanently visible "status: good" badge trains people
 * to stop reading it, and a badge that guesses wrong is worse than no badge,
 * because "your internet is slow" blames the user for what might be our outage.
 */

/**
 * Whether institute admins see server-side degradation, or only the
 * connection-side warning.
 *
 * `true` (current): honest both ways — the user is told when it is us. Costs us
 * visibly advertising our bad moments to clients.
 * `false`: users only ever see "your connection is slow"; our own slowness stays
 * internal to the health portal.
 *
 * This is a product call, not a technical one. Flipping this constant is the whole
 * change — everything below already handles both.
 */
const SHOW_SERVER_SIDE_TO_USERS = true;

export function ConnectionStatusPill({ className }: { className?: string }) {
    const [snapshot, setSnapshot] = useState<PerfSnapshot>(() => getSnapshot());

    useEffect(() => {
        const unsubscribe = subscribe(() => setSnapshot(getSnapshot()));
        const stopPinging = startPingLoop(BASE_URL);
        return () => {
            unsubscribe();
            stopPinging();
        };
    }, []);

    const { verdict, serverMs, networkMs } = snapshot;

    if (verdict === 'unknown' || verdict === 'healthy') return null;
    if (verdict === 'server-slow' && !SHOW_SERVER_SIDE_TO_USERS) return null;

    const isServer = verdict === 'server-slow';
    const Icon = isServer ? CloudSlash : WifiSlash;

    const label = isServer ? 'Vacademy is slow' : 'Your connection is slow';
    const detail = isServer
        ? `Our servers are taking about ${Math.round(serverMs ?? 0)}ms to respond right now. This is on our side — you don't need to do anything.`
        : `Your network is taking about ${Math.round(networkMs ?? 0)}ms to reach us. Our servers are responding normally, so this looks like the connection rather than Vacademy.`;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        role="status"
                        className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                            isServer
                                ? 'bg-warning-50 text-warning-700'
                                : 'bg-neutral-100 text-neutral-700',
                            className
                        )}
                    >
                        <Icon className="size-3.5" weight="bold" />
                        <span className="hidden whitespace-nowrap sm:inline">{label}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                    {detail}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default ConnectionStatusPill;
