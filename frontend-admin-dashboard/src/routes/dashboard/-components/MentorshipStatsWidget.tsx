import { useNavigate } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, CalendarCheck, Clock, GraduationCap, UsersThree, type Icon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { useMentorDashboard } from '@/routes/mentorship/-hooks/use-mentorship';

interface Tile {
    key: string;
    label: string;
    value: number;
    subtitle: string;
    Icon: Icon;
    iconBg: string;
    iconColor: string;
    cardBg: string;
}

/**
 * Admin dashboard KPI card: mentors, mentees, today's and upcoming mentor
 * sessions. Data from the mentorship dashboard endpoint. Self-hides when the
 * institute has no mentors, so it only surfaces where mentorship is in use.
 */
export default function MentorshipStatsWidget() {
    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const { data, isLoading, isError } = useMentorDashboard(instituteId);

    if (!instituteId || isError) return null;
    if (!isLoading && (data?.total_mentors ?? 0) === 0) return null;

    const go = () => navigate({ to: '/mentorship/mentors' });

    const tiles: Tile[] = [
        {
            key: 'mentors',
            label: 'Mentors',
            value: data?.total_mentors ?? 0,
            subtitle: 'Active mentors',
            Icon: UsersThree,
            iconBg: 'bg-primary-100',
            iconColor: 'text-primary-600',
            cardBg: 'bg-primary-50',
        },
        {
            key: 'mentees',
            label: 'Mentees',
            value: data?.distinct_mentees ?? 0,
            subtitle: 'Students mentored',
            Icon: GraduationCap,
            iconBg: 'bg-success-100',
            iconColor: 'text-success-600',
            cardBg: 'bg-success-50',
        },
        {
            key: 'today',
            label: 'Today',
            value: data?.today_sessions ?? 0,
            subtitle: 'Sessions today',
            Icon: CalendarCheck,
            iconBg: 'bg-warning-100',
            iconColor: 'text-warning-600',
            cardBg: 'bg-warning-50',
        },
        {
            key: 'upcoming',
            label: 'Upcoming',
            value: data?.upcoming_sessions ?? 0,
            subtitle: 'Next 7 days',
            Icon: Clock,
            iconBg: 'bg-info-100',
            iconColor: 'text-info-600',
            cardBg: 'bg-info-50',
        },
    ];

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary-100">
                        <UsersThree size={18} weight="duotone" className="text-primary-600" />
                    </span>
                    <div>
                        <p className="text-caption font-medium text-neutral-400">Mentorship</p>
                        <h3 className="text-body font-semibold text-neutral-700">Mentors &amp; mentees</h3>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={go}
                    className="flex shrink-0 items-center gap-1 text-caption font-medium text-primary-600 hover:text-primary-700"
                >
                    Manage
                    <ArrowRight size={12} weight="bold" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {isLoading
                    ? Array.from({ length: 4 }, (_, i) => (
                          <Card key={i} className="p-4 shadow-sm">
                              <div className="flex items-start justify-between">
                                  <Skeleton className="h-3 w-16" />
                                  <Skeleton className="size-9 rounded-lg" />
                              </div>
                              <Skeleton className="mt-3 h-7 w-12" />
                              <Skeleton className="mt-2 h-2.5 w-20" />
                          </Card>
                      ))
                    : tiles.map((t) => {
                          const StatIcon = t.Icon;
                          return (
                              <button key={t.key} type="button" onClick={go} className="group text-left">
                                  <Card
                                      className={cn(
                                          'relative h-full overflow-hidden p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md',
                                          t.cardBg
                                      )}
                                  >
                                      <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1 text-caption font-medium uppercase tracking-wide text-neutral-500">
                                              {t.label}
                                          </div>
                                          <span
                                              className={cn(
                                                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                                  t.iconBg
                                              )}
                                          >
                                              <StatIcon size={18} weight="duotone" className={t.iconColor} />
                                          </span>
                                      </div>
                                      <div className="mt-2 text-h2 font-semibold tabular-nums text-neutral-700">
                                          {t.value.toLocaleString('en-IN')}
                                      </div>
                                      <span className="mt-1 line-clamp-1 text-caption text-neutral-500">
                                          {t.subtitle}
                                      </span>
                                  </Card>
                              </button>
                          );
                      })}
            </div>
        </section>
    );
}
