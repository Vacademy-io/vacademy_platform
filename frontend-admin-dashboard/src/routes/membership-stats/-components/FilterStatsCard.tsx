import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { fetchMembershipStats, getMembershipStatsQueryKey } from '@/services/membership-stats';
import type { StudentStatsFilter } from '@/types/membership-stats';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface FilterStatsCardProps {
    requestFilters: Omit<StudentStatsFilter, 'institute_id'>;
    onViewMembers: () => void;
}

export function FilterStatsCard({ requestFilters, onViewMembers }: FilterStatsCardProps) {
    // Fetch count for the current filters
    const { data, isLoading } = useQuery({
        queryKey: getMembershipStatsQueryKey(0, 1, requestFilters), // pageSize=1 just to get total_elements
        queryFn: () => fetchMembershipStats(0, 1, requestFilters),
        staleTime: 30000,
    });

    return (
        <Card className="border-primary-100 bg-primary-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-primary-900">
                        Selected Range Statistics
                    </CardTitle>
                    <p className="text-sm text-primary-600/80">
                        Based on your current filters
                    </p>
                </div>
                <div className="rounded-full bg-primary-100 p-2 text-primary-600">
                    <Users size={20} weight="duotone" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between">
                    <div>
                        {isLoading ? (
                            <div className="h-8 w-16 animate-pulse rounded bg-primary-100" />
                        ) : (
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-primary-900">
                                    {data?.total_elements?.toLocaleString() || 0}
                                </span>
                                <span className="text-sm font-medium text-primary-600">users found</span>
                            </div>
                        )}
                    </div>
                    <Button
                        onClick={onViewMembers}
                        className="gap-2"
                        disabled={isLoading}
                    >
                        View Members
                        <ArrowRight size={16} />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
