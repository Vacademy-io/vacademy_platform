import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEAD_FOLLOWUPS, CLOSE_LEAD_FOLLOWUP, CREATE_LEAD_FOLLOWUP } from '@/constants/urls';
import { invalidateLeadCaches } from '@/hooks/use-invalidate-lead-caches';
import { cn, parseHtmlToString } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * CompleteFollowUpPopover — the single shared "Mark complete" close flow for a
 * lead follow-up (PUT /v1/lead-followup/{id}/close with an optional closer
 * reason). Extracted from the manage-students FollowUpsWidget so the
 * Follow-ups page can close follow-ups inline from list rows.
 *
 * Two host modes:
 *  - `followupId` known (FollowUpsWidget card): closes that exact follow-up.
 *  - `followupId` omitted (Follow-ups list row — the row is a lead, not a
 *    follow-up): the lead's open follow-ups are fetched lazily on first open
 *    via GET /v1/lead-followup/{audienceResponseId} and the user completes the
 *    pending one (a picker appears when there are several).
 *
 * "Schedule next" likewise has two modes: inline date+note fields (default,
 * widget behaviour) or an `onScheduleNext` callback for surfaces that prefer
 * to open the full add-note dialog on the Follow Up tab after closing.
 */

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

export async function fetchLeadFollowups(audienceResponseId: string): Promise<LeadFollowup[]> {
    const { data } = await authenticatedAxiosInstance.get(GET_LEAD_FOLLOWUPS(audienceResponseId));
    return data;
}

const followupPreview = (f: LeadFollowup): string => {
    if (!f.content) return 'Follow-up';
    const isHtml = /<\/?[a-z][^>]*>/i.test(f.content);
    const text = (isHtml ? parseHtmlToString(f.content) : f.content).trim();
    return text.length > 60 ? `${text.slice(0, 60)}…` : text || 'Follow-up';
};

interface CompleteFollowUpPopoverProps {
    audienceResponseId: string;
    userId: string;
    /** Close THIS follow-up. When omitted, open follow-ups are fetched lazily
     *  on popover open and the user completes the pending one. */
    followupId?: string;
    /** Extra query keys to invalidate after a successful close / schedule
     *  (e.g. the Follow-ups page passes [['follow-ups']]). */
    invalidateKeys?: string[][];
    /** When provided, "Schedule next follow-up" defers to this callback after
     *  the close succeeds (instead of the inline date + note fields). */
    onScheduleNext?: () => void;
    /** Custom trigger node; defaults to the "Mark complete" pill button. */
    trigger?: ReactNode;
    align?: 'start' | 'center' | 'end';
}

