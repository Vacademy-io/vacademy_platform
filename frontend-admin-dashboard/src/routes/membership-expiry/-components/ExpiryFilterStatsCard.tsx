import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Warning, ArrowRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { fetchMembershipExpiry, getMembershipExpiryQueryKey } from '@/services/membership-expiry';
import type { MembershipFilterDTO } from '@/types/membership-expiry';

interface FilterStatsCardProps {
    requestFilters: Omit<MembershipFilterDTO, 'institute_id'>;
    onViewMembers: () => void;
}

export function ExpiryFilterStatsCard({ requestFilters, onViewMembers }: FilterStatsCardProps) {
    const { data, isLoading } = useQuery({
        queryKey: getMembershipExpiryQueryKey(0, 1, requestFilters),
        queryFn: () => fetchMembershipExpiry(0, 1, requestFilters),
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
                    <Warning size={20} weight="duotone" />
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
                                    {data?.totalElements?.toLocaleString() || 0}
                                </span>
                                <span className="text-sm font-medium text-primary-600">memberships found</span>
                            </div>
                        )}
                    </div>
                    <Button
                        onClick={onViewMembers}
                        className="gap-2"
                        disabled={isLoading}
                    >
                        View List
                        <ArrowRight size={16} />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
