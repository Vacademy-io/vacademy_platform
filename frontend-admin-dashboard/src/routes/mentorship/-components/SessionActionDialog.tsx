import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { reportApiError } from '@/lib/report-api-error';
import { useSessionAction } from '../-hooks/use-mentorship';
import type { MentorSessionDTO } from '../-types/mentorship-types';

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInputValue(epochMillis?: number | null): string {
    const d = epochMillis ? new Date(epochMillis) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
    )}`;
}

/**
 * Cancel or move one session. Both go through the same booking-module operations the
 * invitee's emailed link uses, so the live session, reminders, calendar entry and
 * notifications are handled identically however the change was initiated.
 */
export function SessionActionDialog({
    session,
    action,
    instituteId,
    asAdmin = true,
    onOpenChange,
}: {
    session: MentorSessionDTO | null;
    action: 'cancel' | 'reschedule' | null;
    instituteId: string | undefined;
    /** false for a mentor acting on their own session — the server enforces it either way. */
    asAdmin?: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [reason, setReason] = useState('');
    const [startTime, setStartTime] = useState('');
    const run = useSessionAction();

    useEffect(() => {
        if (!session || !action) return;
        setReason('');
        setStartTime(toLocalInputValue(session.scheduled_start_utc));
    }, [session, action]);

    const submit = async () => {
        if (!session || !action || !instituteId) return;
        if (action === 'reschedule' && !startTime) {
            toast.error('Pick a new date and time');
            return;
        }
        try {
            await run.mutateAsync({
                instituteId,
                bookingInstanceId: session.booking_instance_id,
                action,
                reason: reason.trim() || undefined,
                // The server parses ISO-8601; send an absolute instant so the mentor's
                // timezone, not the admin's browser, is never guessed at.
                startTime: action === 'reschedule' ? new Date(startTime).toISOString() : undefined,
                asAdmin,
            });
            toast.success(action === 'cancel' ? 'Session cancelled' : 'Session moved');
            onOpenChange(false);
        } catch (error) {
            // Slot clashes and concurrent edits come back with a readable reason —
            // "This slot is no longer available" is the whole point of showing it.
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': `session-${action}` },
                extra: { bookingInstanceId: session.booking_instance_id },
                fallbackMessage:
                    action === 'cancel'
                        ? "Couldn't cancel the session."
                        : "Couldn't move the session.",
            });
        }
    };

    if (!session || !action) return null;
    const cancelling = action === 'cancel';

    return (
        <MyDialog
            heading={cancelling ? 'Cancel session' : 'Reschedule session'}
            open={!!action}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-md"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Keep as is
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={submit}
                        disable={run.isPending}
                    >
                        {run.isPending ? 'Saving…' : cancelling ? 'Cancel session' : 'Move session'}
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-body text-neutral-600">
                    {cancelling ? (
                        <>
                            <b>{session.student_name || 'The learner'}</b> and{' '}
                            <b>{session.mentor_name || 'the mentor'}</b> are told it&apos;s off, and
                            the calendar entry and reminders are removed.
                        </>
                    ) : (
                        <>
                            The old slot is released and a new booking is created for{' '}
                            <b>{session.student_name || 'the learner'}</b>. If the new time was just
                            taken, you&apos;ll be asked to pick another.
                        </>
                    )}
                </p>

                {!cancelling && (
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="new-start"
                            className="text-caption font-medium text-neutral-600"
                        >
                            New date &amp; time
                        </label>
                        <input
                            id="new-start"
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="h-9 rounded-md border border-neutral-300 px-3 text-body text-neutral-600 focus:border-primary-500 focus:outline-none"
                        />
                        <span className="text-caption text-neutral-400">
                            Must be a slot the mentor is actually available for.
                        </span>
                    </div>
                )}

                <MyInput
                    input={reason}
                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setReason(e.target.value)
                    }
                    inputType="text"
                    inputPlaceholder={cancelling ? 'e.g. Mentor is unwell' : 'Optional note'}
                    label={cancelling ? 'Reason (shown to the learner)' : 'Reason (optional)'}
                    className="sm:w-full"
                />
            </div>
        </MyDialog>
    );
}
