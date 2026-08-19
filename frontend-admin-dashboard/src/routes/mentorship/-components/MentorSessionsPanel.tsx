import { useState } from 'react';
import {
    CalendarBlank,
    CheckCircle,
    Clock,
    CaretRight,
    Star,
    UserMinus,
    VideoCamera,
    WarningCircle,
    XCircle,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useMentorSessions } from '../-hooks/use-mentorship';
import { dayOfMonth, sessionDateTime, shortMonth, timeOfDay } from '../-utils/format-session-time';
import { SessionActionDialog } from './SessionActionDialog';
import { MentorAvatar } from './MentorAvatar';
import type { MentorSessionDTO } from '../-types/mentorship-types';

/** The lifecycle states an admin filters by, in the order they matter. */
const FILTERS = [
    { key: '', label: 'All' },
    { key: 'UPCOMING', label: 'Upcoming' },
    { key: 'AWAITING_REVIEW', label: 'Awaiting review' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'NO_SHOW', label: 'No-shows' },
    { key: 'CANCELLED', label: 'Cancelled' },
] as const;

/**
 * Every mentorship session in one place: who, when, what happened, and how the
 * learner rated it. Read-only — an admin observes here; the mentor records the
 * outcome and the learner gives the rating.
 */
export function MentorSessionsPanel({
    instituteId,
    mentorId,
    studentUserId,
}: {
    instituteId: string | undefined;
    /** Set to scope the view to one mentor (mentor-wise) or one learner. */
    mentorId?: string;
    studentUserId?: string;
}) {
    const [lifecycle, setLifecycle] = useState<string>('');
    const [detail, setDetail] = useState<MentorSessionDTO | null>(null);
    const [acting, setActing] = useState<{
        session: MentorSessionDTO;
        action: 'cancel' | 'reschedule';
    } | null>(null);
    const { data, isLoading, isError, refetch } = useMentorSessions(instituteId, {
        mentorId,
        studentUserId,
        lifecycle: lifecycle || undefined,
    });
    const sessions = data ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1 border-b border-neutral-200">
                {FILTERS.map((f) => (
                    <button
                        key={f.key || 'all'}
                        type="button"
                        onClick={() => setLifecycle(f.key)}
                        className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
                            lifecycle === f.key
                                ? 'border-primary-500 font-medium text-primary-600'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                </div>
            ) : isError ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                    <div className="flex items-center gap-2">
                        <WarningCircle size={18} weight="fill" className="text-danger-600" />
                        <p className="text-body text-danger-600">Couldn&apos;t load sessions.</p>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => refetch()}
                    >
                        Retry
                    </MyButton>
                </div>
            ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                    <CalendarBlank size={36} className="text-neutral-300" />
                    <p className="text-body font-medium text-neutral-700">
                        {lifecycle ? 'No sessions in this state' : 'No mentor sessions yet'}
                    </p>
                    <p className="max-w-md text-caption text-neutral-500">
                        Sessions appear here once learners book time with a mentor.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {sessions.map((s) => (
                        <button
                            key={s.booking_instance_id}
                            type="button"
                            onClick={() => setDetail(s)}
                            className="group flex w-full flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/30"
                        >
                            {/* Leading date block — turns a wall of rows into something scannable. */}
                            <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-50 leading-none text-neutral-600 group-hover:bg-white">
                                <span className="text-body font-semibold tabular-nums">
                                    {dayOfMonth(s.scheduled_start_utc)}
                                </span>
                                <span className="text-caption font-medium tracking-wide text-neutral-400">
                                    {shortMonth(s.scheduled_start_utc)}
                                </span>
                            </span>

                            <span className="flex min-w-0 flex-1 basis-1/2 flex-col gap-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <MentorAvatar
                                        fileId={null}
                                        name={s.mentor_name}
                                        className="size-5 shrink-0 text-caption"
                                    />
                                    <span className="truncate text-body font-medium text-neutral-700">
                                        {s.mentor_name || 'Mentor'}
                                    </span>
                                    <CaretRight
                                        size={11}
                                        weight="bold"
                                        className="shrink-0 text-neutral-300"
                                    />
                                    <span className="truncate text-body text-neutral-600">
                                        {s.student_name || 'Learner'}
                                    </span>
                                </span>
                                <span className="truncate text-caption text-neutral-400">
                                    {timeOfDay(s.scheduled_start_utc)}
                                    {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
                                    {s.topic ? ` · ${s.topic}` : ''}
                                </span>
                            </span>

                            <span className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                                {s.lifecycle === 'UPCOMING' && (
                                    <>
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActing({ session: s, action: 'reschedule' });
                                            }}
                                        >
                                            Reschedule
                                        </MyButton>
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActing({ session: s, action: 'cancel' });
                                            }}
                                        >
                                            Cancel
                                        </MyButton>
                                    </>
                                )}
                                {typeof s.rating === 'number' && (
                                    <span className="flex items-center gap-1 rounded-full bg-warning-50 px-2 py-1 text-caption text-warning-700">
                                        <Star
                                            size={12}
                                            weight="fill"
                                            className="text-warning-500"
                                        />
                                        {s.rating}
                                    </span>
                                )}
                                <LifecycleBadge lifecycle={s.lifecycle} />
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <SessionDetailDialog session={detail} onOpenChange={(o) => !o && setDetail(null)} />

            <SessionActionDialog
                session={acting?.session ?? null}
                action={acting?.action ?? null}
                instituteId={instituteId}
                onOpenChange={(o) => {
                    if (!o) setActing(null);
                }}
            />
        </div>
    );
}

