// import { DashboardLoader } from "@/components/core/dashboard-loader";
import { usePastLearningInsights } from "../-hooks/usePastLearningInsights";
import { LineChartComponent } from "./LineChartComponent";
import { StudentProgressTable } from "./StudentProgressTable";
import { useEffect, useState } from "react";
import { getStoredDetails } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { UserActivityArray } from "../-types/dashboard-data-types";
import { formatTimeFromMillis } from "@/helpers/formatTimeFromMiliseconds";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Target, Medal, TrendUp, ChartBarHorizontal, Table } from "@phosphor-icons/react";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { cn } from "@/lib/utils";
import { usePlayTheme } from "@/hooks/use-play-theme";
import { useCleanerPlayTheme } from "@/hooks/use-cleaner-play-theme";
import iconProgress from "@/assets/cleaner-play/icon-progress.webp";

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
    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
      <Icon size={14} />
    </div>
    <div>
      <span className="text-sm font-bold">{value}</span>
      <span className="text-xs text-muted-foreground ml-1">{label}</span>
    </div>
  </div>
);

const PlayInlineStat = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}) => (
  <div className="flex items-center gap-2">
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-play-navy-soft-ink">
      <Icon size={14} />
    </div>
    <div>
      <span className="text-caption font-black text-play-ink">{value}</span>
      <span className="ml-1 text-3xs font-bold text-play-ink/60">{label}</span>
    </div>
  </div>
);

const CleanerInlineStat = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}) => (
  <div className="flex items-center gap-2">
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cp-sage-tint text-cp-sage">
      <Icon size={14} />
    </div>
    <div>
      <span className="cp-heading text-caption">{value}</span>
      <span className="cp-muted ml-1 text-3xs">{label}</span>
    </div>
  </div>
);

export const PastLearningInsights = () => {
  const isPlay = usePlayTheme();
  const isCleanerPlay = useCleanerPlayTheme();
  const { mutate: pastLearningInsights, isPending } = usePastLearningInsights();
  const [userActivity, setUserActivity] = useState<UserActivityArray>([]);
  const [avgTimeSpent, setAvgTimeSpent] = useState<string>("0");
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [activeView, setActiveView] = useState<"chart" | "table">("chart");

  // Honesty gate: with zero recorded activity the header zero-stats are noise.
  const hasActivity = userActivity.some((day) => day.time_spent_by_user_millis > 0);

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

  if (isPlay) {
    return (
      <div className="animate-fade-in-up overflow-hidden rounded-play-card bg-play-navy-soft shadow-play-soft-card">
        <div className="flex flex-col gap-3 border-b border-white/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={iconProgress}
              alt=""
              aria-hidden="true"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-body font-black uppercase tracking-wide text-play-navy-soft-ink">Learning Progress</p>
              <p className="text-caption font-bold text-play-ink/60">
                Past 7 days activity vs {getTerminology(ContentTerms.Batch, SystemTerms.Batch).toLowerCase()} average
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {hasActivity && (
              <>
                <PlayInlineStat label="avg" value={avgTimeSpent} icon={Clock} />
                <PlayInlineStat label="sessions" value={totalSessions.toString()} icon={Target} />
                <PlayInlineStat label={`day${streakDays !== 1 ? "s" : ""} streak`} value={streakDays.toString()} icon={Medal} />
              </>
            )}

            <div className="flex items-center gap-0.5 rounded-full bg-white/60 p-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveView("chart"); }}
                className={cn(
                  "rounded-full p-1.5 transition-all",
                  activeView === "chart" ? "bg-white text-play-navy-soft-ink shadow-sm" : "text-play-ink/50"
                )}
                title="Chart view"
              >
                <ChartBarHorizontal size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveView("table"); }}
                className={cn(
                  "rounded-full p-1.5 transition-all",
                  activeView === "table" ? "bg-white text-play-navy-soft-ink shadow-sm" : "text-play-ink/50"
                )}
                title="Table view"
              >
                <Table size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {activeView === "chart" ? (
            <LineChartComponent userActivity={userActivity} />
          ) : (
            <StudentProgressTable userActivity={userActivity} />
          )}
        </div>
      </div>
    );
  }

  if (isCleanerPlay) {
    return (
      <div className="cp-card animate-fade-in-up overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-cp-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={iconProgress}
              alt=""
              aria-hidden="true"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="cp-heading text-body">Learning Progress</p>
              <p className="cp-muted text-caption">
                Past 7 days activity vs {getTerminology(ContentTerms.Batch, SystemTerms.Batch).toLowerCase()} average
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {hasActivity && (
              <>
                <CleanerInlineStat label="avg" value={avgTimeSpent} icon={Clock} />
                <CleanerInlineStat label="sessions" value={totalSessions.toString()} icon={Target} />
                <CleanerInlineStat label={`day${streakDays !== 1 ? "s" : ""} streak`} value={streakDays.toString()} icon={Medal} />
              </>
            )}

            <div className="flex items-center gap-0.5 rounded-full bg-cp-bg-deep p-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveView("chart"); }}
                className={cn(
                  "rounded-full p-1.5 transition-all",
                  activeView === "chart" ? "bg-cp-surface text-cp-ink shadow-sm" : "cp-muted"
                )}
                title="Chart view"
              >
                <ChartBarHorizontal size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveView("table"); }}
                className={cn(
                  "rounded-full p-1.5 transition-all",
                  activeView === "table" ? "bg-cp-surface text-cp-ink shadow-sm" : "cp-muted"
                )}
                title="Table view"
              >
                <Table size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {activeView === "chart" ? (
            <LineChartComponent userActivity={userActivity} />
          ) : (
            <StudentProgressTable userActivity={userActivity} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <Card className={cn(
        "shadow-none relative overflow-hidden",
        // Vibrant: white card with a tenant-primary top rail (no fixed hues)
        "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300",
        "[.ui-vibrant_&]:shadow-sm"
      )}>
        {/* Header: title + inline stats + view toggle */}
        <CardHeader className="px-5 py-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <TrendUp size={18} />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Learning Progress</CardTitle>
                <CardDescription className="text-xs">Past 7 days activity vs {getTerminology(ContentTerms.Batch, SystemTerms.Batch).toLowerCase()} average</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Inline stats: only shown once there is real activity (no wall of zeros) */}
              {hasActivity && (
                <>
                  <InlineStat label="avg" value={avgTimeSpent} icon={Clock} />
                  <InlineStat label="sessions" value={totalSessions.toString()} icon={Target} />
                  <InlineStat label={`day${streakDays !== 1 ? "s" : ""} streak`} value={streakDays.toString()} icon={Medal} />
                </>
              )}

              {/* View toggle */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveView("chart"); }}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    activeView === "chart"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Chart view"
                >
                  <ChartBarHorizontal size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveView("table"); }}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    activeView === "table"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Table view"
                >
                  <Table size={14} />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Content: chart or table based on toggle */}
        <CardContent className="p-4">
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

