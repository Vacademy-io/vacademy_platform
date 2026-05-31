import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useAttendanceStats,
  AttendancePeriod,
} from "@/services/attendance/useAttendanceStats";
import { useWeeklyAttendanceQuery } from "@/services/attendance/getWeeklyAttendance";
import { ChartBar, Fire, CaretRight } from "@phosphor-icons/react";
import { playIllustrations } from "@/assets/play-illustrations";

const PERIOD_LABELS: Record<AttendancePeriod, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "3 Months",
};

function getPercentageColor(pct: number) {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

function getPercentageBg(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function DayDot({
  status,
  label,
}: {
  status: "PRESENT" | "ABSENT" | "UNMARKED" | "PENDING" | "NO_CLASS";
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-caption font-semibold transition-colors",
          status === "PRESENT" &&
            "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
          status === "ABSENT" &&
            "bg-red-100 text-red-700 ring-1 ring-red-300",
          status === "UNMARKED" &&
            "bg-slate-100 text-slate-400 ring-1 ring-slate-200",
          status === "PENDING" &&
            "bg-slate-100 text-slate-400 ring-1 ring-slate-200",
          status === "NO_CLASS" &&
            "bg-slate-50 text-slate-300 ring-1 ring-slate-100"
        )}
      >
        {status === "PRESENT"
          ? "✓"
          : status === "ABSENT"
            ? "✕"
            : status === "UNMARKED"
              ? "?"
              : status === "PENDING"
                ? "•"
                : "–"}
      </div>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}

export function AttendanceWidget() {
  const [period, setPeriod] = useState<AttendancePeriod>("7d");
  const { data: stats, isLoading } = useAttendanceStats({ period });
  const { data: weeklyData, isLoading: isLoadingWeekly } =
    useWeeklyAttendanceQuery();
  const navigate = useNavigate();

  if (isLoading && isLoadingWeekly) {
    return (
      <Card className="h-full">
        <CardContent className="p-4 space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-4">
            <Skeleton className="h-16 w-20" />
            <Skeleton className="h-16 w-20" />
            <Skeleton className="h-16 w-20" />
          </div>
          <div className="flex gap-2 justify-between">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-7 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pct = stats?.attendancePercentage ?? 0;
  const streak = stats?.currentStreak ?? 0;
  const present = stats?.presentDays ?? 0;
  const total = stats?.totalClassDays ?? 0;
  // Empty state: no data yet — show a welcoming CTA instead of "0% / 0 / 0/0",
  // which reads as failure to a new learner who hasn't attended any class.
  const isEmpty = total === 0 && streak === 0;

  return (
    <Card
      className={cn(
        "attendance-widget-card group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 h-full",
        "[.ui-vibrant_&]:bg-emerald-50/50 [.ui-vibrant_&]:border-emerald-200",
        "dark:[.ui-vibrant_&]:bg-emerald-950/20 dark:[.ui-vibrant_&]:border-emerald-800/50",
        // Play Styles — bg, shadow, border driven by .attendance-widget-card in play-theme.css
        "[.ui-play_&]:text-white [.ui-play_&]:font-bold",
        "[.ui-play_&]:flex [.ui-play_&]:flex-row [.ui-play_&]:md:flex-col"
      )}
      onClick={() => navigate({ to: "/learning-centre/attendance" })}
    >
      {/* Play: SVG strip — side on mobile, top on desktop (matches Badges widget) */}
      <div className="hidden [.ui-play_&]:!flex order-2 md:order-none w-28 md:w-full items-center justify-center bg-white/10 p-2 md:px-6 md:pt-4 md:pb-2 flex-shrink-0 md:flex-shrink">
        <playIllustrations.AttendanceHappy className="h-24 md:h-28 w-auto text-white" />
      </div>
      <div className={cn(
        "[.ui-play_&]:flex-1 [.ui-play_&]:min-w-0",
        isEmpty && "[.ui-play_&]:flex [.ui-play_&]:flex-col [.ui-play_&]:justify-center"
      )}>
      <CardHeader className="pb-2 px-4 pt-4 [.ui-play_&]:pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-1.5 rounded-md bg-emerald-100 text-emerald-600",
                "dark:bg-emerald-500/20 dark:text-emerald-300"
              )}
            >
              <ChartBar size={18} weight="duotone" />
            </div>
            <CardTitle className="text-sm font-semibold">Attendance</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {!isEmpty &&
              (Object.keys(PERIOD_LABELS) as AttendancePeriod[]).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPeriod(p);
                  }}
                  className={cn(
                    "h-6 px-2 text-caption font-medium rounded-md",
                    period === p
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 [.ui-play_&]:!bg-white/20 [.ui-play_&]:!text-white"
                      : "text-muted-foreground hover:text-foreground [.ui-play_&]:!text-white/70"
                  )}
                >
                  {PERIOD_LABELS[p]}
                </Button>
              ))}
            <CaretRight
              size={14}
              weight="bold"
              className="ml-1 text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-0.5 [.ui-play_&]:!text-white/60"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {isEmpty ? (
          <div className="text-center py-3 space-y-1.5">
            <p className="text-sm font-bold text-foreground [.ui-play_&]:!text-white">
              Your journey starts here ✨
            </p>
            <p className="text-xs text-muted-foreground [.ui-play_&]:!text-white/85">
              Once classes begin, your streaks and stats appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Overall % */}
              <div className="text-center">
                <div
                  className={cn(
                    "text-2xl font-bold",
                    getPercentageColor(pct),
                    "[.ui-play_&]:!text-white"
                  )}
                >
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto" />
                  ) : (
                    `${pct}%`
                  )}
                </div>
                <div className="text-caption text-muted-foreground [.ui-play_&]:!text-white/80 mt-0.5">
                  Overall
                </div>
              </div>

              {/* Streak */}
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground [.ui-play_&]:!text-white flex items-center justify-center gap-1">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <>
                      <Fire
                        size={20}
                        weight="fill"
                        className={cn(
                          streak > 0 ? "text-orange-500" : "text-slate-300",
                          "[.ui-play_&]:!text-white"
                        )}
                      />
                      {streak}
                    </>
                  )}
                </div>
                <div className="text-caption text-muted-foreground [.ui-play_&]:!text-white/80 mt-0.5">
                  Streak
                </div>
              </div>

              {/* Present / Total */}
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto" />
                  ) : (
                    <span>
                      <span className="text-emerald-600 [.ui-play_&]:!text-white">
                        {present}
                      </span>
                      <span className="text-muted-foreground text-lg [.ui-play_&]:!text-white">
                        /{total}
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-caption text-muted-foreground [.ui-play_&]:!text-white/80 mt-0.5">
                  Days Present
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  getPercentageBg(pct)
                )}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Weekly grid */}
            {weeklyData && (
              <div className="flex justify-between px-1">
                {weeklyData.days.map((day) => (
                  <DayDot
                    key={day.day}
                    status={day.status}
                    label={day.day}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
      </div>
    </Card>
  );
}
