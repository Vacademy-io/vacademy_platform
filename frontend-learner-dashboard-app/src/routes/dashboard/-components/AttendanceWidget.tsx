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
import {
  ChartBar,
  Fire,
  CaretRight,
  Check,
  X,
  Minus,
} from "@phosphor-icons/react";
import { isToday } from "date-fns";
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

// Play variant keeps the same health thresholds, recolored for the green surface:
// healthy = white fill, borderline = gold, at-risk = danger red.
function getPlayPercentageBg(pct: number) {
  if (pct >= 75) return "[.ui-play_&]:!bg-white";
  if (pct >= 50) return "[.ui-play_&]:!bg-play-gold";
  return "[.ui-play_&]:!bg-play-danger";
}

function DayDot({
  status,
  label,
  isCurrentDay = false,
}: {
  status: "PRESENT" | "ABSENT" | "UNMARKED" | "PENDING" | "NO_CLASS";
  label: string;
  isCurrentDay?: boolean;
}) {
  const isFuturePending = status === "PENDING" && !isCurrentDay;
  const title =
    status === "PRESENT"
      ? "Present"
      : status === "ABSENT"
        ? "Absent"
        : status === "NO_CLASS"
          ? "No class"
          : isFuturePending
            ? "Upcoming"
            : "Not marked yet";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        title={title}
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
          status === "PRESENT" &&
            "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 [.ui-play_&]:!bg-white [.ui-play_&]:!ring-0",
          status === "ABSENT" &&
            "bg-red-100 text-red-700 ring-1 ring-red-300 [.ui-play_&]:!bg-white [.ui-play_&]:!ring-0",
          status === "UNMARKED" &&
            "bg-slate-100 text-slate-400 ring-1 ring-slate-200 [.ui-play_&]:!bg-white/30 [.ui-play_&]:!ring-0",
          status === "PENDING" &&
            isCurrentDay &&
            "bg-slate-100 text-slate-400 ring-1 ring-slate-200 [.ui-play_&]:!bg-white/30 [.ui-play_&]:!ring-2 [.ui-play_&]:!ring-white",
          isFuturePending &&
            "bg-slate-100 text-slate-400 ring-1 ring-slate-200 [.ui-play_&]:!bg-transparent [.ui-play_&]:!ring-0 [.ui-play_&]:border-2 [.ui-play_&]:border-white/40",
          status === "NO_CLASS" &&
            "bg-slate-50 text-slate-300 ring-1 ring-slate-100 [.ui-play_&]:!bg-transparent [.ui-play_&]:!ring-0 [.ui-play_&]:border-2 [.ui-play_&]:border-white/25"
        )}
      >
        {status === "PRESENT" && (
          <Check
            size={14}
            weight="bold"
            className="[.ui-play_&]:!text-play-success-deep"
          />
        )}
        {status === "ABSENT" && (
          <X
            size={14}
            weight="bold"
            className="[.ui-play_&]:!text-play-danger"
          />
        )}
        {status === "UNMARKED" && (
          <Minus
            size={12}
            weight="bold"
            className="[.ui-play_&]:!text-white"
          />
        )}
        {status === "PENDING" && isCurrentDay && (
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 [.ui-play_&]:hidden" />
        )}
      </div>
      <span className="text-caption text-muted-foreground [.ui-play_&]:!text-play-ink [.ui-play_&]:font-bold">
        {label}
      </span>
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
  // First-run state: nothing has been marked yet (no present days and no
  // PRESENT/ABSENT day in the week), so show goal-framed copy instead of a
  // wall of zeros that reads as failure to a new learner.
  const hasMarkedDay =
    weeklyData?.days?.some(
      (d) => d.status === "PRESENT" || d.status === "ABSENT"
    ) ?? false;
  const isEmpty =
    (total === 0 && streak === 0) || (present === 0 && !hasMarkedDay);

  const goToAttendance = () =>
    navigate({ to: "/learning-centre/attendance" });

  return (
    <Card
      className={cn(
        "attendance-widget-card group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/20 h-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Vibrant: tenant-primary wash + top rail; success/danger stay
        // reserved for the actual attendance statuses inside
        "[.ui-vibrant_&]:bg-primary-50/50 [.ui-vibrant_&]:border-primary-100",
        "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300",
        // Play: solid success-green card with hard press shadow, ink text
        "[.ui-play_&]:bg-play-success [.ui-play_&]:rounded-play-card [.ui-play_&]:border-0",
        "[.ui-play_&]:shadow-play-4d-success [.ui-play_&]:hover:shadow-play-4d-success",
        "[.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none",
        "[.ui-play_&]:text-play-ink [.ui-play_&]:font-bold",
        "[.ui-play_&]:flex [.ui-play_&]:flex-row [.ui-play_&]:md:flex-col"
      )}
      role="button"
      tabIndex={0}
      aria-label="View attendance details"
      onClick={goToAttendance}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToAttendance();
        }
      }}
    >
      {/* Play: SVG strip, side on mobile, top on desktop (matches Badges widget) */}
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
                "dark:bg-emerald-500/20 dark:text-emerald-300",
                "[.ui-play_&]:!bg-white [.ui-play_&]:!text-play-success-deep [.ui-play_&]:shadow-play-2d-success"
              )}
            >
              <ChartBar size={18} weight="duotone" />
            </div>
            <CardTitle className="text-sm font-semibold [.ui-play_&]:!text-play-ink">
              Attendance
            </CardTitle>
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
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 [.ui-play_&]:!bg-white [.ui-play_&]:!text-play-ink [.ui-play_&]:rounded-lg [.ui-play_&]:shadow-play-2d-success [.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none"
                      : "text-muted-foreground hover:text-foreground [.ui-play_&]:!text-play-ink/80"
                  )}
                >
                  {PERIOD_LABELS[p]}
                </Button>
              ))}
            <CaretRight
              size={14}
              weight="bold"
              className="ml-1 text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-0.5 [.ui-play_&]:!text-play-ink"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {isEmpty ? (
          <div className="text-center py-3 space-y-1.5">
            <p className="text-sm font-bold text-foreground [.ui-play_&]:!text-play-ink">
              Attend today's class to start your streak
            </p>
            <p className="text-xs text-muted-foreground [.ui-play_&]:!text-play-ink/80">
              Your attendance stats and weekly streak will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Stats row. Play: white chips with ink numbers (Duolingo pattern) */}
            <div className="grid grid-cols-3 gap-3 [.ui-play_&]:gap-2">
              {/* Overall % */}
              <div className="text-center [.ui-play_&]:bg-white [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-play-2d-success [.ui-play_&]:px-2 [.ui-play_&]:py-2 [.ui-play_&]:min-w-0">
                <div
                  className={cn(
                    "text-2xl font-bold",
                    getPercentageColor(pct),
                    "[.ui-play_&]:!text-play-ink [.ui-play_&]:font-black"
                  )}
                >
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto" />
                  ) : (
                    `${pct}%`
                  )}
                </div>
                <div className="text-caption text-muted-foreground [.ui-play_&]:!text-play-ink/80 mt-0.5">
                  Overall
                </div>
              </div>

              {/* Streak */}
              <div className="text-center [.ui-play_&]:bg-white [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-play-2d-success [.ui-play_&]:px-2 [.ui-play_&]:py-2 [.ui-play_&]:min-w-0">
                <div className="text-2xl font-bold text-foreground [.ui-play_&]:!text-play-ink [.ui-play_&]:font-black flex items-center justify-center gap-1">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <>
                      <Fire
                        size={20}
                        weight="fill"
                        className={cn(
                          streak > 0
                            ? "text-orange-500 [.ui-play_&]:!text-play-warn"
                            : "text-slate-300 [.ui-play_&]:!text-play-muted"
                        )}
                      />
                      {streak}
                    </>
                  )}
                </div>
                <div className="text-caption text-muted-foreground [.ui-play_&]:!text-play-ink/80 mt-0.5">
                  Streak
                </div>
              </div>

              {/* Present / Total */}
              <div className="text-center [.ui-play_&]:bg-white [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-play-2d-success [.ui-play_&]:px-2 [.ui-play_&]:py-2 [.ui-play_&]:min-w-0">
                <div className="text-2xl font-bold text-foreground [.ui-play_&]:font-black">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto" />
                  ) : (
                    <span>
                      <span className="text-emerald-600 [.ui-play_&]:!text-play-ink">
                        {present}
                      </span>
                      <span className="text-muted-foreground text-lg [.ui-play_&]:!text-play-ink/80">
                        /{total}
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-caption text-muted-foreground [.ui-play_&]:!text-play-ink/80 mt-0.5">
                  Days Present
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800 [.ui-play_&]:!bg-white/25 [.ui-play_&]:h-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  getPercentageBg(pct),
                  getPlayPercentageBg(pct)
                )}
                // dynamic: width tracks the computed attendance percentage
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
                    isCurrentDay={isToday(day.date)}
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
