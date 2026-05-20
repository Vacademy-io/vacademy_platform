import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    CaretRight,
    Users,
    BookOpen,
    UsersThree,
    CurrencyInr,
    WarningCircle,
    VideoCamera,
    type Icon,
} from '@phosphor-icons/react';
import { getDashboardKpisQuery, type DashboardKpi } from '../-services/dashboard-kpis-service';

interface KpiBandProps {
    instituteId: string;
    roles: string[];
}

// Per-KPI visual treatment — icon + accent palette. Keeps the service layer
// data-only and the visual identity owned by the widget.
interface KpiVisual {
    Icon: Icon;
    iconBg: string;
    iconColor: string;
    cardBg: string;
}

const VISUALS: Record<string, KpiVisual> = {
    activeLearners: {
        Icon: Users,
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        cardBg: 'bg-gradient-to-br from-violet-50/60 to-white',
    },
    totalCourses: {
        Icon: BookOpen,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        cardBg: 'bg-gradient-to-br from-blue-50/60 to-white',
    },
    teamMembers: {
        Icon: UsersThree,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white',
    },
    outstandingFees: {
        Icon: CurrencyInr,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        cardBg: 'bg-gradient-to-br from-amber-50/60 to-white',
    },
    overdueItems: {
        Icon: WarningCircle,
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        cardBg: 'bg-gradient-to-br from-red-50/60 to-white',
    },
    classesToday: {
        Icon: VideoCamera,
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        cardBg: 'bg-gradient-to-br from-orange-50/60 to-white',
    },
};

const DEFAULT_VISUAL: KpiVisual = {
    Icon: Users,
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
    cardBg: 'bg-white',
};

const formatValue = (k: DashboardKpi): string => {
    if (k.format === 'currency') {
        try {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
                notation: k.value >= 100000 ? 'compact' : 'standard',
            }).format(k.value);
        } catch {
            return `₹${k.value.toLocaleString('en-IN')}`;
        }
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
    const { data, isLoading, isError } = useQuery(getDashboardKpisQuery({ instituteId, roles }));

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
                  : 'grid-cols-2 sm:grid-cols-3';

    return (
        <div className={`grid gap-3 ${cols}`}>
            {items.map((k, i) => {
                if (!k) {
                    return (
                        <Card key={i} className="bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="size-9 rounded-xl" />
                            </div>
                            <Skeleton className="mt-3 h-7 w-24" />
                            <Skeleton className="mt-2 h-2.5 w-28" />
                        </Card>
                    );
                }
                const v = VISUALS[k.id] || DEFAULT_VISUAL;
                const Icon = v.Icon;
                const clickable = !!k.deepLink;
                return (
                    <button
                        key={k.id}
                        type="button"
                        onClick={() => k.deepLink && navigate({ to: k.deepLink })}
                        disabled={!clickable}
                        className="group text-left disabled:cursor-default"
                    >
                        <Card
                            className={`relative h-full overflow-hidden p-4 shadow-sm transition-all ${v.cardBg} ${
                                clickable
                                    ? 'group-hover:-translate-y-0.5 group-hover:shadow-md'
                                    : ''
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                                        {k.label}
                                    </div>
                                </div>
                                <span
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${v.iconBg}`}
                                >
                                    <Icon size={18} weight="duotone" className={v.iconColor} />
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-2xl font-semibold tabular-nums text-neutral-900 sm:text-[26px]">
                                    {formatValue(k)}
                                </span>
                            </div>
                            {k.subtitle && (
                                <div className="mt-1 flex items-center justify-between gap-2">
                                    <span className="line-clamp-1 text-[11px] text-neutral-500">
                                        {k.subtitle}
                                    </span>
                                    {clickable && (
                                        <CaretRight
                                            size={12}
                                            className="shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500"
                                        />
                                    )}
                                </div>
                            )}
                        </Card>
                    </button>
                );
            })}
        </div>
    );
}
