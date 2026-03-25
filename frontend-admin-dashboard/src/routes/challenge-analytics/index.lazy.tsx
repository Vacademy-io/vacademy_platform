import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';

// Hooks
import { useOutgoingTemplates } from './-hooks/useOutgoingTemplates';
import {
    useCenterHeatmap,
    useDailyParticipation,
    useEngagementLeaderboard,
    useCompletionCohort,
    useCampaigns,
} from './-hooks/useAnalyticsData';
import { challengeAnalyticsKeys } from '@/services/challenge-analytics';

// Components
import { AnalyticsFilters } from './-components/AnalyticsFilters';
import { KPICards } from './-components/KPICards';
import { CenterHeatmap } from './-components/CenterHeatmap';
import { DailyParticipation } from './-components/DailyParticipation';
import { ChurnAnalysis } from './-components/ChurnAnalysis';
import { ReferralTracking } from './-components/ReferralTracking';
import { EngagementLeaderboard } from './-components/EngagementLeaderboard';
import { CompletionCohort } from './-components/CompletionCohort';
import { TemplateAnalytics } from './-components/TemplateAnalytics';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ChartLineUp,
    Users,
    Trophy,
    GraduationCap,
    MapPin,
    Warning,
    Share,
    Sparkle,
    ChartBar,
} from '@phosphor-icons/react';

export const Route = createLazyFileRoute('/challenge-analytics/')({
    component: () => (
        <LayoutContainer>
            <ChallengeAnalyticsDashboard />
        </LayoutContainer>
    ),
});

