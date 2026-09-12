import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    ArrowRight,
    CalendarBlank,
    CheckCircle,
    Clock,
    GraduationCap,
    Star,
    UserMinus,
    TrayArrowDown,
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
import { dayOfMonth, relativeDay, shortMonth, timeOfDay } from '../-utils/format-session-time';
import type { MentorDTO, MentorSessionDTO } from '../-types/mentorship-types';
import { MentorAvatar } from './MentorAvatar';

/**
 * Admin overview of mentorship: the numbers, what needs attention, how the load is
 * spread, and what's coming up.
 *
 * Deliberately reads from what already exists — the mentorship dashboard endpoint
 * and the sessions list — so it adds a view, not a data path. Every figure on this
 * screen is computed from one of those two; nothing here is decorative filler.
 */
export function MentorshipDashboard({ instituteId }: { instituteId: string | undefined }) {
    const { t } = useTranslation('mentorshipDashboard');
    const { data, isLoading, isError, refetch } = useMentorDashboard(instituteId);
    const upcoming = useMentorSessions(instituteId, { lifecycle: 'UPCOMING' });

    if (isError) {
        return (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-4">
                <div className="flex items-center gap-2">
                    <WarningCircle size={18} weight="fill" className="text-danger-600" />
                    <p className="text-body text-danger-600">{t('loadError')}</p>
                </div>
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="small"
                    onClick={() => refetch()}
                >
                    {t('retry')}
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

    return (
        <div className="flex flex-col gap-5">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                    label={t('kpi.mentors.label')}
                    value={data?.total_mentors}
                    hint={t('kpi.mentors.hint')}
                    icon={UsersThree}
                    tone="primary"
                    loading={isLoading}
                />
                <Kpi
                    label={t('kpi.studentsMentored.label')}
                    value={data?.distinct_mentees}
                    hint={t('kpi.studentsMentored.hint', {
                        count: data?.total_active_assignments ?? 0,
                    })}
                    icon={GraduationCap}
                    tone="info"
                    loading={isLoading}
                />
                <Kpi
                    label={t('kpi.sessionsAhead.label')}
                    value={data?.upcoming_sessions}
                    hint={t('kpi.sessionsAhead.hint')}
                    icon={CalendarBlank}
                    tone="warning"
                    loading={isLoading}
                />
                <Kpi
                    label={t('kpi.averageRating.label')}
                    value={avgRating == null ? undefined : avgRating.toFixed(1)}
                    hint={
                        rated.length > 0
                            ? t('kpi.averageRating.hintRated', { count: rated.length })
                            : t('kpi.averageRating.hintNone')
                    }
                    icon={Star}
                    tone="success"
                    loading={isLoading}
                    emptyText="—"
                />
            </section>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <OutcomesCard data={data} loading={isLoading} />
                <WorkloadCard
                    mentors={mentors}
                    sessions={upcoming.data ?? []}
                    loading={isLoading}
                />
                <AttentionCard
                    pendingRequests={data?.pending_requests ?? 0}
                    awaitingReview={data?.sessions_awaiting_review ?? 0}
                    loading={isLoading}
                />
            </div>

            <UpcomingCard sessions={upcoming.data ?? []} loading={upcoming.isLoading} />
        </div>
    );
}

const TONES = {
    primary: 'bg-primary-50 text-primary-500',
    info: 'bg-info-50 text-info-600',
    warning: 'bg-warning-50 text-warning-600',
    success: 'bg-success-50 text-success-600',
} as const;

/** A headline number. The label and hint carry the meaning; the icon is decoration. */
function Kpi({
    label,
    value,
    hint,
    icon: IconCmp,
    tone,
    loading,
    emptyText = '0',
}: {
    label: string;
    value?: number | string;
    hint: string;
    icon: Icon;
    tone: keyof typeof TONES;
    loading: boolean;
    emptyText?: string;
}) {
    return (
        <Card className="flex items-center gap-3 bg-white p-4 shadow-sm">
            <span
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl',
                    TONES[tone]
                )}
            >
                <IconCmp size={22} weight="duotone" />
            </span>
            <div className="flex min-w-0 flex-col">
                {loading ? (
                    <Skeleton className="h-7 w-12" />
                ) : (
                    <span className="text-h2 font-semibold tabular-nums leading-tight text-neutral-700">
                        {value ?? emptyText}
                    </span>
                )}
                <span className="truncate text-body text-neutral-600">{label}</span>
                <span className="truncate text-caption text-neutral-400" title={hint}>
                    {hint}
                </span>
            </div>
        </Card>
    );
}

