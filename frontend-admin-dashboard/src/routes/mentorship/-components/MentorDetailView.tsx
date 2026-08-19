import {
    CalendarCheck,
    CaretRight,
    Clock,
    EnvelopeSimple,
    Star,
    UsersThree,
    WarningCircle,
} from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { MyButton } from '@/components/design-system/button';
import { StatusChips } from '@/components/design-system/chips';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useMentorAvailability,
    useMentorDashboard,
    useMentorFeedback,
    useMentorMentees,
} from '../-hooks/use-mentorship';
import { MentorAvatar } from './MentorAvatar';
import { MentorSessionsPanel } from './MentorSessionsPanel';
import { AvailabilitySummary, DAY_ORDER } from './MentorAvailabilitySummary';

export type MentorDetailTab = 'overview' | 'students' | 'availability' | 'sessions' | 'feedback';

const TABS: { key: MentorDetailTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'students', label: 'Students' },
    { key: 'availability', label: 'Availability' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'feedback', label: 'Feedback' },
];

/**
 * Everything an admin needs about one mentor, assembled from data that already
 * exists: the mentor row itself (profile, email, capacity, rating), their assigned
 * students, their availability, and their sessions — the last of which reuses the
 * very same sessions panel as the standalone screen, scoped to this mentor.
 *
 * The mentor comes out of the dashboard query the list screen already loaded, so
 * arriving here costs no extra request and this stays a view, not a data path.
 */