export function CompleteFollowUpPopover({
    audienceResponseId,
    userId,
    followupId,
    invalidateKeys,
    onScheduleNext,
    trigger,
    align = 'end',
}: CompleteFollowUpPopoverProps) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [scheduleNext, setScheduleNext] = useState(false);
    const [nextTime, setNextTime] = useState('');
    const [nextContent, setNextContent] = useState('');
    // Only meaningful when followupId is unknown and several are open.
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Lazy fetch — only when the popover is open and the host didn't pin a
    // specific follow-up. Shares the cache key with FollowUpsWidget.
    const followupsQuery = useQuery({
        queryKey: ['lead-followups', audienceResponseId],
        queryFn: () => fetchLeadFollowups(audienceResponseId),
        enabled: open && !followupId && !!audienceResponseId,
        staleTime: 60 * 1000,
    });
    const openFollowups = (followupsQuery.data ?? [])
        .filter((f) => !f.is_closed)
        .sort((a, b) => {
            const ta = a.schedule_time ? Date.parse(a.schedule_time) : 0;
            const tb = b.schedule_time ? Date.parse(b.schedule_time) : 0;
            return ta - tb;
        });
    const effectiveFollowupId = followupId ?? selectedId ?? openFollowups[0]?.id ?? null;

    const resetAndClose = () => {
        setOpen(false);
        setReason('');
        setScheduleNext(false);
        setNextTime('');
        setNextContent('');
        setSelectedId(null);
    };

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['lead-followups', audienceResponseId] });
        invalidateLeadCaches(queryClient, userId);
        invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
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
            invalidateAll();
            resetAndClose();
        },
        onError: () => toast.error('Failed to schedule next follow-up'),
    });

    const closeMutation = useMutation({
        mutationFn: () =>
            authenticatedAxiosInstance.put(CLOSE_LEAD_FOLLOWUP(effectiveFollowupId ?? ''), {
                closer_reason: reason,
            }),
        onSuccess: () => {
            toast.success('Follow-up marked complete');
            invalidateAll();
            if (scheduleNext && onScheduleNext) {
                resetAndClose();
                onScheduleNext();
            } else if (scheduleNext && nextTime) {
                createMutation.mutate();
            } else {
                resetAndClose();
            }
        },
        onError: () => toast.error('Failed to close follow-up'),
    });

    const isBusy = closeMutation.isPending || createMutation.isPending;
    const needsInlineSchedule = scheduleNext && !onScheduleNext;
    const canSubmit = !isBusy && !!effectiveFollowupId && (!needsInlineSchedule || !!nextTime);

    const isResolving = !followupId && followupsQuery.isLoading;
    const hasNoneOpen = !followupId && !followupsQuery.isLoading && openFollowups.length === 0;

    return (
        <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : resetAndClose())}>
            <PopoverTrigger asChild>
                {trigger ?? (
                    <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-success-300 hover:bg-success-50 hover:text-success-700"
                    >
                        <CheckCircle weight="regular" className="size-3.5" />
                        Mark complete
                    </button>
                )}
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align={align} onClick={(e) => e.stopPropagation()}>
                <p className="mb-2 text-xs font-semibold text-neutral-700">Mark as complete</p>

                {isResolving && <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />}

                {hasNoneOpen && (
                    <p className="rounded-lg bg-neutral-50 px-2.5 py-2 text-xs text-neutral-500">
                        No open follow-ups for this lead.
                    </p>
                )}

                {/* Several open follow-ups — let the user pick which one is done. */}
                {!followupId && openFollowups.length > 1 && (
                    <div className="mb-2 flex max-h-32 flex-col gap-1 overflow-y-auto">
                        {openFollowups.map((f) => (
                            <label
                                key={f.id}
                                className={cn(
                                    'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5',
                                    effectiveFollowupId === f.id
                                        ? 'border-primary-300 bg-primary-50'
                                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                )}
                            >
                                <input
                                    type="radio"
                                    name="followup-to-close"
                                    checked={effectiveFollowupId === f.id}
                                    onChange={() => setSelectedId(f.id)}
                                    className="mt-0.5 size-3 cursor-pointer accent-primary-600"
                                />
                                <span className="min-w-0">
                                    <span className="block truncate text-xs font-medium text-neutral-700">
                                        {followupPreview(f)}
                                    </span>
                                    {f.schedule_time && (
                                        <span className="block text-caption text-neutral-400">
                                            {format(
                                                new Date(f.schedule_time),
                                                'd MMM yyyy, h:mm a'
                                            )}
                                        </span>
                                    )}
                                </span>
                            </label>
                        ))}
                    </div>
                )}

                {!isResolving && !hasNoneOpen && (
                    <>
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
                            <span className="text-xs font-medium text-neutral-600">
                                Schedule next follow-up
                            </span>
                        </label>

                        {needsInlineSchedule && (
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
                        {scheduleNext && onScheduleNext && (
                            <p className="mt-1.5 text-caption text-neutral-400">
                                The schedule dialog opens after this is closed.
                            </p>
                        )}
                    </>
                )}

                <div className="mt-2 flex justify-end gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={resetAndClose}
                        disabled={isBusy}
                    >
                        Cancel
                    </Button>
                    {!hasNoneOpen && (
                        <Button
                            size="sm"
                            className="h-7 bg-success-600 px-2.5 text-xs text-white hover:bg-success-700"
                            onClick={() => closeMutation.mutate()}
                            disabled={!canSubmit}
                        >
                            {closeMutation.isPending
                                ? 'Saving…'
                                : createMutation.isPending
                                  ? 'Scheduling…'
                                  : scheduleNext
                                    ? 'Done & Schedule next'
                                    : 'Done ✓'}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
