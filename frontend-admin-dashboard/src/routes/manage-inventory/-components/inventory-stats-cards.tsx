import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertCircle,
    AlertTriangle,
    Infinity as InfinityIcon,
    TrendingUp,
    Users,
} from 'lucide-react';
import { PackageSessionInventory } from '../-types/inventory-types';

interface InventoryStatsCardsProps {
    inventoryItems: PackageSessionInventory[];
    isLoading: boolean;
}

export const InventoryStatsCards = ({ inventoryItems, isLoading }: InventoryStatsCardsProps) => {
    const stats = useMemo(() => {
        const result = {
            totalSessions: inventoryItems.length,
            unlimitedSessions: 0,
            limitedSessions: 0,
            lowAvailabilitySessions: 0,
            criticalAvailabilitySessions: 0,
            totalCapacity: 0,
            totalAvailable: 0,
        };

        inventoryItems.forEach((item) => {
            if (item.isUnlimited) {
                result.unlimitedSessions++;
            } else if (item.maxSeats !== undefined) {
                result.limitedSessions++;
                result.totalCapacity += item.maxSeats || 0;
                result.totalAvailable += item.availableSlots || 0;

                // Check availability levels
                if (
                    item.maxSeats &&
                    item.availableSlots !== undefined &&
                    item.availableSlots !== null
                ) {
                    const percentage = ((item.availableSlots ?? 0) / item.maxSeats) * 100;
                    if (percentage <= 10 && percentage >= 0) {
                        result.criticalAvailabilitySessions++;
                    } else if (percentage <= 20 && percentage > 10) {
                        result.lowAvailabilitySessions++;
                    }
                }
            }
        });

        return result;
    }, [inventoryItems]);

    const statCards = [
        {
            title: 'Total Sessions',
            value: stats.totalSessions,
            subtitle: 'Package sessions',
            icon: Users,
            gradient: 'from-blue-500 to-cyan-500',
            bgGradient: 'from-blue-500/10 to-cyan-500/10',
        },
        {
            title: 'Unlimited',
            value: stats.unlimitedSessions,
            subtitle: 'No capacity limit',
            icon: InfinityIcon,
            gradient: 'from-emerald-500 to-teal-500',
            bgGradient: 'from-emerald-500/10 to-teal-500/10',
        },
        {
            title: 'Total Capacity',
            value: stats.totalCapacity.toLocaleString(),
            subtitle: `${stats.totalAvailable.toLocaleString()} available`,
            icon: TrendingUp,
            gradient: 'from-violet-500 to-purple-500',
            bgGradient: 'from-violet-500/10 to-purple-500/10',
        },
        {
            title: 'Critical',
            value: stats.criticalAvailabilitySessions,
            subtitle: '< 10% remaining',
            icon: AlertCircle,
            gradient: 'from-red-500 to-rose-600',
            bgGradient: 'from-red-500/10 to-rose-600/10',
            critical: stats.criticalAvailabilitySessions > 0,
        },
        {
            title: 'Low Availability',
            value: stats.lowAvailabilitySessions,
            subtitle: '10-20% remaining',
            icon: AlertTriangle,
            gradient: 'from-orange-500 to-amber-500',
            bgGradient: 'from-orange-500/10 to-amber-500/10',
            warning: stats.lowAvailabilitySessions > 0,
        },
    ];

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="overflow-hidden">
                        <CardContent className="p-6">
                            <Skeleton className="mb-2 h-4 w-24" />
                            <Skeleton className="mb-1 h-8 w-16" />
                            <Skeleton className="h-3 w-20" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {statCards.map((stat, index) => {
                const isCritical = 'critical' in stat && stat.critical;
                const isWarning = 'warning' in stat && stat.warning;

                return (
                    <Card
                        key={index}
                        className={`overflow-hidden border-0 bg-gradient-to-br shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${stat.bgGradient} ${isCritical ? 'animate-pulse ring-2 ring-red-500/50' : ''}`}
                    >
                        <CardContent className="p-6">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    {stat.title}
                                </span>
                                <div
                                    className={`rounded-lg bg-gradient-to-br p-2 shadow-md ${stat.gradient}`}
                                >
                                    <stat.icon className="size-4 text-white" />
                                </div>
                            </div>
                            <div
                                className={`mb-1 text-3xl font-bold ${
                                    isCritical
                                        ? 'text-red-600 dark:text-red-400'
                                        : isWarning
                                          ? 'text-orange-600 dark:text-orange-400'
                                          : 'text-foreground'
                                }`}
                            >
                                {stat.value}
                            </div>
                            <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