export function MentorDetailView({
    mentorId,
    instituteId,
    tab,
    onTabChange,
}: {
    mentorId: string;
    instituteId: string | undefined;
    tab: MentorDetailTab;
    onTabChange: (tab: MentorDetailTab) => void;
}) {
    const { data, isLoading, isError, refetch } = useMentorDashboard(instituteId);
    const mentor = (data?.mentors ?? []).find((m) => m.id === mentorId) ?? null;

    const mentees = useMentorMentees(mentor?.id, instituteId);
    const availability = useMentorAvailability(mentor?.id, instituteId);
    const feedback = useMentorFeedback(tab === 'feedback' ? mentor?.id : undefined, instituteId);

    const setTab = onTabChange;

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    if (isError || !mentor) {
        return (
            <div className="flex flex-col gap-4 p-6">
                <Breadcrumb name={null} />
                <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                    <div className="flex items-center gap-2">
                        <WarningCircle size={18} weight="fill" className="text-danger-600" />
                        <p className="text-body text-danger-600">
                            {isError
                                ? "Couldn't load this mentor."
                                : 'That mentor is no longer on your team.'}
                        </p>
                    </div>
                    {isError ? (
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            onClick={() => refetch()}
                        >
                            Retry
                        </MyButton>
                    ) : (
                        <Link to="/mentorship/mentors">
                            <MyButton type="button" buttonType="secondary" scale="small">
                                Back to mentors
                            </MyButton>
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    const assigned = mentor.assigned_student_count ?? 0;
    const cap = mentor.max_mentees ?? null;
    const name = mentor.display_name || mentor.name || 'Mentor';
    const menteeCount = mentees.data?.length ?? assigned;
    const feedbackCount = mentor.rating_count ?? 0;

    return (
        <div className="flex flex-col gap-5 p-6">
            <Breadcrumb name={name} />

            <div className="flex flex-wrap items-center gap-3">
                <MentorAvatar
                    fileId={mentor.profile_image_file_id || mentor.profile_pic_file_id}
                    name={name}
                    className="size-14 text-title"
                />
                <div className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                        <h2 className="text-title font-semibold text-neutral-700">{name}</h2>
                        <StatusChips
                            status={
                                (mentor.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
                                    ? 'ACTIVE'
                                    : 'INACTIVE'
                            }
                        >
                            {(mentor.status || 'ACTIVE').toLowerCase()}
                        </StatusChips>
                    </span>
                    <span className="text-body text-neutral-500">{mentor.title || 'Mentor'}</span>
                    {mentor.email && (
                        <span className="flex items-center gap-1 text-caption text-neutral-400">
                            <EnvelopeSimple size={12} /> {mentor.email}
                        </span>
                    )}
                </div>
            </div>

            <nav
                className="flex flex-wrap gap-1 border-b border-neutral-200"
                aria-label="Mentor detail"
            >
                {TABS.map((t) => {
                    const count =
                        t.key === 'students'
                            ? menteeCount
                            : t.key === 'feedback'
                              ? feedbackCount
                              : null;
                    return (
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
                            {count ? ` (${count})` : ''}
                        </button>
                    );
                })}
            </nav>

            {tab === 'overview' && (
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    <Card className="flex h-full flex-col gap-3 bg-white p-4 shadow-sm">
                        <span className="text-body font-semibold text-neutral-700">
                            Mentor information
                        </span>
                        <dl className="flex flex-col gap-2">
                            <Fact
                                label="Expertise"
                                value={
                                    (mentor.expertise_tags?.length ?? 0) > 0
                                        ? mentor.expertise_tags?.join(', ')
                                        : null
                                }
                            />
                            <Fact
                                label="Session duration"
                                value={
                                    availability.data?.duration_minutes
                                        ? `${availability.data.duration_minutes} minutes`
                                        : null
                                }
                            />
                            <Fact label="Maximum capacity" value={cap ? `${cap}` : 'Unlimited'} />
                            <Fact
                                label="Discoverable"
                                value={
                                    mentor.is_discoverable
                                        ? 'Yes — learners can find and request them'
                                        : 'No — assigned by admins only'
                                }
                            />
                        </dl>
                        {mentor.bio && (
                            <p className="border-t border-neutral-100 pt-3 text-caption text-neutral-600">
                                {mentor.bio}
                            </p>
                        )}
                    </Card>

                    <Card className="flex h-full flex-col gap-3 bg-white p-4 shadow-sm">
                        <span className="flex items-center gap-1.5 text-body font-semibold text-neutral-700">
                            <Clock size={15} /> Availability this week
                        </span>
                        {availability.isLoading ? (
                            <Skeleton className="h-16 w-full rounded-md" />
                        ) : availability.isError ? (
                            <p className="text-caption text-neutral-400">
                                This mentor hasn&apos;t set up booking yet, so learners can&apos;t
                                book time with them.
                            </p>
                        ) : (
                            <AvailabilitySummary page={availability.data} />
                        )}
                        <button
                            type="button"
                            onClick={() => setTab('availability')}
                            className="mt-auto flex items-center justify-center gap-1 border-t border-neutral-100 pt-3 text-caption font-medium text-primary-600 hover:text-primary-700"
                        >
                            View full availability
                            <CaretRight size={12} weight="bold" />
                        </button>
                    </Card>

                    <Card className="flex h-full flex-col gap-3 bg-white p-4 shadow-sm">
                        <span className="text-body font-semibold text-neutral-700">Stats</span>
                        <div className="grid grid-cols-2 gap-3">
                            <Stat label="Assigned students" value={assigned} />
                            <Stat
                                label="Rated sessions"
                                value={feedbackCount}
                                icon={feedbackCount > 0}
                            />
                            <Stat
                                label="Average rating"
                                value={
                                    mentor.average_rating != null && feedbackCount > 0
                                        ? mentor.average_rating.toFixed(1)
                                        : '—'
                                }
                            />
                            <Stat label="Capacity" value={cap ? `${assigned}/${cap}` : '∞'} />
                        </div>
                        <button
                            type="button"
                            onClick={() => setTab('sessions')}
                            className="mt-auto flex items-center justify-center gap-1 border-t border-neutral-100 pt-3 text-caption font-medium text-primary-600 hover:text-primary-700"
                        >
                            View all sessions
                            <CaretRight size={12} weight="bold" />
                        </button>
                    </Card>
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
                                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white p-3"
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

            {tab === 'availability' && (
                <Card className="flex h-full flex-col gap-3 bg-white p-4 shadow-sm">
                    {availability.isLoading ? (
                        <Skeleton className="h-24 w-full rounded-md" />
                    ) : availability.isError ? (
                        <p className="text-caption text-neutral-400">
                            This mentor hasn&apos;t set up booking yet, so learners can&apos;t book
                            time with them.
                        </p>
                    ) : (
                        <FullAvailability page={availability.data} />
                    )}
                </Card>
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
                                className="rounded-md border border-neutral-200 bg-white p-3"
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
    );
}

function Breadcrumb({ name }: { name: string | null }) {
    return (
        <nav className="flex items-center gap-1.5 text-caption text-neutral-400">
            <Link to="/mentorship/mentors" className="hover:text-primary-600">
                Mentors
            </Link>
            <CaretRight size={11} weight="bold" />
            <span className="text-neutral-600">{name ?? 'Mentor'}</span>
        </nav>
    );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-caption text-neutral-500">{label}</dt>
            <dd className="min-w-0 text-right text-caption text-neutral-700">
                {value || <span className="text-neutral-300">—</span>}
            </dd>
        </div>
    );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-lg bg-neutral-50 p-3">
            <span className="flex items-center gap-1 text-h3 font-semibold tabular-nums text-neutral-700">
                {icon && <Star size={14} weight="fill" className="text-warning-500" />}
                {value}
            </span>
            <span className="text-caption text-neutral-500">{label}</span>
        </div>
    );
}

/** Every configured day, including the ones with no hours — the gaps are the point. */
function FullAvailability({
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

    return (
        <div className="flex flex-col gap-2">
            {DAY_ORDER.map((day) => {
                const ranges = windows.filter((w) => w.day_of_week === day);
                return (
                    <div
                        key={day}
                        className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2 last:border-0"
                    >
                        <span className="w-28 shrink-0 text-body capitalize text-neutral-600">
                            {day.toLowerCase()}
                        </span>
                        {ranges.length === 0 ? (
                            <span className="flex-1 text-caption text-neutral-300">
                                Unavailable
                            </span>
                        ) : (
                            <span className="flex-1 text-caption text-neutral-700">
                                {ranges.map((r) => `${r.start_time} – ${r.end_time}`).join(', ')}
                            </span>
                        )}
                        <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-caption ${
                                ranges.length === 0
                                    ? 'bg-neutral-100 text-neutral-400'
                                    : 'bg-success-50 text-success-600'
                            }`}
                        >
                            {ranges.length === 0 ? 'Unavailable' : 'Available'}
                        </span>
                    </div>
                );
            })}
            <span className="flex items-center gap-1.5 pt-1 text-caption text-neutral-400">
                <CalendarCheck size={12} />
                {page?.duration_minutes
                    ? `${page.duration_minutes}-minute sessions`
                    : 'Default length'}
                {page?.timezone ? ` · ${page.timezone}` : ''}
            </span>
        </div>
    );
}
