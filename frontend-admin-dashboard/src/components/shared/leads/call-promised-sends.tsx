/**
 * What an AI call promised, and whether it actually went out.
 *
 * The agent offers a quiz link or a brochure on nearly every call. Until this existed
 * the only trace of what happened next was a row in engagement_action: the engagement
 * inbox surfaces an auto-send ONLY when it failed (a healthy one is the dispatch job's
 * business, not a human task), so a queued or delivered send appeared nowhere at all,
 * and neither was tied back to the call that produced it.
 *
 * Rendered both on the lead's call card — where people actually look after a call —
 * and inside the Call Log health sheet.
 */
import { useQuery } from '@tanstack/react-query';
import {
    callActionsKey,
    fetchCallActions,
    type CallAction,
} from '@/routes/audience-manager/call-log/-services/call-log-service';
import { cn } from '@/lib/utils';

/**
 * The ledger's own vocabulary, said the way a reader would say it. OPEN means the
 * dispatch job has not reached it yet, which is "queued" to anyone who has not read
 * engagement_action.
 */
const STATUS: Record<string, { label: string; tone: string }> = {
    OPEN: { label: 'Queued', tone: 'text-neutral-500' },
    DISPATCHING: { label: 'Sending', tone: 'text-neutral-500' },
    SENT: { label: 'Sent', tone: 'text-success-600' },
    FAILED: { label: 'Failed', tone: 'text-danger-600' },
    EXPIRED: { label: 'Expired unsent', tone: 'text-warning-600' },
};

export function describeAction(a: CallAction): string {
    if (a.action_type === 'BOOK_MEETING') return 'Book a meeting';
    const channel = a.channel === 'EMAIL' ? 'Email' : 'WhatsApp';
    return a.template_name ? `${channel} · ${a.template_name}` : channel;
}

export function CallPromisedSends({
    instituteId,
    callLogId,
    className,
}: {
    instituteId: string;
    callLogId: string;
    className?: string;
}) {
    const query = useQuery({
        queryKey: callActionsKey(instituteId, callLogId),
        queryFn: () => fetchCallActions(instituteId, callLogId),
        enabled: !!instituteId && !!callLogId,
        staleTime: 30_000,
        retry: false,
    });

    const actions = query.data ?? [];
    // Silent when the call promised nothing — which is every call on an agent with no
    // send rules, i.e. most of them. An empty box would be noise on every card.
    if (actions.length === 0) return null;

    return (
        <div className={cn('flex flex-col gap-2 rounded-md border border-neutral-200 p-3', className)}>
            <p className="text-caption font-medium">What this call promised</p>
            {actions.map((a) => {
                const st = STATUS[(a.status || '').toUpperCase()] ?? {
                    label: a.status || 'Unknown',
                    tone: 'text-neutral-500',
                };
                return (
                    <div key={a.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-caption">{describeAction(a)}</span>
                            <span className={cn('text-caption font-medium', st.tone)}>
                                {st.label}
                            </span>
                        </div>
                        {a.error_message && (
                            <p className="break-words text-caption text-danger-600">
                                {a.error_message}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
