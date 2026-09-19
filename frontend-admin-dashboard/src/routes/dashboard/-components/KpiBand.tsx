import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CaretRight,
    Users,
    BookOpen,
    UsersThree,
    Money,
    WarningCircle,
    VideoCamera,
    type Icon,
} from '@phosphor-icons/react';
import {
    getDashboardKpisQuery,
    type DashboardKpi,
    type KpiBreakdownTone,
} from '../-services/dashboard-kpis-service';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { formatInstituteMoney, resolveInstituteCurrency } from '@/utils/institute-currency';

interface KpiBandProps {
    instituteId: string;
    roles: string[];
}

// Neutral, compact metrics keep the assistant and pending work visually primary.
const KPI_ICONS: Record<string, Icon> = {
    activeLearners: Users,
    totalCourses: BookOpen,
    teamMembers: UsersThree,
    outstandingFees: Money,
    overdueItems: WarningCircle,
    classesToday: VideoCamera,
};

// Breakdown chips sit under the headline value, so they must read as secondary:
// tinted surface, no border, same tabular-nums as the main figure.
const BREAKDOWN_TONE: Record<KpiBreakdownTone, string> = {
    neutral: 'bg-neutral-100 text-neutral-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-700',
    danger: 'bg-danger-50 text-danger-600',
};

/**
 * `currency` is the institute's resolved code, '' when it cannot be determined. Outstanding fees
 * come from the fee ledger, which stores no currency, so this used to be hardcoded to INR — a UAE
 * institute's dues card read "₹0". An unresolvable institute now shows a bare number instead of a
 * wrong symbol. Locale stays en-IN so compact notation reads as L/Cr.
 */
const formatValue = (k: DashboardKpi, currency: string): string => {
    if (k.format === 'currency') {
        return formatInstituteMoney(k.value, currency);
    }
    if (k.format === 'percent') {
        return `${k.value}%`;
    }
    if (k.value >= 1000) {
        try {
            return new Intl.NumberFormat('en-IN', {
                notation: 'compact',
                maximumFractionDigits: 1,
            }).format(k.value);
        } catch {
            return k.value.toLocaleString('en-IN');
        }
    }
    return k.value.toLocaleString('en-IN');
};

export default function KpiBand({ instituteId, roles }: KpiBandProps) {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('dashboardKpisService');
    const { t: dashboardT } = useTranslation('dashboardIndex');
    const { data, isLoading, isError } = useQuery(
        getDashboardKpisQuery({ instituteId, roles, t, language: i18n.language })
    );
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const currency = resolveInstituteCurrency(instituteDetails);

    if (isError) return null;
    if (!isLoading && (!data || data.length === 0)) return null;

    const items: (DashboardKpi | null)[] = isLoading
        ? Array.from({ length: 6 }, () => null)
        : data || [];

    const cols =
        items.length === 1
            ? 'grid-cols-1'
            : items.length === 2
              ? 'grid-cols-2'
              : items.length === 3
                ? 'grid-cols-2 lg:grid-cols-3'
                : items.length === 4
                  ? 'grid-cols-2 lg:grid-cols-4'
                  : items.length === 5
                    ? 'grid-cols-2 md:grid-cols-3 2xl:grid-cols-5'
                    : 'grid-cols-2 md:grid-cols-3 2xl:grid-cols-6';

    return (
        <section aria-label={dashboardT('overview.title')}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-800">
                {dashboardT('overview.title')}
            </h2>
            <div className={`grid gap-2 ${cols}`}>
                {items.map((k, i) => {
                    if (!k) {
                        return (
                            <Card key={i} className="rounded-xl bg-white p-3 shadow-none sm:p-4">
                                <div className="flex items-start justify-between">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="size-4 rounded" />
                                </div>
                                <Skeleton className="mt-3 h-7 w-24" />
                                <Skeleton className="mt-2 h-2.5 w-28" />
                            </Card>
                        );
                    }
                    const Icon = KPI_ICONS[k.id] || Users;
                    const clickable = !!k.deepLink;
                    return (
                        <button
                            key={k.id}
                            type="button"
                            onClick={() => k.deepLink && navigate({ to: k.deepLink })}
                            disabled={!clickable}
                            className="group rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-default"
                        >
                            <Card
                                className={`h-full rounded-xl bg-white p-3 shadow-none transition-colors sm:p-4 ${clickable ? 'group-hover:border-neutral-400 group-hover:bg-neutral-50' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium text-neutral-600">
                                            {k.label}
                                        </div>
                                    </div>
                                    <Icon
                                        size={16}
                                        className="mt-0.5 shrink-0 text-neutral-400"
                                        aria-hidden="true"
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="text-2xl font-semibold tabular-nums text-neutral-900">
                                        {formatValue(k, currency)}
                                    </span>
                                </div>
                                {!!k.breakdown?.length && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                        {k.breakdown.map((b) => (
                                            <span
                                                key={b.label}
                                                className={`rounded-sm px-1.5 py-0.5 text-2xs font-medium tabular-nums ${
                                                    BREAKDOWN_TONE[b.tone]
                                                }`}
                                            >
                                                {b.value.toLocaleString('en-IN')}{' '}
                                                {b.label.toLowerCase()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {k.subtitle && (
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="text-2xs text-neutral-500">
                                            {k.subtitle}
                                        </span>
                                        {clickable && (
                                            <CaretRight
                                                size={12}
                                                className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-700"
                                            />
                                        )}
                                    </div>
                                )}
                            </Card>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
