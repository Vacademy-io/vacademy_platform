import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect } from 'react';

import { motion } from 'framer-motion';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Suspense } from 'react';
import { Helmet } from 'react-helmet';
import { ChartBar } from '@phosphor-icons/react';

// Import analytics widgets
import RealTimeActiveUsersWidget from '../dashboard/-components/analytics-widgets/RealTimeActiveUsersWidget';
import UserActivitySummaryWidget from '../dashboard/-components/analytics-widgets/UserActivitySummaryWidget';
import DailyActivityTrendWidget from '../dashboard/-components/analytics-widgets/DailyActivityTrendWidget';
import HourlyActivityWidget from '../dashboard/-components/analytics-widgets/HourlyActivityWidget';
import CurrentlyActiveUsersWidget from '../dashboard/-components/analytics-widgets/CurrentlyActiveUsersWidget';
import MostActiveUsersWidget from '../dashboard/-components/analytics-widgets/MostActiveUsersWidget';

export const Route = createLazyFileRoute('/learner-insights/')({
    component: LearnerInsightsPage,
});

// Error boundary component
const WidgetErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    return <Suspense fallback={<DashboardLoader />}>{children}</Suspense>;
};

function LearnerInsightsPage() {
    const { setNavHeading } = useNavHeadingStore();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const instituteId = instituteDetails?.id || '';

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <ChartBar size={24} className="text-primary-500" />
                <h1 className="text-lg font-semibold">Learner Insights</h1>
            </div>
        );
    }, [setNavHeading]);

    console.log('LearnerInsightsPage - instituteId:', instituteId);

    return (
        <LayoutContainer>
            <Helmet>
                <title>Learner Insights</title>
                <meta
                    name="description"
                    content="Comprehensive analytics and insights about learner activity and engagement."
                />
            </Helmet>

            <div className="space-y-4 sm:space-y-6">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-2 px-4 text-center sm:px-0"
                >
                    <h1 className="text-xl font-bold text-gray-900 sm:text-2xl lg:text-3xl">
                        Learner Insights Dashboard
                    </h1>
                    <p className="mx-auto max-w-2xl text-sm text-gray-600 sm:text-base">
                        Comprehensive analytics and real-time insights about your learners&apos;
                        activity and engagement
                    </p>
                </motion.div>

                {/* Quick Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-0 lg:grid-cols-2"
                >
                    <WidgetErrorBoundary>
                        <RealTimeActiveUsersWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>

                    <WidgetErrorBoundary>
                        <UserActivitySummaryWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>
                </motion.div>

                {/* Currently Active Users - Full Width */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="px-4 sm:px-0"
                >
                    <WidgetErrorBoundary>
                        <CurrentlyActiveUsersWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>
                </motion.div>

                {/* Secondary Widgets */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="grid grid-cols-1 gap-4 px-4 sm:px-0 md:grid-cols-2"
                >
                    <WidgetErrorBoundary>
                        <DailyActivityTrendWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>

                    <WidgetErrorBoundary>
                        <HourlyActivityWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>
                </motion.div>

                {/* Full Width Widgets */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    className="space-y-4 px-4 sm:space-y-6 sm:px-0"
                >
                    <WidgetErrorBoundary>
                        <CurrentlyActiveUsersWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>

                    <WidgetErrorBoundary>
                        <MostActiveUsersWidget instituteId={instituteId} />
                    </WidgetErrorBoundary>
                </motion.div>
            </div>
        </LayoutContainer>
    );
}
