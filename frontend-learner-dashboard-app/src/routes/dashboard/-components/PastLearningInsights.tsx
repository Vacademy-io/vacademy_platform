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
import { BarChart3, Clock, Zap, Target, Award, TrendingUp, BarChart2, Table2 } from "lucide-react";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { cn } from "@/lib/utils";
import { playIllustrations } from "@/assets/play-illustrations";

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

// Compact inline stat
const InlineStat = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}) => (
  <div className="flex items-center gap-2">
    <div className="p-1.5 rounded-lg bg-primary/10 text-primary [.ui-play_&]:bg-white/20 [.ui-play_&]:text-white">
      <Icon size={14} />
    </div>
    <div>
      <span className="text-sm font-bold [.ui-play_&]:text-white">{value}</span>
      <span className="text-xs text-muted-foreground ml-1 [.ui-play_&]:text-white/60">{label}</span>
    </div>
  </div>
);

export const PastLearningInsights = () => {
  const { mutate: pastLearningInsights, isPending } = usePastLearningInsights();
  const [userActivity, setUserActivity] = useState<UserActivityArray>([]);
  const [avgTimeSpent, setAvgTimeSpent] = useState<string>("0");
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [activeView, setActiveView] = useState<"chart" | "table">("chart");

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
    <div className="animate-fade-in-up">
      <Card className={cn(
        "shadow-none relative overflow-hidden",
        "[.ui-vibrant_&]:bg-blue-50/50 dark:[.ui-vibrant_&]:bg-blue-950/20",
        "[.ui-vibrant_&]:border-blue-200/50 dark:[.ui-vibrant_&]:border-blue-800/30",
        "[.ui-vibrant_&]:shadow-sm",
        "[.ui-play_&]:!bg-[#1CB0F6] [.ui-play_&]:!border-2 [.ui-play_&]:!border-[#1899d6] [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-[0_4px_0_0_#1899d6]"
      )}>
        {/* Header: title + inline stats + view toggle */}
        <CardHeader className="px-5 py-3 border-b [.ui-play_&]:border-white/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary [.ui-play_&]:bg-white/20 [.ui-play_&]:text-white">
                <TrendingUp size={18} />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold [.ui-play_&]:text-white [.ui-play_&]:font-black [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide">Learning Progress</CardTitle>
                <CardDescription className="text-xs [.ui-play_&]:text-white/60">Past 7 days activity vs batch average</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Inline stats */}
              <InlineStat label="avg" value={avgTimeSpent} icon={Clock} />
              <InlineStat label="sessions" value={totalSessions.toString()} icon={Target} />
              <InlineStat label={`day${streakDays !== 1 ? "s" : ""} streak`} value={streakDays.toString()} icon={Award} />

              {/* View toggle */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 [.ui-play_&]:bg-white/20">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveView("chart"); }}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    activeView === "chart"
                      ? "bg-background shadow-sm text-foreground [.ui-play_&]:!bg-white [.ui-play_&]:!text-[#1899d6]"
                      : "text-muted-foreground hover:text-foreground [.ui-play_&]:text-white/60 [.ui-play_&]:hover:text-white"
                  )}
                  title="Chart view"
                >
                  <BarChart2 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveView("table"); }}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    activeView === "table"
                      ? "bg-background shadow-sm text-foreground [.ui-play_&]:!bg-white [.ui-play_&]:!text-[#1899d6]"
                      : "text-muted-foreground hover:text-foreground [.ui-play_&]:text-white/60 [.ui-play_&]:hover:text-white"
                  )}
                  title="Table view"
                >
                  <Table2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Content: chart or table based on toggle */}
        <CardContent className="p-4 [.ui-play_&]:bg-white [.ui-play_&]:m-3 [.ui-play_&]:rounded-xl">
          {activeView === "chart" ? (
            <LineChartComponent userActivity={userActivity} />
          ) : (
            <StudentProgressTable userActivity={userActivity} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

