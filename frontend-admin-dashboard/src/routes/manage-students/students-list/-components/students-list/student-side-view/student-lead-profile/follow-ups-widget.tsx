import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { CalendarCheck, CheckCircle, Clock } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEAD_FOLLOWUPS, CLOSE_LEAD_FOLLOWUP, CREATE_LEAD_FOLLOWUP } from '@/constants/urls';
import { invalidateLeadCaches } from '@/hooks/use-invalidate-lead-caches';
import { parseHtmlToString } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProfileSectionCard, ProfileEmpty } from '../profile-ui';

export interface LeadFollowup {
    id: string;
    audience_response_id: string;
    institute_id: string;
    created_by: string | null;
    schedule_time: string | null;
    status: string;
    is_closed: boolean;
    content: string | null;
    closer_reason: string | null;
    closed_by: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
}

/** Maps follow-up status to semantic token classes. */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    PENDING:   { label: 'Pending',   className: 'bg-info-100 text-info-700' },
    ONGOING:   { label: 'Ongoing',   className: 'bg-warning-100 text-warning-700' },
    OVERDUE:   { label: 'Overdue',   className: 'bg-danger-100 text-danger-700' },
    COMPLETED: { label: 'Completed', className: 'bg-success-100 text-success-700' },
};

async function fetchFollowups(audienceResponseId: string): Promise<LeadFollowup[]> {
    const { data } = await authenticatedAxiosInstance.get(GET_LEAD_FOLLOWUPS(audienceResponseId));
    return data;
}

// ── Complete Popover ──────────────────────────────────────────────────────────

function CompletePopover({
    followupId,
    audienceResponseId,
    userId,
}: {
    followupId: string;
    audienceResponseId: string;
    userId: string;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [scheduleNext, setScheduleNext] = useState(false);
    const [nextTime, setNextTime] = useState('');
    const [nextContent, setNextContent] = useState('');
    const queryClient = useQueryClient();

    const resetAndClose = () => {
        setOpen(false);
        setReason('');
        setScheduleNext(false);
        setNextTime('');
        setNextContent('');
    };

    const createMutation = useMutation({
        mutationFn: () =>
            authenticatedAxiosInstance.post(CREATE_LEAD_FOLLOWUP, {
                audience_response_id: audienceResponseId,
                schedule_time: new Date(nextTime).toISOString(),
                content: nextContent || null,
            }),
        onSuccess: () => {
            toast.success('Next follow-up scheduled');
            queryClient.invalidateQueries({ queryKey: ['lead-followups', audienceResponseId] });
            invalidateLeadCaches(queryClient, userId);
            resetAndClose();
        },
        onError: () => toast.error('Failed to schedule next follow-up'),
    });

    const closeMutation = useMutation({
        mutationFn: () =>
            authenticatedAxiosInstance.put(CLOSE_LEAD_FOLLOWUP(followupId), {
                closer_reason: reason,
            }),
        onSuccess: () => {
            toast.success('Follow-up marked complete');
            queryClient.invalidateQueries({ queryKey: ['lead-followups', audienceResponseId] });
            invalidateLeadCaches(queryClient, userId);
            if (scheduleNext && nextTime) {
                createMutation.mutate();
            } else {
                resetAndClose();
            }
        },
        onError: () => toast.error('Failed to close follow-up'),
    });

    const isBusy = closeMutation.isPending || createMutation.isPending;
    const canSubmit = !isBusy && (!scheduleNext || !!nextTime);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex cursor-pointer items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-success-300 hover:bg-success-50 hover:text-success-700"
                >
                    <CheckCircle weight="regular" className="size-3.5" />
                    Mark complete
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
                <p className="mb-2 text-xs font-semibold text-neutral-700">Mark as complete</p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Closing note (optional)…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                />

                <label className="mt-2.5 flex cursor-pointer items-center gap-2">
                    <input
                        type="checkbox"
                        checked={scheduleNext}
                        onChange={(e) => setScheduleNext(e.target.checked)}
                        className="size-3.5 cursor-pointer accent-primary-600"
                    />
                    <span className="text-xs font-medium text-neutral-600">Schedule next follow-up</span>
                </label>

                {scheduleNext && (
                    <div className="mt-2 flex flex-col gap-2">
                        <input
                            type="datetime-local"
                            value={nextTime}
                            onChange={(e) => setNextTime(e.target.value)}
                            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                        <textarea
                            value={nextContent}
                            onChange={(e) => setNextContent(e.target.value)}
                            placeholder="Note for next follow-up (optional)…"
                            rows={2}
                            className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                    </div>
                )}

                <div className="mt-2 flex justify-end gap-1.5">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={resetAndClose}
                        disabled={isBusy}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={() => closeMutation.mutate()}
                        disabled={!canSubmit}
                    >
                        {closeMutation.isPending
                            ? 'Saving…'
                            : createMutation.isPending
                              ? 'Scheduling…'
                              : scheduleNext
                                ? 'Done & Schedule next'
                                : 'Done'}
                    </MyButton>
                </div>
            </PopoverContent>
        </Popover>
    );
}

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
        <div className="rounded-lg border border-neutral-100 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold',
                        config.className,
                    )}
                >
                    {config.label}
                </span>
                {!followup.is_closed && (
                    <CompletePopover
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
                    {relativeTime && (
                        <span className="text-neutral-400">· {relativeTime}</span>
                    )}
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
        queryFn: () => fetchFollowups(audienceResponseId),
        enabled: !!audienceResponseId,
        staleTime: 60 * 1000,
    });

    const open = followups.filter((f) => !f.is_closed);

    return (
        <ProfileSectionCard
            icon={CalendarCheck}
            heading="Follow-ups"
            action={
                open.length > 0 ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                        {open.length} open
                    </span>
                ) : undefined
            }
        >
            {isLoading && <div className="h-16 animate-pulse rounded-lg bg-neutral-100" />}

            {!isLoading && open.length === 0 && (
                <ProfileEmpty
                    icon={CalendarCheck}
                    title="No open follow-ups"
                    hint="Schedule one below using the Follow Up tab"
                />
            )}

            {!isLoading && open.length > 0 && (
                <div className="flex flex-col gap-2">
                    {open.map((f) => (
                        <FollowUpCard key={f.id} followup={f} userId={userId} />
                    ))}
                </div>
            )}
        </ProfileSectionCard>
    );
}
