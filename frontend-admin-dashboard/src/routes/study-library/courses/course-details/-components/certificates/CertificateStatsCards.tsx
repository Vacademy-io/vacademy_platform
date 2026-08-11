import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Certificate,
    ChartLineUp,
    Clock,
    HourglassMedium,
    Users,
} from '@phosphor-icons/react';
import type { CourseCertificateDashboard } from '../../-services/course-certificates';

interface CertificateStatsCardsProps {
    data: CourseCertificateDashboard | undefined;
    isLoading: boolean;
}

export const CertificateStatsCards = ({ data, isLoading }: CertificateStatsCardsProps) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-12" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!data) return null;

    const threshold = data.threshold_percent;
    // The "close to the threshold" band the spec asked for: within 10 points
    // below the bar, e.g. 70-79 when the threshold is 80.
    const nearFloor = Math.max(0, threshold - 10);

    const cards = [
        {
            title: 'Total Enrolled',
            value: data.total_enrolled,
            subtitle: 'Learners in this batch',
            icon: <Users className="size-5 text-neutral-500" />,
        },
        {
            title: 'Certificates Generated',
            value: data.certificates_generated,
            subtitle: 'Issued so far',
            icon: <Certificate className="size-5 text-success-500" />,
        },
        {
            title: 'Certificates Pending',
            value: data.certificates_pending,
            subtitle: 'Not yet issued',
            icon: <Clock className="size-5 text-neutral-500" />,
        },
        {
            title: 'Awaiting Generation',
            value: data.completed_awaiting_certificate,
            subtitle: `Past ${threshold}%, no certificate`,
            icon: <HourglassMedium className="size-5 text-warning-500" />,
        },
        {
            title: 'Close to Threshold',
            value: data.near_threshold,
            subtitle: `${nearFloor}–${threshold - 1}% complete`,
            icon: <ChartLineUp className="size-5 text-info-500" />,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-caption font-medium text-neutral-500">
                            {card.title}
                        </CardTitle>
                        {card.icon}
                    </CardHeader>
                    <CardContent>
                        <div className="text-h3 font-semibold text-neutral-700">{card.value}</div>
                        <p className="text-caption text-neutral-400">{card.subtitle}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