/** Status slices. Colour is never the only cue — every slice is labelled and counted. */
const buildOutcomes = (t: TFunction) =>
    [
        {
            key: 'completed',
            label: t('outcomes.completed'),
            icon: CheckCircle,
            bar: 'bg-success-500',
            dot: 'text-success-500',
        },
        {
            key: 'noShow',
            label: t('outcomes.noShows'),
            icon: UserMinus,
            bar: 'bg-danger-500',
            dot: 'text-danger-500',
        },
        {
            key: 'cancelled',
            label: t('outcomes.cancelled'),
            icon: XCircle,
            bar: 'bg-neutral-400',
            dot: 'text-neutral-400',
        },
        {
            key: 'awaiting',
            label: t('outcomes.awaitingReview'),
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
    const { t } = useTranslation('mentorshipDashboard');
    const OUTCOMES = buildOutcomes(t);
    const counts: Record<string, number> = {
        completed: data?.completed_sessions ?? 0,
        noShow: data?.no_show_sessions ?? 0,
        cancelled: data?.cancelled_sessions ?? 0,
        awaiting: data?.sessions_awaiting_review ?? 0,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
        <SectionCard
            title={t('outcomes.cardTitle')}
            subtitle={t('outcomes.cardSubtitle')}
            to="/mentorship/sessions"
            linkLabel={t('viewAllSessions')}
        >
            {loading ? (
                <Skeleton className="h-24 w-full" />
            ) : total === 0 ? (
                <p className="py-4 text-caption text-neutral-400">{t('outcomes.empty')}</p>
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
                    <ul className="flex flex-col gap-2">
                        {OUTCOMES.map((o) => {
                            const OutcomeIcon = o.icon;
                            const count = counts[o.key] ?? 0;
                            return (
                                <li key={o.key} className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 text-caption text-neutral-600">
                                        <OutcomeIcon size={13} weight="fill" className={o.dot} />
                                        {o.label}
                                    </span>
                                    <span className="text-caption tabular-nums text-neutral-500">
                                        <b className="font-medium text-neutral-700">{count}</b>{' '}
                                        <span className="text-neutral-400">
                                            ({Math.round((count / total) * 100)}%)
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </SectionCard>
    );
}

/**
 * Who is carrying the load. A meter per mentor rather than a separate chart — with
 * a handful of mentors an inline bar reads faster and costs no chrome.
 */
function WorkloadCard({
    mentors,
    sessions,
    loading,
}: {
    mentors: MentorDTO[];
    sessions: MentorSessionDTO[];
    loading: boolean;
}) {
    const { t } = useTranslation('mentorshipDashboard');
    // Upcoming load per mentor, straight off the sessions already fetched for
    // "Coming up" — no extra request, and it's what "busy" actually means.
    const upcomingByMentor = sessions.reduce<Record<string, number>>((acc, s) => {
        if (s.mentor_id) acc[s.mentor_id] = (acc[s.mentor_id] ?? 0) + 1;
        return acc;
    }, {});

    const busiest = [...mentors]
        .sort((a, b) => (b.assigned_student_count ?? 0) - (a.assigned_student_count ?? 0))
        .slice(0, 5);
    const peak = Math.max(1, ...busiest.map((m) => m.assigned_student_count ?? 0));

    return (
        <SectionCard
            title={t('workload.cardTitle')}
            subtitle={t('workload.cardSubtitle')}
            to="/mentorship/mentors"
            linkLabel={t('viewAllMentors')}
        >
            {loading ? (
                <Skeleton className="h-24 w-full" />
            ) : busiest.length === 0 ? (
                <p className="py-4 text-caption text-neutral-400">{t('workload.empty')}</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {busiest.map((m) => {
                        const count = m.assigned_student_count ?? 0;
                        const cap = m.max_mentees ?? null;
                        const full = cap != null && count >= cap;
                        const ahead = upcomingByMentor[m.id] ?? 0;
                        return (
                            <li key={m.id} className="flex items-center gap-3">
                                <MentorAvatar
                                    fileId={m.profile_image_file_id}
                                    name={m.display_name || m.name}
                                    className="size-8 shrink-0 text-caption"
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-caption font-medium text-neutral-700">
                                            {m.display_name || m.name || t('mentorFallback')}
                                        </span>
                                        <span
                                            className={cn(
                                                'shrink-0 text-caption tabular-nums',
                                                full ? 'text-danger-600' : 'text-neutral-500'
                                            )}
                                        >
                                            {t('workload.countOfCap', {
                                                count,
                                                cap: cap ?? '∞',
                                            })}
                                            {full ? t('workload.fullSuffix') : ''}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                                        <div
                                            className={cn(
                                                'h-full rounded-full',
                                                full
                                                    ? 'bg-danger-500'
                                                    : cap
                                                      ? 'bg-primary-500'
                                                      : 'bg-primary-300'
                                            )}
                                            // Data-driven width. With a cap this is a true
                                            // fill; without one it is only relative to the
                                            // busiest mentor, so it tops out at 80% — a full
                                            // bar would imply a limit that doesn't exist.
                                            style={{
                                                width: cap
                                                    ? `${Math.max(2, (count / cap) * 100)}%`
                                                    : `${Math.max(2, (count / peak) * 80)}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-caption text-neutral-400">
                                        {m.title || t('mentorFallback')} ·{' '}
                                        {ahead === 0
                                            ? t('workload.noUpcoming')
                                            : t('workload.upcomingCount', { count: ahead })}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

/**
 * The only card that asks the admin to do something. It stays on screen when there
 * is nothing to do — an empty slot in a fixed grid reads as broken, and "all clear"
 * is itself worth knowing.
 */
function AttentionCard({
    pendingRequests,
    awaitingReview,
    loading,
}: {
    pendingRequests: number;
    awaitingReview: number;
    loading: boolean;
}) {
    const { t } = useTranslation('mentorshipDashboard');
    const items = [
        {
            key: 'requests',
            icon: TrayArrowDown,
            count: pendingRequests,
            title: t('attention.requestsTitle'),
            detail: t('attention.requestsDetail', { count: pendingRequests }),
            to: '/mentorship/requests',
            cta: t('attention.reviewRequests'),
        },
        {
            key: 'awaiting',
            icon: Clock,
            count: awaitingReview,
            title: t('attention.awaitingTitle'),
            detail: t('attention.awaitingDetail', { count: awaitingReview }),
            to: '/mentorship/sessions',
            cta: t('attention.reviewSessions'),
        },
    ].filter((a) => a.count > 0);

    return (
        <SectionCard
            title={t('attention.cardTitle')}
            subtitle={t('attention.cardSubtitle')}
            to="/mentorship/sessions"
            linkLabel={t('viewAllSessions')}
        >
            {loading ? (
                <Skeleton className="h-24 w-full" />
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                    <CheckCircle size={28} weight="duotone" className="text-success-500" />
                    <p className="text-caption font-medium text-neutral-700">
                        {t('attention.allCaughtUp')}
                    </p>
                    <p className="text-caption text-neutral-400">
                        {t('attention.allCaughtUpDescription')}
                    </p>
                </div>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {items.map((a) => {
                        const AttentionIcon = a.icon;
                        return (
                            <li
                                key={a.key}
                                className="flex flex-col gap-2 rounded-lg border border-warning-200 bg-warning-50/60 p-3"
                            >
                                <div className="flex items-start gap-2.5">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning-700">
                                        <AttentionIcon size={14} weight="fill" />
                                    </span>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="text-caption font-medium text-neutral-700">
                                            {a.title}
                                        </span>
                                        <span className="text-caption text-neutral-500">
                                            {a.detail}
                                        </span>
                                    </div>
                                </div>
                                <Link to={a.to} className="self-start">
                                    <MyButton type="button" buttonType="secondary" scale="small">
                                        {a.cta}
                                    </MyButton>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

function UpcomingCard({ sessions, loading }: { sessions: MentorSessionDTO[]; loading: boolean }) {
    const { t: tFormat, i18n } = useTranslation('mentorshipFormatSessionTimeUtils');
    const { t } = useTranslation('mentorshipDashboard');
    return (
        <Card className="flex flex-col gap-3 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                    <span className="text-body font-semibold text-neutral-700">
                        {t('upcoming.cardTitle')}
                    </span>
                    <span className="text-caption text-neutral-400">
                        {t('upcoming.cardSubtitle')}
                    </span>
                </div>
                <Link to="/mentorship/sessions">
                    <MyButton type="button" buttonType="secondary" scale="small">
                        {t('viewAllSessions')}
                    </MyButton>
                </Link>
            </div>

            {loading ? (
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <p className="flex items-center gap-1.5 py-6 text-caption text-neutral-400">
                    <CalendarBlank size={14} /> {t('upcoming.empty')}
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {sessions.slice(0, 5).map((s) => (
                        <li
                            key={s.booking_instance_id}
                            className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-2.5"
                        >
                            <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-white leading-none text-neutral-600">
                                <span className="text-body font-semibold tabular-nums">
                                    {dayOfMonth(s.scheduled_start_utc)}
                                </span>
                                <span className="text-caption font-medium leading-none tracking-wide text-neutral-400">
                                    {shortMonth(s.scheduled_start_utc, i18n.language)}
                                </span>
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-body text-neutral-700">
                                    {s.mentor_name || t('mentorFallback')} &rarr;{' '}
                                    {s.student_name || t('learnerFallback')}
                                </span>
                                <span className="text-caption text-neutral-400">
                                    {relativeDay(s.scheduled_start_utc, tFormat, i18n.language)} ·{' '}
                                    {timeOfDay(s.scheduled_start_utc, i18n.language)}
                                    {s.duration_minutes
                                        ? ` · ${t('upcoming.durationMinutes', { count: s.duration_minutes })}`
                                        : ''}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/** Card shell: title, subtitle, body, and one drill-through link pinned to the foot. */
function SectionCard({
    title,
    subtitle,
    to,
    linkLabel,
    children,
}: {
    title: string;
    subtitle: string;
    to: string;
    linkLabel: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="flex h-full flex-col gap-3 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 flex-col">
                <span className="text-body font-semibold text-neutral-700">{title}</span>
                <span className="text-caption text-neutral-400">{subtitle}</span>
            </div>

            <div className="flex flex-1 flex-col gap-3">{children}</div>

            <Link
                to={to}
                className="flex items-center justify-center gap-1 border-t border-neutral-100 pt-3 text-caption font-medium text-primary-600 hover:text-primary-700"
            >
                {linkLabel}
                <ArrowRight size={12} weight="bold" />
            </Link>
        </Card>
    );
}
