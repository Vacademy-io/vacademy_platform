import { useSuspenseQuery } from '@tanstack/react-query';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowSquareOut, Info } from '@phosphor-icons/react';
import { useRouter } from '@tanstack/react-router';
import { getUnresolvedDoubtsCount } from '../-services/dashboard-services';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

interface UnresolvedDoubtsWidgetProps {
    instituteId: string;
}

export const UnresolvedDoubtsWidget = ({ instituteId }: UnresolvedDoubtsWidgetProps) => {
    const router = useRouter();
    const { instituteDetails } = useInstituteDetailsStore();

    // Get all batch IDs from institute details
    const batchIds = instituteDetails?.batches_for_sessions.map((batch) => batch.id) || [];

    const { data: doubtsData } = useSuspenseQuery(getUnresolvedDoubtsCount(instituteId, batchIds));

    const handleNavigateToDoubts = () => {
        router.navigate({
            to: '/study-library/doubt-management',
        });
    };

    // Always render the widget, but with different content based on doubt status
    const hasDoubts = doubtsData.hasUnresolvedDoubts;

    return (
        <Card
            className={`grow shadow-none transition-all ${
                hasDoubts
                    ? 'cursor-pointer border-orange-200 bg-orange-50 hover:scale-[1.01] hover:shadow-md'
                    : 'border-neutral-200 bg-neutral-50'
            }`}
            onClick={hasDoubts ? handleNavigateToDoubts : undefined}
        >
            <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                    <CardTitle
                        className={`flex items-center gap-2 text-sm font-semibold ${
                            hasDoubts ? 'text-orange-800' : 'text-neutral-700'
                        }`}
                    >
                        <Info
                            size={18}
                            weight={hasDoubts ? 'fill' : 'duotone'}
                            className={hasDoubts ? 'text-orange-600' : 'text-neutral-500'}
                        />
                        Unresolved Doubts
                    </CardTitle>
                    {hasDoubts && <ArrowSquareOut size={16} className="text-orange-500" />}
                </div>
                <CardDescription
                    className={`mt-1 text-xs ${hasDoubts ? 'text-orange-700' : 'text-neutral-600'}`}
                >
                    {hasDoubts ? (
                        <>
                            You have{' '}
                            <span className="font-semibold text-orange-800">
                                {doubtsData.count}
                            </span>{' '}
                            unresolved
                            {doubtsData.count === 1 ? ' doubt' : ' doubts'} from the last 7 days
                            that need attention.
                        </>
                    ) : (
                        'All doubts have been resolved. Great work!'
                    )}
                </CardDescription>
                {hasDoubts && (
                    <div className="mt-3 flex items-center gap-2">
                        <div className="size-2 animate-pulse rounded-full bg-orange-500"></div>
                        <span className="text-xs font-medium text-orange-600">Requires Action</span>
                    </div>
                )}
            </CardHeader>
        </Card>
    );
};
