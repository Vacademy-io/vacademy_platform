import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    PaperPlaneTilt,
    Eye,
    CursorClick,
    Warning,
    ArrowFatDown,
    Stack,
    CheckCircle,
} from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { HubOverview, HubEmailEventType } from '../../-services/hub-api';

interface Props {
    overview: HubOverview | null;
    loading: boolean;
    /** Opens the drill-down list for an email stat (delivered/opened/clicked/bounced). */
    onEmailStatClick?: (eventType: HubEmailEventType) => void;
}

interface Stat {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    tone?: 'default' | 'muted' | 'warn' | 'good';
    onClick?: () => void;
}

export function StatsCards({ overview, loading, onEmailStatClick }: Props) {
    const { t, i18n } = useTranslation('communicationStatsCards');

    if (loading && !overview) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
            </div>
        );
    }

    if (!overview) {
        return (
            <Card>
                <CardContent className="py-6 text-center text-sm text-gray-500">
                    {t('couldNotLoad')}
                </CardContent>
            </Card>
        );
    }

    const email = overview.email;
    const wa = overview.whatsapp;
    const batches = overview.batches;

    const drill = (eventType: HubEmailEventType) =>
        onEmailStatClick ? () => onEmailStatClick(eventType) : undefined;

    const emailStats: Stat[] = [
        { label: t('emailStats.sent'), value: email.sent, icon: <PaperPlaneTilt size={18} />, tone: 'default' },
        { label: t('emailStats.delivered'), value: email.delivered, icon: <CheckCircle size={18} />, tone: 'good', onClick: drill('DELIVERY') },
        { label: t('emailStats.opened'), value: email.opened, icon: <Eye size={18} />, tone: 'default', onClick: drill('OPEN') },
        { label: t('emailStats.clicked'), value: email.clicked, icon: <CursorClick size={18} />, tone: 'default', onClick: drill('CLICK') },
        { label: t('emailStats.bounced'), value: email.bounced, icon: <Warning size={18} />, tone: 'warn', onClick: drill('BOUNCE') },
        { label: t('emailStats.inbound'), value: email.inbound, icon: <ArrowFatDown size={18} />, tone: 'default' },
    ];

    const waStats: Stat[] = [
        { label: t('waStats.out'), value: wa.outgoing, icon: <PaperPlaneTilt size={18} />, tone: 'default' },
        { label: t('waStats.in'), value: wa.incoming, icon: <ArrowFatDown size={18} />, tone: 'default' },
    ];

    return (
        <div className="space-y-4">
            <Section
                title={t('sections.email')}
                subtitle={
                    !email.configured
                        ? t('emailSubtitle.notConfigured')
                        : email.inboundConfigured
                          ? t('emailSubtitle.fullyConfigured')
                          : t('emailSubtitle.senderOnly')
                }
                stats={emailStats}
                muted={!email.configured}
                t={t}
                locale={i18n.language}
            />

            <Section
                title={t('sections.whatsapp')}
                subtitle={
                    wa.configured
                        ? t('waSubtitle.connected')
                        : t('waSubtitle.notConfigured')
                }
                stats={waStats}
                muted={!wa.configured}
                t={t}
                locale={i18n.language}
            />

            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label={t('activeBatches')}
                    value={batches.active}
                    icon={<Stack size={18} />}
                    tone={batches.active > 0 ? 'good' : 'muted'}
                    t={t}
                    locale={i18n.language}
                />
                <StatCard
                    label={t('batchesCompleted', { count: overview.windowDays })}
                    value={batches.completedInWindow}
                    icon={<CheckCircle size={18} />}
                    t={t}
                    locale={i18n.language}
                />
            </div>
        </div>
    );
}

function Section({
    title,
    subtitle,
    stats,
    muted,
    t,
    locale,
}: {
    title: string;
    subtitle: string;
    stats: Stat[];
    muted?: boolean;
    t: TFunction;
    locale: string;
}) {
    return (
        <div className={muted ? 'opacity-70' : ''}>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
                <p className="text-xs text-gray-400">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.map((s) => (
                    <StatCard key={s.label} {...s} t={t} locale={locale} />
                ))}
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    tone = 'default',
    onClick,
    t,
    locale,
}: Stat & { t: TFunction; locale: string }) {
    const toneClasses: Record<NonNullable<Stat['tone']>, string> = {
        default: 'text-gray-700',
        muted: 'text-gray-400',
        warn: 'text-amber-600',
        good: 'text-green-600',
    };
    const body = (
        <>
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{label}</span>
                <span className={toneClasses[tone]}>{icon}</span>
            </div>
            <div className={`mt-1 text-xl font-semibold ${toneClasses[tone]}`}>
                {typeof value === 'number' ? value.toLocaleString(locale) : value}
            </div>
        </>
    );
    return (
        <Card
            className={cn(
                'rounded-lg border-gray-200',
                onClick &&
                    'cursor-pointer transition hover:border-primary-300 hover:shadow-sm focus-within:ring-2 focus-within:ring-primary-500'
            )}
        >
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    className="w-full text-start focus:outline-none"
                    title={t('viewStat', { label: label.toLowerCase() })}
                >
                    <CardContent className="p-3">{body}</CardContent>
                </button>
            ) : (
                <CardContent className="p-3">{body}</CardContent>
            )}
        </Card>
    );
}
