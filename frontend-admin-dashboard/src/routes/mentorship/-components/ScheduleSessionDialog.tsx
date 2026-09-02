import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { reportApiError } from '@/lib/report-api-error';
import { useMentorDashboard, useScheduleSession } from '../-hooks/use-mentorship';
import { MentorSlotPicker } from './MentorSlotPicker';
import { MenteePicker } from './MenteePicker';
import type { MentorDTO, StudentRow } from '../-types/mentorship-types';

/**
 * Book a 1:1 for a learner without the learner doing anything.
 *
 * Two audiences share this dialog. An admin picks the mentor; a mentor (`asMentor`)
 * is always themselves and the mentor picker is hidden — the server refuses a mentor
 * booking anyone else's calendar anyway, so offering the choice would only mislead.
 * Either way the slot comes from the mentor's real availability, so a scheduled
 * session is the same object as one the learner booked themselves.
 */
export function ScheduleSessionDialog({
    instituteId,
    open,
    onOpenChange,
    asMentor = false,
    /** Pre-selected mentor — set when opening from a mentor's row or detail view. */
    mentor,
    /** For a mentor scheduling: their own booking slug, since they aren't in the admin list. */
    mentorSlug,
    /** Pre-selected learner — set when opening from a mentee row. */
    student,
}: {
    instituteId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    asMentor?: boolean;
    mentor?: MentorDTO | null;
    mentorSlug?: string | null;
    student?: { user_id: string; name?: string | null } | null;
}) {
    const [mentorId, setMentorId] = useState<string>(mentor?.id ?? '');
    const [picked, setPicked] = useState<StudentRow[]>([]);
    const [slot, setSlot] = useState<string | null>(null);
    const schedule = useScheduleSession();

    // Only an admin choosing between mentors needs the list; a mentor scheduling for
    // themselves would be fetching a list to ignore it.
    const dashboard = useMentorDashboard(asMentor || mentor ? undefined : instituteId);
    const mentors = dashboard.data?.mentors ?? [];

    useEffect(() => {
        if (!open) return;
        setMentorId(mentor?.id ?? '');
        setPicked([]);
        setSlot(null);
    }, [open, mentor?.id]);

    const chosenMentor = mentor ?? mentors.find((m) => m.id === mentorId) ?? null;
    const slug = asMentor ? mentorSlug ?? null : chosenMentor?.booking_page_slug ?? null;
    const studentUserId = student?.user_id ?? picked[0]?.user_id ?? null;
    const studentLabel =
        student?.name ?? picked[0]?.full_name ?? picked[0]?.username ?? 'the learner';

    const mentorOptions = useMemo(
        () =>
            mentors.map((m) => ({
                label: m.display_name || m.name || 'Mentor',
                value: m.id,
            })),
        [mentors]
    );

    const submit = async () => {
        if (!instituteId || !studentUserId || !slot) return;
        try {
            await schedule.mutateAsync({
                instituteId,
                asMentor,
                data: {
                    ...(asMentor ? {} : { mentor_id: chosenMentor?.id }),
                    student_user_id: studentUserId,
                    // The slot carries its own offset, so the instant is exact. No
                    // invitee_timezone is sent on purpose: the invitee is the LEARNER,
                    // not whoever is scheduling, and the server then falls back to the
                    // mentor's own booking-page zone rather than the scheduler's browser.
                    start_time: slot,
                },
            });
            toast.success(`Session booked with ${studentLabel}`);
            onOpenChange(false);
        } catch (error) {
            // "This slot is no longer available" is the common one and is worth reading.
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'schedule-session' },
                extra: { mentorId: chosenMentor?.id, studentUserId },
                fallbackMessage: "Couldn't schedule that session.",
            });
        }
    };

    const ready = !!studentUserId && !!slot && (asMentor || !!chosenMentor);

    return (
        <MyDialog
            heading="Schedule a 1:1"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        onClick={submit}
                        disable={!ready || schedule.isPending}
                    >
                        <CalendarCheck size={16} />
                        {schedule.isPending ? 'Booking…' : 'Book session'}
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-5">
                <p className="text-caption text-neutral-500">
                    The learner gets the confirmation, the meeting link and the reminders — exactly
                    as if they had booked it themselves. Nothing is asked of them.
                </p>

                {!asMentor && !mentor && (
                    <div className="flex flex-col gap-1">
                        <span className="text-caption font-medium text-neutral-600">Mentor</span>
                        <SearchableSelect
                            options={mentorOptions}
                            value={mentorId}
                            onChange={(v) => {
                                setMentorId(v);
                                // Availability belongs to a mentor; keep no stale slot across a switch.
                                setSlot(null);
                            }}
                            placeholder="Choose a mentor"
                            searchPlaceholder="Search mentors…"
                            emptyText="No mentors match"
                            // Inside a dialog: a portalled list can't be scrolled, because
                            // react-remove-scroll blocks wheel/touch on portalled nodes.
                            portal={false}
                        />
                    </div>
                )}

                {student ? (
                    <div className="flex flex-col gap-0.5">
                        <span className="text-caption font-medium text-neutral-600">Learner</span>
                        <span className="text-body text-neutral-700">
                            {student.name || student.user_id}
                        </span>
                    </div>
                ) : (
                    instituteId && (
                        <MenteePicker
                            instituteId={instituteId}
                            // One session, one learner: selecting a second replaces the first
                            // rather than silently booking only one of them.
                            singleSelect
                            selected={picked}
                            onChange={setPicked}
                        />
                    )
                )}

                <div className="flex flex-col gap-2">
                    <span className="text-caption font-medium text-neutral-600">Pick a time</span>
                    {!asMentor && !chosenMentor ? (
                        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-center text-caption text-neutral-400">
                            Choose a mentor to see when they&apos;re free.
                        </p>
                    ) : (
                        <MentorSlotPicker
                            instituteId={instituteId}
                            slug={slug}
                            value={slot}
                            onChange={setSlot}
                        />
                    )}
                </div>
            </div>
        </MyDialog>
    );
}
