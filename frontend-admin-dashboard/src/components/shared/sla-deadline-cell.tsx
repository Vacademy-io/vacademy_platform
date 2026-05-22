import { cn } from '@/lib/utils';

/**
 * Renders a TAT / follow-up SLA deadline as an absolute time plus a relative countdown
 * ("in 3h 20m" / "2h overdue"). Visual only — the deadline is computed on the backend
 * (reach-out = submitted_at + tatHours; follow-up = last counselor action + followUpSlaHours).
 * Renders an em dash when there is no deadline (e.g. SLA off, or follow-up before any action).
 */
interface SlaDeadlineCellProps {
    /** ISO timestamp string from the backend (tat_due_at / follow_up_due_at). */
    dueAt?: string | null;
    /** Force the overdue styling even if the clock hasn't crossed (uses the backend badge flag). */
    overdue?: boolean | null;
}

function formatRelative(diffMs: number): string {
    const past = diffMs < 0;
    const totalMins = Math.round(Math.abs(diffMs) / 60000);
    const days = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mins = totalMins % 60;

    let span: string;
    if (days > 0) span = `${days}d ${hours}h`;
    else if (hours > 0) span = `${hours}h ${mins}m`;
    else span = `${mins}m`;

    return past ? `${span} overdue` : `in ${span}`;
}

export function SlaDeadlineCell({ dueAt, overdue }: SlaDeadlineCellProps) {
    if (!dueAt) return <span className="text-sm text-neutral-400">—</span>;

    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) return <span className="text-sm text-neutral-400">—</span>;

    const diffMs = due.getTime() - Date.now();
    const isPast = diffMs < 0 || !!overdue;
    const abs = due.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-sm text-neutral-700">{abs}</span>
            <span className={cn('text-xs', isPast ? 'text-red-600' : 'text-neutral-500')}>
                {formatRelative(diffMs)}
            </span>
        </div>
    );
}
