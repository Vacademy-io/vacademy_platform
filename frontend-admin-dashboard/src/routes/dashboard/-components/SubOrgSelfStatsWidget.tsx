import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowRight,
    BookOpen,
    CaretRight,
    CurrencyInr,
    GraduationCap,
    UsersThree,
    type Icon,
} from '@phosphor-icons/react';
import {
    getScopedInvites,
    getSubOrgFinanceDetail,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getValidSelectedSubOrgId } from '@/lib/auth/facultyAccessUtils';

interface StatVisual {
    Icon: Icon;
    iconBg: string;
    iconColor: string;
    cardBg: string;
}

interface Stat {
    key: string;
    label: string;
    value: string;
    subtitle: string;
    visual: StatVisual;
}

const inr = (n: number): string => {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
            notation: n >= 100000 ? 'compact' : 'standard',
        }).format(n);
    } catch {
        return `₹${Math.round(n).toLocaleString('en-IN')}`;
    }
};

const nfmt = (n: number) => n.toLocaleString('en-IN');

/** Distinct package sessions across a sub-org's scoped invites = its course count. */
const courseCountFromInvites = (invites: unknown): number => {
    if (!Array.isArray(invites)) return 0;
    const ids = new Set<string>();
    invites.forEach((inv) => {
        const pss = (inv as { package_sessions?: { id?: string }[] })?.package_sessions;
        if (Array.isArray(pss)) {
            pss.forEach((ps) => {
                if (ps?.id) ids.add(ps.id);
            });
        }
    });
    return ids.size;
};

/**
 * Self-scoped stats for a SUB-ORG ADMIN's dashboard: their own sub-org's
 * learners, seats used/total, courses and outstanding fees — as KPI stat cards
 * matching the dashboard KpiBand look. Distinct from SubOrgOverviewWidget
 * (which is the PARENT admin's whole-network view); this one only ever renders
 * for a sub-org admin, scoped to the sub-org they're currently in.
 *
 * The caller MUST already be a sub-org admin (the dashboard gates this on
 * isCallerSubOrgAdmin()); the sub-org id is resolved from their validated
 * faculty-access data — never from a URL/param — so they can only ever see
 * their own org. Numbers come from getSubOrgFinanceDetail (one call yields
 * seats + learner count + outstanding); course count from scoped invites.
 * Deep-links into the sub-org portal. Renders nothing if no sub-org resolves.
 */
export default function SubOrgSelfStatsWidget() {
    const navigate = useNavigate();
    const instituteId = getCurrentInstituteId();
    const subOrgId = getValidSelectedSubOrgId();

    const { data: finance, isLoading: financeLoading, isError } = useQuery({
        queryKey: ['sub-org-self-finance', subOrgId, instituteId],
        queryFn: () => getSubOrgFinanceDetail(subOrgId || '', instituteId || undefined),
        enabled: !!subOrgId,
        staleTime: 60_000,
        retry: false,
    });

    const { data: scopedInvites } = useQuery({
        queryKey: ['sub-org-self-scoped-invites', subOrgId],
        queryFn: () => getScopedInvites(subOrgId || ''),
        enabled: !!subOrgId,
        staleTime: 60_000,
        retry: false,
    });

    // No resolvable sub-org, or the finance call failed → render nothing rather
    // than a broken/zero card.
    if (!subOrgId || isError) return null;

    const isLoading = financeLoading;
    const seat = finance?.seat_usage;
    const used = seat?.used ?? 0;
    const total = seat?.total ?? null;
    const remaining = seat?.remaining ?? null;
    const learners = finance?.totals?.learner_count ?? 0;
    const outstanding = finance?.totals?.total_outstanding ?? 0;
    const courses = courseCountFromInvites(scopedInvites);
    const heading = finance?.sub_org_name?.trim() || 'My organization';

    const stats: Stat[] = [
        {
            key: 'learners',
            label: 'Learners',
            value: nfmt(learners),
            subtitle: 'Enrolled members',
            visual: {
                Icon: GraduationCap,
                iconBg: 'bg-blue-100',
                iconColor: 'text-blue-600',
                cardBg: 'bg-gradient-to-br from-blue-50/60 to-white',
            },
        },
        {
            key: 'seats',
            label: 'Seats',
            value: total != null ? `${nfmt(used)}/${nfmt(total)}` : nfmt(used),
            subtitle:
                total != null
                    ? `${nfmt(Math.max(remaining ?? total - used, 0))} seats left`
                    : 'No seat cap',
            visual: {
                Icon: UsersThree,
                iconBg: 'bg-violet-100',
                iconColor: 'text-violet-600',
                cardBg: 'bg-gradient-to-br from-violet-50/60 to-white',
            },
        },
        {
            key: 'courses',
            label: 'Courses',
            value: nfmt(courses),
            subtitle: 'Assigned courses',
            visual: {
                Icon: BookOpen,
                iconBg: 'bg-emerald-100',
                iconColor: 'text-emerald-600',
                cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white',
            },
        },
        {
            key: 'outstanding',
            label: 'Outstanding',
            value: inr(outstanding),
            subtitle: 'Fees due',
            visual: {
                Icon: CurrencyInr,
                iconBg: 'bg-amber-100',
                iconColor: 'text-amber-600',
                cardBg: 'bg-gradient-to-br from-amber-50/60 to-white',
            },
        },
    ];

    const go = () => navigate({ to: '/manage-suborg-teams' });

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                        <UsersThree size={14} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900">
                            {heading}
                        </h3>
                        <p className="line-clamp-1 text-xs text-neutral-500">
                            Your organization at a glance
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={go}
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                    Manage
                    <ArrowRight size={12} weight="bold" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {isLoading
                    ? Array.from({ length: 4 }, (_, i) => (
                          <Card key={i} className="bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between">
                                  <Skeleton className="h-3 w-20" />
                                  <Skeleton className="size-9 rounded-xl" />
                              </div>
                              <Skeleton className="mt-3 h-7 w-16" />
                              <Skeleton className="mt-2 h-2.5 w-24" />
                          </Card>
                      ))
                    : stats.map((s) => {
                          const StatIcon = s.visual.Icon;
                          return (
                              <button
                                  key={s.key}
                                  type="button"
                                  onClick={go}
                                  className="group text-left"
                              >
                                  <Card
                                      className={`relative h-full overflow-hidden p-4 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md ${s.visual.cardBg}`}
                                  >
                                      <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                                              {s.label}
                                          </div>
                                          <span
                                              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${s.visual.iconBg}`}
                                          >
                                              <StatIcon
                                                  size={18}
                                                  weight="duotone"
                                                  className={s.visual.iconColor}
                                              />
                                          </span>
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
                                          {s.value}
                                      </div>
                                      <div className="mt-1 flex items-center justify-between gap-2">
                                          <span className="line-clamp-1 text-xs text-neutral-500">
                                              {s.subtitle}
                                          </span>
                                          <CaretRight
                                              size={12}
                                              className="shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500"
                                          />
                                      </div>
                                  </Card>
                              </button>
                          );
                      })}
            </div>
        </section>
    );
}
