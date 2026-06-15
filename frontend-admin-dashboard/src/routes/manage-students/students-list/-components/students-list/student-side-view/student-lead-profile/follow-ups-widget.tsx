import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { CalendarCheck, Clock } from '@phosphor-icons/react';
import {
    CompleteFollowUpPopover,
    fetchLeadFollowups,
    type LeadFollowup,
} from '@/components/shared/leads';
import { parseHtmlToString } from '@/lib/utils';
import { cn } from '@/lib/utils';

// Close flow (CompleteFollowUpPopover) lives in the shared leads layer now —
// the Follow-ups page reuses the same component for its inline row action.
export type { LeadFollowup };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
    ONGOING: { label: 'Ongoing', className: 'bg-amber-100 text-amber-700' },
    OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
    COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
};

// ── Follow-up Card ────────────────────────────────────────────────────────────

function FollowUpCard({ followup, userId }: { followup: LeadFollowup; userId: string }) {
    const config = (STATUS_CONFIG[followup.status] ?? STATUS_CONFIG['PENDING'])!;

    const formattedTime = followup.schedule_time
        ? format(new Date(followup.schedule_time), 'd MMM yyyy, h:mm a')
        : null;

    const relativeTime = followup.schedule_time
        ? formatDistanceToNow(new Date(followup.schedule_time), { addSuffix: true })
        : null;

    const contentPreview = followup.content
        ? (() => {
              const isHtml = /<\/?[a-z][^>]*>/i.test(followup.content!);
              const text = isHtml
                  ? parseHtmlToString(followup.content!).trim()
                  : followup.content!.trim();
              return text.length > 90 ? `${text.slice(0, 90)}…` : text;
          })()
        : null;

    return (
        <div className="rounded-xl border border-neutral-100 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold',
                        config.className
                    )}
                >
                    {config.label}
                </span>
                {!followup.is_closed && (
                    <CompleteFollowUpPopover
                        followupId={followup.id}
                        audienceResponseId={followup.audience_response_id}
                        userId={userId}
                    />
                )}
            </div>

            {formattedTime && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                    <Clock weight="fill" className="size-3.5 shrink-0 text-neutral-400" />
                    <span>{formattedTime}</span>
                    {relativeTime && <span className="text-neutral-400">· {relativeTime}</span>}
                </div>
            )}

            {contentPreview && (
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{contentPreview}</p>
            )}

            {followup.is_closed && followup.closer_reason && (
                <p className="mt-1.5 text-xs italic text-neutral-400">
                    Closed: {followup.closer_reason}
                </p>
            )}
        </div>
    );
}

// ── Follow-ups Widget ─────────────────────────────────────────────────────────

interface FollowUpsWidgetProps {
    audienceResponseId: string;
    userId: string;
}

export function FollowUpsWidget({ audienceResponseId, userId }: FollowUpsWidgetProps) {
    const { data: followups = [], isLoading } = useQuery({
        queryKey: ['lead-followups', audienceResponseId],
        queryFn: () => fetchLeadFollowups(audienceResponseId),
        enabled: !!audienceResponseId,
        staleTime: 60 * 1000,
    });

    const open = followups.filter((f) => !f.is_closed);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="h-3.5 w-1 rounded-full bg-primary-500" />
                <h4 className="text-sm font-semibold text-neutral-700">Follow-ups</h4>
                {open.length > 0 && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-neutral-500">
                        {open.length} open
                    </span>
                )}
            </div>

            {isLoading && <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />}

            {!isLoading && open.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-5 text-center">
                    <CalendarCheck weight="fill" className="size-7 text-neutral-300" />
                    <p className="text-xs font-medium text-neutral-500">No open follow-ups</p>
                    <p className="text-caption text-neutral-400">
                        Schedule one below using the Follow Up tab
                    </p>
                </div>
            )}

            {!isLoading && open.length > 0 && (
                <div className="flex flex-col gap-2">
                    {open.map((f) => (
                        <FollowUpCard key={f.id} followup={f} userId={userId} />
                    ))}
                </div>
            )}
        </div>
    );
}
