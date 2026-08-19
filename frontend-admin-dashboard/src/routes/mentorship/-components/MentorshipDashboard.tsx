import { Link } from '@tanstack/react-router';
import {
    ArrowRight,
    CalendarBlank,
    CheckCircle,
    Clock,
    GraduationCap,
    Star,
    UserMinus,
    UsersThree,
    WarningCircle,
    XCircle,
    type Icon,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import { useMentorDashboard, useMentorSessions } from '../-hooks/use-mentorship';
import type { MentorDTO } from '../-types/mentorship-types';
import { MentorAvatar } from './MentorAvatar';

/**
 * Admin overview of mentorship: the numbers, what needs attention, how the load is
 * spread, and what's coming up.
 *
 * Deliberately reads from what already exists — the mentorship dashboard endpoint
 * and the sessions list — so it adds a view, not a data path. The mentors screen is
 * now just a list; everything countable lives here.
 */
export function MentorshipDashboard({ instituteId }: { instituteId: string | undefined }) {
    const { data, isLoading, isError, refetch } = useMentorDashboard(instituteId);
    const upcoming = useMentorSessions(instituteId, { lifecycle: 'UPCOMING' });

    if (isError) {
        return (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                <div className="flex items-center gap-2">
                    <WarningCircle size={18} weight="fill" className="text-danger-600" />
                    <p className="text-body text-danger-600">Couldn&apos;t load mentorship data.</p>
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
        );
    }

    const mentors = data?.mentors ?? [];
    const rated = mentors.filter((m) => (m.rating_count ?? 0) > 0);
    // Weighted by number of ratings, so one 5-star mentor doesn't outweigh a busy one.
    const avgRating =
        rated.length > 0
            ? rated.reduce((sum, m) => sum + (m.average_rating ?? 0) * (m.rating_count ?? 0), 0) /
              rated.reduce((sum, m) => sum + (m.rating_count ?? 0), 0)
            : null;

    const attention = [
        {
            key: 'requests',
            count: data?.pending_requests ?? 0,
            label: 'learner waiting to be paired with a mentor',
            pluralLabel: 'learners waiting to be paired with a mentor',
            to: '/mentorship/requests',
            cta: 'Review requests',
        },
        {
            key: 'awaiting',
            count: data?.sessions_awaiting_review ?? 0,
            label: 'session held but not recorded — it counts nowhere until it is',
            pluralLabel: 'sessions held but not recorded — they count nowhere until they are',
            to: '/mentorship/sessions',
            cta: 'Review sessions',
        },
    ].filter((a) => a.count > 0);

    return (
        <div className="flex flex-col gap-5">
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Kpi
                    label="Mentors"
                    value={data?.total_mentors}
                    hint="On your team"
                    icon={UsersThree}
                    loading={isLoading}
                />
                <Kpi
                    label="Students mentored"
                    value={data?.distinct_mentees}
                    hint={`${data?.total_active_assignments ?? 0} active pairings`}
                    icon={GraduationCap}
                    loading={isLoading}
                />
                <Kpi
                    label="Sessions ahead"
                    value={data?.upcoming_sessions}
                    hint="Next 7 days"
                    icon={CalendarBlank}
                    loading={isLoading}
                />
                <Kpi
                    label="Average rating"
                    value={avgRating == null ? undefined : avgRating.toFixed(1)}
                    hint={
                        rated.length > 0 ? `From ${rated.length} rated mentors` : 'No ratings yet'
                    }
                    icon={Star}
                    loading={isLoading}
                    emptyText="—"
                />
            </section>

            {attention.length > 0 && (
                <section className="flex flex-col gap-2">
                    {attention.map((a) => (
                        <div
                            key={a.key}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3"
                        >
                            <span className="flex items-center gap-2 text-body text-neutral-700">
                                <Clock
                                    size={16}
                                    weight="fill"
                                    className="shrink-0 text-warning-600"
                                />
                                <span>
                                    <b>{a.count}</b> {a.count === 1 ? a.label : a.pluralLabel}
                                </span>
                            </span>
                            <Link to={a.to}>
                                <MyButton type="button" buttonType="secondary" scale="small">
                                    {a.cta}
                                </MyButton>
                            </Link>
                        </div>
                    ))}
                </section>
            )}

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <OutcomesCard data={data} loading={isLoading} />
                <WorkloadCard mentors={mentors} loading={isLoading} />
            </div>

            <UpcomingCard sessions={upcoming.data ?? []} loading={upcoming.isLoading} />
        </div>
    );
}

/** A headline number. The label and hint carry the meaning; the icon is decoration. */
function Kpi({
    label,
    value,
    hint,
    icon: IconCmp,
    loading,
    emptyText = '0',
}: {
    label: string;
    value?: number | string;
    hint: string;
    icon: Icon;
    loading: boolean;
    emptyText?: string;
}) {
    return (
        <Card className="flex flex-col gap-2 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-medium uppercase tracking-wide text-neutral-500">
                    {label}
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                    <IconCmp size={14} weight="duotone" />
                </span>
            </div>
            {loading ? (
                <Skeleton className="h-7 w-14" />
            ) : (
                <span className="text-h2 font-semibold tabular-nums leading-none text-neutral-700">
                    {value ?? emptyText}
                </span>
            )}
            <span className="line-clamp-1 text-caption text-neutral-400" title={hint}>
                {hint}
            </span>
        </Card>
    );
}

/** Status slices. Colour is never the only cue — every slice is labelled and counted. */
const OUTCOMES = [
    {
        key: 'completed',
        label: 'Completed',
        icon: CheckCircle,
        bar: 'bg-success-500',
        dot: 'text-success-500',
    },
    {
        key: 'noShow',
        label: 'No-show',
        icon: UserMinus,
        bar: 'bg-danger-500',
        dot: 'text-danger-500',
    },
    {
        key: 'cancelled',
        label: 'Cancelled',
        icon: XCircle,
        bar: 'bg-neutral-400',
        dot: 'text-neutral-400',
    },
    {
        key: 'awaiting',
        label: 'Awaiting review',
        icon: Clock,
        bar: 'bg-warning-500',
        dot: 'text-warning-500',
    },
] as const;

function OutcomesCard({
    data,
    loading,
}: {
    data?: {
        completed_sessions?: number;
        no_show_sessions?: number;
        cancelled_sessions?: number;
        sessions_awaiting_review?: number;
    } | null;
    loading: boolean;
}) {
    const counts: Record<string, number> = {
        completed: data?.completed_sessions ?? 0,
        noShow: data?.no_show_sessions ?? 0,
        cancelled: data?.cancelled_sessions ?? 0,
        awaiting: data?.sessions_awaiting_review ?? 0,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
        <Card className="flex flex-col gap-3 bg-white p-4 shadow-sm">
            <CardTitleRow
                title="Session outcomes"
                subtitle="Last 90 days"
                to="/mentorship/sessions"
            />

            {loading ? (
                <Skeleton className="h-24 w-full" />
            ) : total === 0 ? (
                <p className="py-4 text-caption text-neutral-400">
                    No sessions in this period yet. Outcomes appear once mentors record them.
                </p>
            ) : (
                <>
                    {/* One stacked bar, 2px gaps so segments stay separable without borders. */}
                    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-neutral-100">
                        {OUTCOMES.filter((o) => counts[o.key]! > 0).map((o) => (
                            <div
                                key={o.key}
                                className={cn('h-full', o.bar)}
                                // Width is a data proportion — the one thing Tailwind
                                // cannot express as a token.
                                style={{ width: `${(counts[o.key]! / total) * 100}%` }}
                            />
                        ))}
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {OUTCOMES.map((o) => {
                            const OutcomeIcon = o.icon;
                            return (
                                <li key={o.key} className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-caption text-neutral-600">
                                        <OutcomeIcon size={13} weight="fill" className={o.dot} />
                                        {o.label}
                                    </span>
                                    <span className="text-caption font-medium tabular-nums text-neutral-700">
                                        {counts[o.key]}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </Card>
    );
}

/**
 * Who is carrying the load. A meter per mentor rather than a separate chart — with
 * a handful of mentors an inline bar reads faster and costs no chrome.
 */
function WorkloadCard({ mentors, loading }: { mentors: MentorDTO[]; loading: boolean }) {
    const busiest = [...mentors]
        .sort((a, b) => (b.assigned_student_count ?? 0) - (a.assigned_student_count ?? 0))
        .slice(0, 5);
    const peak = Math.max(1, ...busiest.map((m) => m.assigned_student_count ?? 0));

    return (
        <Card className="flex flex-col gap-3 bg-white p-4 shadow-sm">
            <CardTitleRow
                title="Mentor workload"
                subtitle="Students per mentor"
                to="/mentorship/mentors"
            />

            {loading ? (
                <Skeleton className="h-24 w-full" />
            ) : busiest.length === 0 ? (
                <p className="py-4 text-caption text-neutral-400">No mentors yet.</p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {busiest.map((m) => {
                        const count = m.assigned_student_count ?? 0;
                        const cap = m.max_mentees ?? null;
                        const full = cap != null && count >= cap;
                        return (
                            <li key={m.id} className="flex items-center gap-3">
                                <MentorAvatar
                                    fileId={m.profile_image_file_id}
                                    name={m.display_name || m.name}
                                    className="size-7 shrink-0 text-caption"
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-caption text-neutral-700">
                                            {m.display_name || m.name || 'Mentor'}
                                        </span>
                                        <span
                                            className={cn(
                                                'shrink-0 text-caption tabular-nums',
                                                full ? 'text-danger-600' : 'text-neutral-500'
                                            )}
                                        >
                                            {cap ? `${count}/${cap}` : count}
                                            {full ? ' · full' : ''}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                                        <div
                                            className={cn(
                                                'h-full rounded-full',
                                                full ? 'bg-danger-500' : 'bg-primary-500'
                                            )}
                                            // Data-driven width; floored at 2% so a
                                            // mentor with one student still shows a mark.
                                            style={{
                                                width: `${Math.max(2, (count / (cap ?? peak)) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}

function UpcomingCard({
    sessions,
    loading,
}: {
    sessions: {
        booking_instance_id: string;
        mentor_name?: string | null;
        student_name?: string | null;
        scheduled_start_utc?: number | null;
    }[];
    loading: boolean;
}) {
    return (
        <Card className="flex flex-col gap-3 bg-white p-4 shadow-sm">
            <CardTitleRow
                title="Coming up"
                subtitle="Next scheduled sessions"
                to="/mentorship/sessions"
            />

            {loading ? (
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <p className="flex items-center gap-1.5 py-4 text-caption text-neutral-400">
                    <CalendarBlank size={14} /> Nothing booked yet.
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-neutral-100">
                    {sessions.slice(0, 5).map((s) => (
                        <li
                            key={s.booking_instance_id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                        >
                            <span className="truncate text-caption text-neutral-700">
                                {s.mentor_name || 'Mentor'} &rarr; {s.student_name || 'Learner'}
                            </span>
                            <span className="shrink-0 text-caption tabular-nums text-neutral-400">
                                {s.scheduled_start_utc
                                    ? new Date(s.scheduled_start_utc).toLocaleString(undefined, {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                      })
                                    : ''}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

function CardTitleRow({ title, subtitle, to }: { title: string; subtitle: string; to: string }) {
    return (
        <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
                <span className="text-body font-semibold text-neutral-700">{title}</span>
                <span className="text-caption text-neutral-400">{subtitle}</span>
            </div>
            <Link
                to={to}
                className="flex shrink-0 items-center gap-1 text-caption font-medium text-primary-600 hover:text-primary-700"
            >
                View
                <ArrowRight size={12} weight="bold" />
            </Link>
        </div>
    );
}
