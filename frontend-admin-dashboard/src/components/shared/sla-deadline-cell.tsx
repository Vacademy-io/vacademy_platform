import { formatDistanceStrict } from 'date-fns';
import { cn } from '@/lib/utils';

/** Parse a backend ISO string into a Date, treating missing TZ markers as UTC.
 *  Mirrors the normalisation in formatClock so both render paths agree. */
function parseTs(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(iso);
    const normalized = hasTimezone ? iso : `${iso.replace(' ', 'T')}Z`;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Two display modes for SLA cells in the leads tables:
 *
 * `mode = 'response'` — Reach-out-by column. Shows **when the counsellor actually contacted the lead**
 *   (the moment of their first activity — note / call / status change). Never shows the deadline.
 *     - Contacted on time: green "✓ Contacted · 5:30 PM"
 *     - Contacted late  : red   "✗ Contacted · 5:30 PM"
 *     - Not contacted, within TAT: neutral "Pending"
 *     - Not contacted, past TAT  : red "Overdue · No contact"
 *
 * `mode = 'deadline'` (default) — Follow-up by column. Shows the next deadline as a clock time;
 *   "Overdue" label in red if past.
 */
interface SlaDeadlineCellProps {
    /** ISO timestamp from the backend (tat_due_at / follow_up_due_at). */
    dueAt?: string | null;
    /** Force the overdue styling even if the clock hasn't crossed (uses the backend badge flag). */
    overdue?: boolean | null;
    /** First counsellor activity timestamp. Used in `response` mode to render the contact time. */
    respondedAt?: string | null;
    /** Reserved for older callers — no longer used (display is always clock times, no elapsed). */
    baselineAt?: string | null;
    /** Which display semantic to use. Defaults to 'deadline' to preserve Follow-up by behaviour. */
    mode?: 'response' | 'deadline';
}

/** Format an ISO timestamp as "23 May, 5:30 PM" in the user's locale.
 *  Backend serialises Timestamps as bare ISO strings without a TZ marker; we
 *  interpret them as UTC and convert to the browser's local timezone. 12-hour
 *  clock via `hour12: true`. */
function formatClock(iso: string): string | null {
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(iso);
    const normalized = hasTimezone ? iso : `${iso.replace(' ', 'T')}Z`;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

export function SlaDeadlineCell({
    dueAt,
    overdue,
    respondedAt,
    baselineAt,
    mode = 'deadline',
}: SlaDeadlineCellProps) {
    // ── RESPONSE MODE — Reach-out-in column ──────────────────────────────────
    // Show the counsellor's contact time + how long it took relative to submitted_at.
    // Colour green when contacted on/before tat_due_at, red when contacted after.
    if (mode === 'response') {
        if (respondedAt) {
            const respondedDate = parseTs(respondedAt);
            const respondedFmt = respondedDate && formatClock(respondedAt);
            if (respondedDate && respondedFmt) {
                const dueDate = parseTs(dueAt);
                const onTime = !dueDate || respondedDate.getTime() <= dueDate.getTime();
                const baselineDate = parseTs(baselineAt);
                // "in 2 minutes" / "in 1 hour" — duration from submitted_at to first
                // counsellor activity. Hidden when the baseline is unknown.
                const delta =
                    baselineDate && respondedDate.getTime() >= baselineDate.getTime()
                        ? formatDistanceStrict(respondedDate, baselineDate)
                        : null;
                return (
                    <div
                        className={cn(
                            'flex flex-col gap-0.5',
                            onTime ? 'text-success-600' : 'text-danger-600'
                        )}
                    >
                        <span className="text-sm font-medium">{respondedFmt}</span>
                        {delta && <span className="text-xs">in {delta}</span>}
                    </div>
                );
            }
        }

        // Not contacted yet
        const dueMs = dueAt ? new Date(dueAt).getTime() : NaN;
        const pastTat = (!Number.isNaN(dueMs) && dueMs < Date.now()) || !!overdue;
        if (pastTat) {
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-danger-600">Overdue</span>
                    <span className="text-xs text-danger-600">No contact yet</span>
                </div>
            );
        }
        return <span className="text-sm text-neutral-400">Pending</span>;
    }

    // ── DEADLINE MODE — Follow-up by column ──────────────────────────────────
    if (!dueAt) return <span className="text-sm text-neutral-400">—</span>;
    const abs = formatClock(dueAt);
    if (!abs) return <span className="text-sm text-neutral-400">—</span>;

    const isPast = new Date(dueAt).getTime() < Date.now() || !!overdue;

    return (
        <div className="flex flex-col gap-0.5">
            <span
                className={cn(
                    'text-sm font-medium',
                    isPast ? 'text-danger-600' : 'text-neutral-800'
                )}
            >
                {abs}
            </span>
            {isPast && <span className="text-xs font-medium text-danger-600">Overdue</span>}
        </div>
    );
}
