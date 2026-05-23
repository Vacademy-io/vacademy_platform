import { cn } from '@/lib/utils';

/**
 * Renders a TAT / follow-up SLA deadline as a clock time (e.g. "23 May, 5:30 PM"). When `respondedAt`
 * is supplied (Reach-out-by cell only), the cell flips to **"✓ Responded · 22 May, 3:45 PM"** — green
 * if responded before `dueAt`, red ("✗ Responded …") if after. No relative countdown is shown — the
 * value the user reads is always an actual clock time.
 *
 * Renders an em dash when there is no deadline (e.g. SLA off, or follow-up before any action).
 */
interface SlaDeadlineCellProps {
    /** ISO timestamp from the backend (tat_due_at / follow_up_due_at). */
    dueAt?: string | null;
    /** Force the overdue styling even if the clock hasn't crossed (uses the backend badge flag). */
    overdue?: boolean | null;
    /** First counsellor action timestamp — when set, the cell shows "Responded · <time>" instead of the deadline. */
    respondedAt?: string | null;
    /**
     * Reserved for older callers — no longer used now that we display only clock times (we no
     * longer compute elapsed durations). Kept on the interface so existing call sites compile.
     */
    baselineAt?: string | null;
}

/** Format an ISO timestamp as "23 May, 5:30 PM" in the user's locale. */
function formatClock(iso: string): string | null {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function SlaDeadlineCell({ dueAt, overdue, respondedAt }: SlaDeadlineCellProps) {
    // Responded path — Reach-out-by cell shows when the counsellor first acted, in clock time.
    if (respondedAt) {
        const respondedFmt = formatClock(respondedAt);
        if (respondedFmt) {
            const respondedMs = new Date(respondedAt).getTime();
            const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
            const onTime = Number.isNaN(dueMs) || respondedMs <= dueMs;
            return (
                <div
                    className={cn(
                        'flex flex-col gap-0.5',
                        onTime ? 'text-green-700' : 'text-red-600'
                    )}
                >
                    <span className="text-sm font-medium">
                        {onTime ? '✓ Responded' : '✗ Responded'}
                    </span>
                    <span className="text-xs">{respondedFmt}</span>
                </div>
            );
        }
    }

    // Default — show the deadline as a clock time only (no countdown).
    if (!dueAt) return <span className="text-sm text-neutral-400">—</span>;
    const abs = formatClock(dueAt);
    if (!abs) return <span className="text-sm text-neutral-400">—</span>;

    const isPast = new Date(dueAt).getTime() < Date.now() || !!overdue;

    return (
        <div className="flex flex-col gap-0.5">
            <span
                className={cn(
                    'text-sm font-medium',
                    isPast ? 'text-red-600' : 'text-neutral-800'
                )}
            >
                {abs}
            </span>
            {isPast && <span className="text-xs font-medium text-red-600">Overdue</span>}
        </div>
    );
}