/** One word for a session's state, coloured by whether it needs attention. */
export function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
    const map: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
        COMPLETED: {
            label: 'Completed',
            tone: 'bg-success-50 text-success-600',
            icon: <CheckCircle size={12} weight="fill" />,
        },
        NO_SHOW: {
            label: 'No-show',
            tone: 'bg-danger-50 text-danger-600',
            icon: <UserMinus size={12} weight="fill" />,
        },
        CANCELLED: {
            label: 'Cancelled',
            tone: 'bg-neutral-100 text-neutral-500',
            icon: <XCircle size={12} weight="fill" />,
        },
        RESCHEDULED: {
            label: 'Rescheduled',
            tone: 'bg-neutral-100 text-neutral-500',
            icon: <Clock size={12} weight="fill" />,
        },
        UPCOMING: {
            label: 'Upcoming',
            tone: 'bg-info-50 text-info-600',
            icon: <CalendarBlank size={12} weight="fill" />,
        },
        AWAITING_REVIEW: {
            label: 'Awaiting review',
            tone: 'bg-warning-50 text-warning-700',
            icon: <Clock size={12} weight="fill" />,
        },
    };
    const entry = map[lifecycle] ?? {
        label: lifecycle,
        tone: 'bg-neutral-100 text-neutral-500',
        icon: null,
    };
    return (
        <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-caption ${entry.tone}`}
        >
            {entry.icon}
            {entry.label}
        </span>
    );
}

/** Everything about one session, as the admin brief lists it. */
function SessionDetailDialog({
    session,
    onOpenChange,
}: {
    session: MentorSessionDTO | null;
    onOpenChange: (open: boolean) => void;
}) {
    if (!session) return null;
    return (
        <MyDialog
            heading="Session details"
            open={!!session}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-body font-semibold text-neutral-700">
                        {session.title || 'Mentor session'}
                    </span>
                    <LifecycleBadge lifecycle={session.lifecycle} />
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    <Field label="Mentor" value={session.mentor_name} sub={session.mentor_email} />
                    <Field
                        label="Learner"
                        value={session.student_name}
                        sub={session.student_email}
                    />
                    <Field label="When" value={sessionDateTime(session.scheduled_start_utc)} />
                    <Field
                        label="Duration"
                        value={session.duration_minutes ? `${session.duration_minutes} min` : '—'}
                    />
                    <Field label="Topic" value={session.topic || '—'} />
                    <Field label="Booking status" value={session.booking_status || '—'} />
                </dl>

                {session.meet_link && (
                    <a
                        href={session.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-fit items-center gap-1.5 text-caption font-medium text-primary-600 hover:text-primary-700"
                    >
                        <VideoCamera size={14} /> Open meeting link
                    </a>
                )}

                {session.notes && (
                    <div className="flex flex-col gap-1">
                        <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Mentor&apos;s notes
                        </span>
                        <p className="rounded-md bg-neutral-50 p-3 text-caption text-neutral-600">
                            {session.notes}
                        </p>
                    </div>
                )}

                {typeof session.rating === 'number' && (
                    <div className="flex flex-col gap-1">
                        <span className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
                            Learner feedback
                        </span>
                        <span className="flex items-center gap-1.5 text-body text-neutral-700">
                            <Star size={14} weight="fill" className="text-warning-500" />
                            {session.rating}/5
                        </span>
                        {session.feedback_comment && (
                            <p className="rounded-md bg-neutral-50 p-3 text-caption text-neutral-600">
                                {session.feedback_comment}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </MyDialog>
    );
}

function Field({
    label,
    value,
    sub,
}: {
    label: string;
    value?: string | null;
    sub?: string | null;
}) {
    return (
        <div className="flex flex-col">
            <dt className="text-caption text-neutral-400">{label}</dt>
            <dd className="text-body text-neutral-700">{value || '—'}</dd>
            {sub && <dd className="text-caption text-neutral-400">{sub}</dd>}
        </div>
    );
}
