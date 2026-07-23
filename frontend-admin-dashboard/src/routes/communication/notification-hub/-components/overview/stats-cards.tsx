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
                    Could not load notification stats.
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
        { label: 'Emails sent', value: email.sent, icon: <PaperPlaneTilt size={18} />, tone: 'default' },
        { label: 'Delivered', value: email.delivered, icon: <CheckCircle size={18} />, tone: 'good', onClick: drill('DELIVERY') },
        { label: 'Opened', value: email.opened, icon: <Eye size={18} />, tone: 'default', onClick: drill('OPEN') },
        { label: 'Clicked', value: email.clicked, icon: <CursorClick size={18} />, tone: 'default', onClick: drill('CLICK') },
        { label: 'Bounced', value: email.bounced, icon: <Warning size={18} />, tone: 'warn', onClick: drill('BOUNCE') },
        { label: 'Inbound replies', value: email.inbound, icon: <ArrowFatDown size={18} />, tone: 'default' },
    ];

    const waStats: Stat[] = [
        { label: 'WhatsApp out', value: wa.outgoing, icon: <PaperPlaneTilt size={18} />, tone: 'default' },
        { label: 'WhatsApp in', value: wa.incoming, icon: <ArrowFatDown size={18} />, tone: 'default' },
    ];

    return (
        <div className="space-y-4">
            <Section
                title="Email"
                subtitle={
                    !email.configured
                        ? 'No sender email configured for this institute.'
                        : email.inboundConfigured
                          ? 'Sender + inbound inbox configured.'
                          : 'Sender configured. Inbound replies not yet enabled.'
                }
                stats={emailStats}
                muted={!email.configured}
            />

            <Section
                title="WhatsApp"
                subtitle={
                    wa.configured
                        ? 'WhatsApp business channel connected.'
                        : 'No WhatsApp channel mapped to this institute.'
                }
                stats={waStats}
                muted={!wa.configured}
            />

            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label="Active batches"
                    value={batches.active}
                    icon={<Stack size={18} />}
                    tone={batches.active > 0 ? 'good' : 'muted'}
                />
                <StatCard
                    label={`Batches completed (${overview.windowDays}d)`}
                    value={batches.completedInWindow}
                    icon={<CheckCircle size={18} />}
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
}: {
    title: string;
    subtitle: string;
    stats: Stat[];
    muted?: boolean;
}) {
    return (
        <div className={muted ? 'opacity-70' : ''}>
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
                <p className="text-xs text-gray-400">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.map((s) => (
                    <StatCard key={s.label} {...s} />
                ))}
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, tone = 'default', onClick }: Stat) {
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
                {typeof value === 'number' ? value.toLocaleString() : value}
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
                    className="w-full text-left focus:outline-none"
                    title={`View ${label.toLowerCase()}`}
                >
                    <CardContent className="p-3">{body}</CardContent>
                </button>
            ) : (
                <CardContent className="p-3">{body}</CardContent>
            )}
        </Card>
    );
}
