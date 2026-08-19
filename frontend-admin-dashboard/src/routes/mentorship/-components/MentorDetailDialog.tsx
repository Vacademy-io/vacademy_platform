import { useState } from 'react';
import { CalendarCheck, Clock, EnvelopeSimple, Star, UsersThree } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useMentorAvailability,
    useMentorFeedback,
    useMentorMentees,
} from '../-hooks/use-mentorship';
import type { MentorDTO } from '../-types/mentorship-types';
import { MentorAvatar } from './MentorAvatar';
import { MentorSessionsPanel } from './MentorSessionsPanel';

const DAY_ORDER = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
] as const;

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'students', label: 'Students' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'feedback', label: 'Feedback' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * Everything an admin needs about one mentor, assembled from data that already
 * exists: the mentor row itself (profile, email, capacity, rating), their assigned
 * students, their availability, and their sessions — the last of which reuses the
 * very same sessions panel as the standalone screen, scoped to this mentor.
 */
export function MentorDetailDialog({
    mentor,
    instituteId,
    open,
    onOpenChange,
}: {
    mentor: MentorDTO | null;
    instituteId: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [tab, setTab] = useState<TabKey>('overview');
    const mentees = useMentorMentees(open ? mentor?.id : undefined, instituteId);
    const availability = useMentorAvailability(open ? mentor?.id : undefined, instituteId);
    const feedback = useMentorFeedback(
        open && tab === 'feedback' ? mentor?.id : undefined,
        instituteId
    );

    if (!mentor) return null;

    const assigned = mentor.assigned_student_count ?? 0;
    const cap = mentor.max_mentees ?? null;

    return (
        <MyDialog
            heading={mentor.display_name || mentor.name || 'Mentor'}
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-3xl"
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <MentorAvatar
                        fileId={mentor.profile_image_file_id || mentor.profile_pic_file_id}
                        name={mentor.display_name || mentor.name}
                        className="size-12 text-title"
                    />
                    <div className="flex min-w-0 flex-col">
                        <span className="text-body font-semibold text-neutral-700">
                            {mentor.display_name || mentor.name || 'Mentor'}
                        </span>
                        <span className="text-caption text-neutral-500">{mentor.title || ''}</span>
                        {mentor.email && (
                            <span className="flex items-center gap-1 text-caption text-neutral-400">
                                <EnvelopeSimple size={12} /> {mentor.email}
                            </span>
                        )}
                    </div>
                    <div className="ms-auto flex items-center gap-2">
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-neutral-600">
                            {cap ? `${assigned}/${cap} students` : `${assigned} students`}
                        </span>
                        {mentor.average_rating != null && (mentor.rating_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-caption text-warning-700">
                                <Star size={12} weight="fill" className="text-warning-500" />
                                {mentor.average_rating.toFixed(1)} ({mentor.rating_count})
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 border-b border-neutral-200">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`-mb-px border-b-2 px-3 py-2 text-body transition-colors ${
                                tab === t.key
                                    ? 'border-primary-500 font-medium text-primary-600'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'overview' && (
                    <div className="flex flex-col gap-4">
                        {mentor.bio && (
                            <p className="text-caption text-neutral-600">{mentor.bio}</p>
                        )}

                        {(mentor.expertise_tags?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {mentor.expertise_tags?.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full bg-primary-50 px-2.5 py-1 text-caption text-primary-600"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <span className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-400">
                                <Clock size={13} /> Availability
                            </span>
                            {availability.isLoading ? (
                                <Skeleton className="h-16 w-full rounded-md" />
                            ) : availability.isError ? (
                                <p className="text-caption text-neutral-400">
                                    This mentor hasn&apos;t set up booking yet, so learners
                                    can&apos;t book time with them.
                                </p>
                            ) : (
                                <AvailabilitySummary page={availability.data} />
                            )}
                        </div>
                    </div>
                )}

                {tab === 'students' && (
                    <div className="flex flex-col gap-2">
                        {mentees.isLoading ? (
                            <Skeleton className="h-24 w-full rounded-md" />
                        ) : (mentees.data?.length ?? 0) === 0 ? (
                            <p className="flex items-center gap-1.5 text-caption text-neutral-400">
                                <UsersThree size={14} /> No students assigned to this mentor yet.
                            </p>
                        ) : (
                            (mentees.data ?? []).map((m) => (
                                <div
                                    key={m.assignment_id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 p-3"
                                >
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-body text-neutral-700">
                                            {m.name || m.student_user_id}
                                        </span>
                                        {m.email && (
                                            <span className="truncate text-caption text-neutral-400">
                                                {m.email}
                                            </span>
                                        )}
                                    </div>
                                    <span className="shrink-0 text-caption text-neutral-400">
                                        {m.assignment_method === 'ROUND_ROBIN'
                                            ? 'Auto-assigned'
                                            : 'Assigned'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {tab === 'sessions' && (
                    // The same panel as the Sessions screen, scoped to this mentor — upcoming,
                    // completed, cancelled and no-shows all filterable, with full history.
                    <MentorSessionsPanel instituteId={instituteId} mentorId={mentor.id} />
                )}

                {tab === 'feedback' && (
                    <div className="flex flex-col gap-2">
                        {feedback.isLoading ? (
                            <Skeleton className="h-24 w-full rounded-md" />
                        ) : (feedback.data?.length ?? 0) === 0 ? (
                            <p className="text-caption text-neutral-400">
                                No learner has rated a session with this mentor yet.
                            </p>
                        ) : (
                            (feedback.data ?? []).map((f) => (
                                <div
                                    key={f.id}
                                    className="rounded-md border border-neutral-100 p-3"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1 text-caption text-warning-700">
                                            <Star
                                                size={12}
                                                weight="fill"
                                                className="text-warning-500"
                                            />
                                            {f.rating}/5
                                        </span>
                                        <span className="text-caption text-neutral-400">
                                            {f.student_name || ''}
                                        </span>
                                    </div>
                                    {f.comment && (
                                        <p className="mt-1 text-caption text-neutral-600">
                                            {f.comment}
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </MyDialog>
    );
}

/** Weekly hours in day order, plus the settings that decide what learners can pick. */
function AvailabilitySummary({
    page,
}: {
    page?: {
        availability?: {
            weekly_windows?: { day_of_week: string; start_time: string; end_time: string }[];
        } | null;
        duration_minutes?: number | null;
        timezone?: string | null;
    } | null;
}) {
    const windows = page?.availability?.weekly_windows ?? [];
    if (windows.length === 0) {
        return (
            <p className="text-caption text-neutral-400">
                No weekly hours set — learners are offered no slots.
            </p>
        );
    }
    const byDay = DAY_ORDER.map((day) => ({
        day,
        ranges: windows.filter((w) => w.day_of_week === day),
    })).filter((d) => d.ranges.length > 0);

    return (
        <div className="flex flex-col gap-1">
            {byDay.map(({ day, ranges }) => (
                <div key={day} className="flex items-center gap-2 text-caption">
                    <span className="w-24 shrink-0 capitalize text-neutral-500">
                        {day.toLowerCase()}
                    </span>
                    <span className="text-neutral-700">
                        {ranges.map((r) => `${r.start_time}–${r.end_time}`).join(', ')}
                    </span>
                </div>
            ))}
            <span className="mt-1 flex items-center gap-1.5 text-caption text-neutral-400">
                <CalendarCheck size={12} />
                {page?.duration_minutes
                    ? `${page.duration_minutes}-minute sessions`
                    : 'Default length'}
                {page?.timezone ? ` · ${page.timezone}` : ''}
            </span>
        </div>
    );
}
