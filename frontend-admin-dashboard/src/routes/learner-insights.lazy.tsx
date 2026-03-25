import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { useSuspenseQuery } from '@tanstack/react-query';

// Analytics Widgets
import RealTimeActiveUsersWidget from './dashboard/-components/analytics-widgets/RealTimeActiveUsersWidget';
import CurrentlyActiveUsersWidget from './dashboard/-components/analytics-widgets/CurrentlyActiveUsersWidget';
import UserActivitySummaryWidget from './dashboard/-components/analytics-widgets/UserActivitySummaryWidget';
import DailyActivityTrendWidget from './dashboard/-components/analytics-widgets/DailyActivityTrendWidget';
import HourlyActivityWidget from './dashboard/-components/analytics-widgets/HourlyActivityWidget';
import MostActiveUsersWidget from './dashboard/-components/analytics-widgets/MostActiveUsersWidget';
import DeviceUsageWidget from './dashboard/-components/analytics-widgets/DeviceUsageWidget';
import ServiceUsageWidget from './dashboard/-components/analytics-widgets/ServiceUsageWidget';

export const Route = createLazyFileRoute('/learner-insights')({
    component: LearnerInsightsPage,
});

function LearnerInsightsPage() {
    return (
        <LayoutContainer>
            <LearnerInsightsComponent />
        </LayoutContainer>
    );
}

function LearnerInsightsComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());

    useEffect(() => {
        setNavHeading(<h1 className="text-md font-medium">Learner Live Activities</h1>);
    }, [setNavHeading]);

    return (
        <>
            <Helmet>
                <title>Learner Live Activities</title>
                <meta
                    name="description"
                    content="Real-time analytics and insights about learner activities and engagement."
                />
            </Helmet>

            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">Learner Live Activities</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Monitor real-time learner engagement and activity patterns across your
                    institute.
                </p>
            </div>

            {/* Analytics Dashboard */}
            <div className="flex w-full flex-col gap-6">
                {/* Real-time Overview */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <RealTimeActiveUsersWidget instituteId={instituteDetails?.id || ''} />
                    <CurrentlyActiveUsersWidget instituteId={instituteDetails?.id || ''} />
                    <UserActivitySummaryWidget instituteId={instituteDetails?.id || ''} />
                </div>

                {/* Activity Trends */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <DailyActivityTrendWidget instituteId={instituteDetails?.id || ''} />
                    <HourlyActivityWidget instituteId={instituteDetails?.id || ''} />
                </div>

                {/* User Insights */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <MostActiveUsersWidget instituteId={instituteDetails?.id || ''} />
                    <DeviceUsageWidget instituteId={instituteDetails?.id || ''} />
                </div>

                {/* Service Analytics */}
                <div className="grid grid-cols-1 gap-6">
                    <ServiceUsageWidget instituteId={instituteDetails?.id || ''} />
                </div>
            </div>
        </>
    );
}