function ChallengeAnalyticsDashboard() {
    const { setNavHeading } = useNavHeadingStore();
    const queryClient = useQueryClient();

    // State for date range
    const [startDate, setStartDate] = useState(() => {
        const start = subDays(new Date(), 30);
        return format(start, "yyyy-MM-dd'T'HH:mm:ss");
    });
    const [endDate, setEndDate] = useState(() => {
        return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
    });

    // State for selected templates (for completion cohort)
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

    // Pagination state
    const [leaderboardPage, setLeaderboardPage] = useState(1);
    const [cohortPage, setCohortPage] = useState(1);

    // Active tab
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <Sparkle className="text-primary size-5" weight="fill" />
                <h1 className="text-lg font-semibold">Challenge Analytics Dashboard</h1>
            </div>
        );
    }, [setNavHeading]);

    // Fetch outgoing templates first
    const { data: templatesData, isLoading: templatesLoading } = useOutgoingTemplates();

    // Fetch data based on active tab (lazy loading)
    const { data: participationData, isLoading: participationLoading } = useDailyParticipation(
        startDate,
        endDate,
        activeTab === 'overview' ||
            activeTab === 'participation' ||
            activeTab === 'churn' ||
            activeTab === 'templates'
    );

    const { data: heatmapData, isLoading: heatmapLoading } = useCenterHeatmap(
        startDate,
        endDate,
        activeTab === 'centers'
    );

    const { data: leaderboardData, isLoading: leaderboardLoading } = useEngagementLeaderboard(
        startDate,
        endDate,
        leaderboardPage,
        20,
        activeTab === 'leaderboard'
    );

    const { data: cohortData, isLoading: cohortLoading } = useCompletionCohort(
        startDate,
        endDate,
        selectedTemplates,
        cohortPage,
        50,
        activeTab === 'cohort' && selectedTemplates.length > 0
    );

    const { data: referralCampaigns, isLoading: referralLoading } = useCampaigns(
        'REFERRAL',
        undefined,
        0,
        100,
        activeTab === 'referral'
    );

    const { data: organicCampaigns, isLoading: organicLoading } = useCampaigns(
        'ORGANIC,WEBSITE',
        undefined,
        0,
        100,
        activeTab === 'referral'
    );

    // Templates list
    const templatesList = useMemo(() => templatesData?.days || [], [templatesData]);

    // Calculate KPI values
    const kpiValues = useMemo(() => {
        const participation = participationData?.daily_participation;
        const summary = participation?.summary;

        return {
            activeUsers: summary?.total_unique_users_responded || 0,
            totalUsersReached: summary?.total_unique_users_reached || 0,
            totalMessages:
                (participation?.total_messages_sent || 0) +
                (participation?.total_messages_received || 0),
            completionRate:
                cohortData?.completion_summary?.total_completed_users &&
                summary?.total_unique_users_reached
                    ? (cohortData.completion_summary.total_completed_users /
                          summary.total_unique_users_reached) *
                      100
                    : 0,
            responseRate: summary?.overall_response_rate || 0,
            totalDays: participation?.total_days || 0,
        };
    }, [participationData, cohortData]);

    // Refresh all data
    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: challengeAnalyticsKeys.all });
    }, [queryClient]);

    // Reset pagination when date range changes
    useEffect(() => {
        setLeaderboardPage(1);
        setCohortPage(1);
    }, [startDate, endDate]);

    // Auto-select last day's completion templates for cohort
    useEffect(() => {
        if (templatesList.length > 0 && selectedTemplates.length === 0) {
            const lastDay = templatesList[templatesList.length - 1];
            if (lastDay && lastDay.templates.length > 0) {
                setSelectedTemplates(lastDay.templates.map((t) => t.template_identifier));
            }
        }
    }, [templatesList, selectedTemplates.length]);

    const isAnyLoading = templatesLoading || heatmapLoading || participationLoading;

    if (templatesLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <DashboardLoader />
                    <p className="mt-4 text-sm text-gray-500">Loading analytics templates...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Challenge Analytics Dashboard | Vacademy</title>
                <meta
                    name="description"
                    content="Track parent engagement across challenge programs with actionable insights"
                />
            </Helmet>

            <div className="space-y-6 p-4 text-sm">
                {/* Filters */}
                <AnalyticsFilters
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    templates={templatesList}
                    selectedTemplates={selectedTemplates}
                    onTemplatesChange={setSelectedTemplates}
                    isLoading={isAnyLoading}
                    onRefresh={handleRefresh}
                />

                {/* KPI Cards */}
                <KPICards
                    activeUsers={kpiValues.activeUsers}
                    totalUsersReached={kpiValues.totalUsersReached}
                    totalMessages={kpiValues.totalMessages}
                    completionRate={kpiValues.completionRate}
                    responseRate={kpiValues.responseRate}
                    totalDays={kpiValues.totalDays}
                    isLoading={participationLoading}
                />

                {/* Main Content Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:gap-1">
                        <TabsTrigger value="overview" className="gap-2">
                            <ChartLineUp className="size-4" />
                            <span className="hidden sm:inline">Overview</span>
                        </TabsTrigger>
                        <TabsTrigger value="centers" className="gap-2">
                            <MapPin className="size-4" />
                            <span className="hidden sm:inline">Centers</span>
                        </TabsTrigger>
                        <TabsTrigger value="participation" className="gap-2">
                            <Users className="size-4" />
                            <span className="hidden sm:inline">Participation</span>
                        </TabsTrigger>
                        <TabsTrigger value="churn" className="gap-2">
                            <Warning className="size-4" />
                            <span className="hidden sm:inline">Churn</span>
                        </TabsTrigger>
                        <TabsTrigger value="referral" className="gap-2">
                            <Share className="size-4" />
                            <span className="hidden sm:inline">Referrals</span>
                        </TabsTrigger>
                        <TabsTrigger value="leaderboard" className="gap-2">
                            <Trophy className="size-4" />
                            <span className="hidden sm:inline">Leaderboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="cohort" className="gap-2">
                            <GraduationCap className="size-4" />
                            <span className="hidden sm:inline">Completions</span>
                        </TabsTrigger>
                        <TabsTrigger value="templates" className="gap-2">
                            <ChartBar className="size-4" />
                            <span className="hidden sm:inline">Templates</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <DailyParticipation
                            data={participationData}
                            isLoading={participationLoading}
                        />
                    </TabsContent>

                    {/* Centers Tab */}
                    <TabsContent value="centers">
                        <CenterHeatmap data={heatmapData} isLoading={heatmapLoading} />
                    </TabsContent>

                    {/* Participation Tab */}
                    <TabsContent value="participation">
                        <DailyParticipation
                            data={participationData}
                            isLoading={participationLoading}
                        />
                    </TabsContent>

                    {/* Templates Tab */}
                    <TabsContent value="templates">
                        <TemplateAnalytics
                            data={participationData}
                            isLoading={participationLoading}
                        />
                    </TabsContent>

                    {/* Churn Tab */}
                    <TabsContent value="churn">
                        <ChurnAnalysis data={participationData} isLoading={participationLoading} />
                    </TabsContent>

                    {/* Referral Tab */}
                    <TabsContent value="referral">
                        <ReferralTracking
                            referralData={referralCampaigns}
                            organicData={organicCampaigns}
                            isLoading={referralLoading || organicLoading}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    </TabsContent>

                    {/* Leaderboard Tab */}
                    <TabsContent value="leaderboard">
                        <EngagementLeaderboard
                            data={leaderboardData}
                            isLoading={leaderboardLoading}
                            page={leaderboardPage}
                            onPageChange={setLeaderboardPage}
                        />
                    </TabsContent>

                    {/* Cohort Tab */}
                    <TabsContent value="cohort">
                        <CompletionCohort
                            data={cohortData}
                            isLoading={cohortLoading}
                            page={cohortPage}
                            onPageChange={setCohortPage}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
