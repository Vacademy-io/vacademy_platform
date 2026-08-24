import { useEffect, useState } from 'react';
import { CloudSlash, Gauge, WifiSlash, type Icon } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_URL } from '@/constants/urls';
import {
    getSnapshot,
    NETWORK_SLOW_MS,
    SERVER_SLOW_MS,
    startPingLoop,
    subscribe,
    type PerfSnapshot,
} from '@/lib/perf/network-health';
import { startRumReporting } from '@/lib/perf/rum-reporter';
import { cn } from '@/lib/utils';

/**
 * Rail item that says which side is slow — ours or the user's connection.
 *
 * Always visible, sitting above Status, so "is it fast right now?" has a permanent
 * answer rather than one that only appears once something is wrong.
 *
 * That makes the wording matter more, not less. It shows "Checking" until there is
 * enough data to be honest — never a reassuring "Good" inferred from three samples —
 * and when both sides look bad it blames US, because telling a user their internet is
 * slow during our own outage is the failure that sends support down the wrong path.
 *
 * This component also hosts the measurement loops (ping baseline + sampled RUM
 * reporting) because it is mounted on every admin page.
 */

/**
 * Whether institute admins see server-side degradation, or only the connection-side
 * warning.
 *
 * `true` (current): honest both ways — the user is told when it is us, at the cost of
 * visibly advertising our bad moments.
 * `false`: our slowness reads as a neutral "Checking" and stays internal to the health
 * portal; users are still told when their own connection is the problem.
 *
 * A product call, not a technical one. Flipping this constant is the whole change.
 */
const SHOW_SERVER_SIDE_TO_USERS = true;

type Tone = 'good' | 'warn' | 'idle';

/**
 * Picked to read on the DARK tooltip surface this component sets for itself, and they
 * double as the rail badge where the surround is the institute-themed nav colour.
 *
 * The surface is set explicitly rather than inherited: the shared TooltipContent
 * defaults to `bg-primary text-white`, and neither class exists in this
 * Tailwind config — `primary` is defined only as a 50–600 scale, with no DEFAULT and no
 * foreground key. So the default tooltip renders with no background at all. Eight other
 * TooltipContent usages already work around this the same way.
 */
const DOT_CLASS: Record<Tone, string> = {
    good: 'bg-emerald-400',
    warn: 'bg-amber-400',
    idle: 'bg-white/40',
};

const RAIL_TEXT: Record<Tone, string> = {
    good: 'text-white/70',
    warn: 'text-amber-300',
    idle: 'text-white/40',
};

/** Renders a measurement, or an honest dash when there is nothing to show. */
function ms(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)} ms`;
}

function sideTone(value: number | null, threshold: number): Tone {
    if (value === null) return 'idle';
    return value > threshold ? 'warn' : 'good';
}

/** One "● label ......... 54 ms" line in the tooltip. */
function MetricRow({ tone, label, value }: { tone: Tone; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[tone])} />
            <span className="flex-1 whitespace-nowrap text-white/60">{label}</span>
            <span className="font-mono font-medium tabular-nums text-white">{value}</span>
        </div>
    );
}

export function ConnectionStatusPill({ className }: { className?: string }) {
    const [snapshot, setSnapshot] = useState<PerfSnapshot>(() => getSnapshot());

    useEffect(() => {
        const unsubscribe = subscribe(() => setSnapshot(getSnapshot()));
        const stopPinging = startPingLoop(BASE_URL);
        // Hosted here because this is mounted on every admin page. It is a no-op
        // unless this session was sampled.
        const stopReporting = startRumReporting();
        return () => {
            unsubscribe();
            stopPinging();
            stopReporting();
        };
    }, []);

    const { verdict, serverMs, networkMs } = snapshot;
    const showAsServerSlow = verdict === 'server-slow' && SHOW_SERVER_SIDE_TO_USERS;

    let RailIcon: Icon = Gauge;
    let label = 'Checking';
    let tone: Tone = 'idle';
    let headline = 'Measuring speed';
    let note: string | null = 'Not enough samples yet to say anything useful.';

    if (showAsServerSlow) {
        RailIcon = CloudSlash;
        label = 'Slow';
        tone = 'warn';
        headline = 'Vacademy is slow';
        note = "This is on our side — you don't need to do anything.";
    } else if (verdict === 'network-slow') {
        RailIcon = WifiSlash;
        label = 'Network';
        tone = 'warn';
        headline = 'Your connection is slow';
        note = 'Our servers are responding normally, so this looks like the network.';
    } else if (verdict === 'healthy') {
        label = 'Good';
        tone = 'good';
        headline = 'Running normally';
        note = null;
    }

    return (
        <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
                <div
                    role="status"
                    aria-label={`${headline}. Vacademy ${ms(serverMs)}, your connection ${ms(networkMs)}.`}
                    className={cn(
                        'relative flex w-14 cursor-default flex-col items-center gap-0.5 rounded-xl px-1 py-2.5',
                        'transition-all duration-200 hover:bg-white/10',
                        className
                    )}
                >
                    <span className="relative z-10">
                        <RailIcon
                            size={22}
                            className={cn('transition-colors duration-200', RAIL_TEXT[tone])}
                        />
                        {/* A colour cue that survives the label being read past. */}
                        <span
                            className={cn(
                                'absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-nav-surface',
                                DOT_CLASS[tone]
                            )}
                        />
                    </span>
                    <span
                        className={cn(
                            'relative z-10 text-[10px] font-medium leading-tight transition-colors duration-200',
                            RAIL_TEXT[tone]
                        )}
                    >
                        {label}
                    </span>
                </div>
            </TooltipTrigger>

            <TooltipContent
                side="right"
                className="w-56 border border-white/10 bg-neutral-900 p-0 text-white shadow-lg"
            >
                <div className="border-b border-white/10 px-3 py-2">
                    <p className="text-xs font-semibold text-white">{headline}</p>
                    {note ? (
                        <p className="mt-0.5 text-[11px] leading-snug text-white/70">{note}</p>
                    ) : null}
                </div>
                <div className="space-y-1.5 px-3 py-2 text-[11px]">
                    <MetricRow
                        tone={sideTone(serverMs, SERVER_SLOW_MS)}
                        label="Vacademy"
                        value={ms(serverMs)}
                    />
                    <MetricRow
                        tone={sideTone(networkMs, NETWORK_SLOW_MS)}
                        label="Your connection"
                        value={ms(networkMs)}
                    />
                </div>
                <p className="border-t border-white/10 px-3 py-1.5 text-[10px] text-white/45">
                    Typical of your last {snapshot.sampleCount || 0} requests
                </p>
            </TooltipContent>
        </Tooltip>
    );
}

export default ConnectionStatusPill;
