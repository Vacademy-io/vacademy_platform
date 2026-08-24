import { useEffect, useState } from 'react';
import { CloudSlash, Gauge, WifiSlash, type Icon } from '@phosphor-icons/react';
import { BASE_URL } from '@/constants/urls';
import {
    getSnapshot,
    startPingLoop,
    subscribe,
    type PerfSnapshot,
} from '@/lib/perf/network-health';
import { startRumReporting } from '@/lib/perf/rum-reporter';
import { cn } from '@/lib/utils';

/**
 * Rail item that says which side is slow — ours or the user's connection.
 *
 * Unlike the rest of this feature's UI history, this one is ALWAYS visible: it sits in
 * the left rail above Status and reports continuously, so "is it fast right now?" has
 * a permanent answer rather than only appearing once something is wrong.
 *
 * That makes the wording matter more, not less. It shows "Checking" until there is
 * enough data to be honest — never a reassuring "Good" derived from three samples —
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
 * `false`: our slowness reads as a neutral "Checking" here and stays internal to the
 * health portal; users still get told when their own connection is the problem.
 *
 * A product call, not a technical one. Flipping this constant is the whole change.
 */
const SHOW_SERVER_SIDE_TO_USERS = true;

type Display = {
    icon: Icon;
    label: string;
    tone: string;
    title: string;
};

function displayFor(snapshot: PerfSnapshot): Display {
    const { verdict, serverMs, networkMs } = snapshot;

    const serverText = serverMs === null ? 'not measured yet' : `about ${Math.round(serverMs)}ms`;
    const networkText =
        networkMs === null ? 'not measured yet' : `about ${Math.round(networkMs)}ms`;

    if (verdict === 'server-slow' && SHOW_SERVER_SIDE_TO_USERS) {
        return {
            icon: CloudSlash,
            label: 'Slow',
            tone: 'text-amber-300',
            title: `Vacademy is responding slowly (${serverText}). This is on our side — you don't need to do anything.`,
        };
    }

    if (verdict === 'network-slow') {
        return {
            icon: WifiSlash,
            label: 'Network',
            tone: 'text-amber-300',
            title: `Your connection is taking ${networkText} to reach us, while our servers are responding normally. This looks like the network rather than Vacademy.`,
        };
    }

    if (verdict === 'healthy') {
        return {
            icon: Gauge,
            label: 'Good',
            tone: 'text-white/70',
            title: `Running normally. Our servers: ${serverText}. Your connection: ${networkText}.`,
        };
    }

    // 'unknown', or server-slow while we are configured not to surface it.
    return {
        icon: Gauge,
        label: 'Checking',
        tone: 'text-white/40',
        title: 'Measuring speed — not enough samples yet to say anything useful.',
    };
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

    const { icon: Icon, label, tone, title } = displayFor(snapshot);

    return (
        <div
            role="status"
            aria-label={title}
            title={title}
            className={cn(
                'relative flex w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition-all duration-200',
                'hover:bg-white/10',
                className
            )}
        >
            <span className="relative z-10">
                <Icon size={22} className={cn('transition-colors duration-200', tone)} />
            </span>
            <span
                className={cn(
                    'relative z-10 text-[10px] font-medium leading-tight transition-colors duration-200',
                    tone
                )}
            >
                {label}
            </span>
        </div>
    );
}

export default ConnectionStatusPill;
