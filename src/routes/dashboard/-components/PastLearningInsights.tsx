// import { DashboardLoader } from "@/components/core/dashboard-loader";
import { usePastLearningInsights } from "../-hooks/usePastLearningInsights";
import { LineChartComponent } from "./LineChartComponent";
import { StudentProgressTable } from "./StudentProgressTable";
import { useEffect, useState } from "react";
import { getStoredDetails } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis } from "@/helpers/formatTimeFromMiliseconds";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Zap, Target, Award, TrendingUp } from "lucide-react";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";

// Enhanced Loading Skeleton
const AnalyticsLoadingSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="border rounded-lg p-5 flex flex-col sm:flex-row justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="w-48 h-5 bg-muted rounded animate-pulse" />
          <div className="w-32 h-4 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="w-24 h-8 bg-muted rounded animate-pulse" />
    </div>

    {/* Chart Skeleton */}
    <div className="border rounded-lg p-5 space-y-4">
      <div className="w-40 h-6 bg-muted rounded animate-pulse" />
      <div className="w-full h-64 bg-muted rounded-lg animate-pulse" />
    </div>

    {/* Table Skeleton */}
    <div className="border rounded-lg space-y-4 p-5">
      <div className="w-48 h-6 bg-muted rounded animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Enhanced StatsCard Component
const StatsCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendColor,
  description,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  trend?: string;
  trendColor?: string;
  description: string;
}) => {
  return (
    <Card className="shadow-none hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <Icon size={18} />
          </div>
          {trend && (
            <Badge
              variant="secondary"
              className={`${trendColor || 'bg-secondary text-secondary-foreground'} border-0 px-2 py-0.5`}
            >
              {trend}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">
            {value}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export const PastLearningInsights = () => {
  const { mutate: pastLearningInsights, isPending } = usePastLearningInsights();
  const [userActivity, setUserActivity] = useState<UserActivityArray>([]);
  const [avgTimeSpent, setAvgTimeSpent] = useState<string>("0");
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);

  useEffect(() => {
    const fetchUserActivity = async () => {
      const { student } = await getStoredDetails();
      pastLearningInsights(
        {
          user_id: student.user_id,
          start_date: new Date(
            new Date().setDate(new Date().getDate() - 6)
          ).toISOString(),
          end_date: new Date().toISOString(),
        },
        {
          onSuccess: (data) => {
            setUserActivity(data);

            if (data.length > 0) {
              // Calculate average time spent
              const totalMillis = data.reduce(
                (acc, curr) => acc + curr.time_spent_by_user_millis,
                0
              );
              const avgMillis = totalMillis / data.length;
              setAvgTimeSpent(formatTimeFromMillis(avgMillis));

              // Calculate total sessions
              const sessions = data.filter(
                (day) => day.time_spent_by_user_millis > 0
              ).length;
              setTotalSessions(sessions);

              // Calculate streak (consecutive days with activity)
              let streak = 0;
              const sortedData = [...data].sort(
                (a, b) =>
                  new Date(b.activity_date).getTime() -
                  new Date(a.activity_date).getTime()
              );
              for (const day of sortedData) {
                if (day.time_spent_by_user_millis > 0) {
                  streak++;
                } else {
                  break;
                }
              }
              setStreakDays(streak);
            }
          },
          onError: (error) => {
            console.error(error);
          },
        }
      );
    };
    fetchUserActivity();
  }, []);

  if (isPending) return <AnalyticsLoadingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Enhanced Header Section */}
      <Card className="shadow-none border-none bg-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Learning Analytics</h2>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <BarChart3 size={14} />
                <span className="text-sm">Past 7 days performance insights</span>
              </div>
            </div>
          </div>

          <Badge variant="outline" className="w-fit text-primary border-primary/20 gap-1.5 py-1.5 px-3 h-auto">
            <Zap size={14} />
            Live Analytics
          </Badge>
        </div>
      </Card>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Average Study Time"
          value={avgTimeSpent}
          icon={Clock}
          description="Daily learning average"
        />
        <StatsCard
          title={`Active ${getTerminology(
            ContentTerms.LiveSession,
            SystemTerms.LiveSession
          )}s`}
          value={totalSessions.toString()}
          icon={Target}
          trend={totalSessions >= 4 ? "+12%" : ""}
          trendColor={
            totalSessions >= 4 ? "bg-green-500/10 text-green-600" : ""
          }
          description={`Learning ${getTerminology(
            ContentTerms.LiveSession,
            SystemTerms.LiveSession
          ).toLocaleLowerCase()}s this week`}
        />
        <StatsCard
          title="Learning Streak"
          value={`${streakDays} day${streakDays !== 1 ? "s" : ""}`}
          icon={Award}
          trend={streakDays >= 3 ? "🔥" : ""}
          trendColor="bg-orange-500/10 text-orange-600"
          description="Consecutive learning days"
        />
      </div>

      {/* Enhanced Chart Section */}
      <Card className="shadow-none">
        <CardHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Activity Trend</CardTitle>
              <CardDescription>Daily study time comparison with batch average</CardDescription>
            </div>
            <Badge variant="secondary" className="font-normal">7 Days</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <LineChartComponent userActivity={userActivity} />
        </CardContent>
      </Card>

      {/* Enhanced Table Section */}
      <Card className="shadow-none">
        <CardHeader className="border-b px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Daily Progress</CardTitle>
            <CardDescription>Detailed breakdown of your learning sessions</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1.5 border-green-500/20 text-green-600 bg-green-500/5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Updated
          </Badge>
        </CardHeader>

        <CardContent className="p-6">
          <StudentProgressTable userActivity={userActivity} />
        </CardContent>
      </Card>
    </div>
  );
};

