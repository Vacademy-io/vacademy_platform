import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import DashboardAnalyticsWidgets from './DashboardAnalyticsWidgets';

interface UserAnalyticsTabProps {
    existingContent?: React.ReactNode;
}

export default function UserAnalyticsTab({ existingContent }: UserAnalyticsTabProps) {
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const instituteId = instituteDetails?.id || '';

    console.log('UserAnalyticsTab - instituteId:', instituteId);

    return (
        <div className="w-full space-y-6">
            {/* Existing Dashboard Content */}
            {existingContent || (
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle>Dashboard Overview</CardTitle>
                        <CardDescription>
                            All your institute&apos;s key metrics at a glance.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {/* Analytics Widgets Section */}
            <DashboardAnalyticsWidgets />
        </div>
    );
}
