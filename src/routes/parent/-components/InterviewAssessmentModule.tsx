// ─────────────────────────────────────────────────────────────
// Interview & Assessment Module
// ─────────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import type { ChildProfile } from "@/types/parent-portal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarCheck,
  Clock,
  MapPin,
  Video,
  Timer,
  CheckCircle,
  XCircle,
  ExternalLink,
  CalendarDays,
} from "lucide-react";

interface InterviewAssessmentModuleProps {
  child: ChildProfile;
}

export function InterviewAssessmentModule({
  child,
}: InterviewAssessmentModuleProps) {
  // Placeholder data - API endpoints for interview/assessment not implemented yet
  const interview = null;
  const assessment = null;
  const isLoading = false;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasInterview = !!interview;
  const hasAssessment = !!assessment;
  const isEmpty = !hasInterview && !hasAssessment;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          Interviews & Assessments
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Scheduled sessions for {child.full_name}
        </p>
      </div>

      {/* ── Empty State ───────────────────────────────────────── */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="shadow-sm">
            <CardContent className="py-10 text-center">
              <CalendarDays
                size={28}
                className="mx-auto text-muted-foreground/40 mb-3"
              />
              <p className="text-sm font-medium text-muted-foreground">
                No sessions scheduled yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Details will appear here once the admissions team schedules an
                interview or assessment.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Interview Card ────────────────────────────────────── */}
      {hasInterview && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <ScheduleCard
            type="Interview"
            scheduleDate={interview.scheduled_date}
            scheduleTime={interview.scheduled_time}
            duration={interview.duration_minutes}
            location={interview.location}
            mode={interview.mode}
            meetingLink={interview.meeting_link}
            status={interview.status}
            result={interview.result}
            feedback={interview.feedback}
            icon={
              <Video
                size={20}
                className="text-violet-600 dark:text-violet-400"
              />
            }
            accentColor="violet"
          />
        </motion.div>
      )}

      {/* ── Assessment Card ───────────────────────────────────── */}
      {hasAssessment && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ScheduleCard
            type="Assessment"
            scheduleDate={assessment.scheduled_date}
            scheduleTime={assessment.scheduled_time}
            duration={assessment.duration_minutes}
            location={assessment.location}
            mode={assessment.mode}
            meetingLink={assessment.meeting_link}
            status={assessment.status}
            result={assessment.result}
            feedback={assessment.feedback}
            icon={
              <CalendarCheck
                size={20}
                className="text-blue-600 dark:text-blue-400"
              />
            }
            accentColor="blue"
          />
        </motion.div>
      )}
    </div>
  );
}

// ── Schedule Card ────────────────────────────────────────────────

interface ScheduleCardProps {
  type: string;
  scheduleDate: string;
  scheduleTime: string;
  duration: number;
  location?: string;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  meetingLink?: string;
  status: string;
  result?: string;
  feedback?: string;
  icon: React.ReactNode;
  accentColor: "violet" | "blue";
}

function ScheduleCard({
  type,
  scheduleDate,
  scheduleTime,
  duration,
  location,
  mode,
  meetingLink,
  status,
  result,
  feedback,
  icon,
  accentColor,
}: ScheduleCardProps) {
  const isCompleted = status === "COMPLETED";
  const isCancelled = status === "CANCELLED";
  const isUpcoming = status === "SCHEDULED";

  const resultBadge = result
    ? result === "PASS" || result === "SELECTED"
      ? {
          bg: "bg-emerald-100 dark:bg-emerald-900/30",
          text: "text-emerald-700 dark:text-emerald-300",
          icon: <CheckCircle size={12} />,
        }
      : {
          bg: "bg-red-100 dark:bg-red-900/30",
          text: "text-red-700 dark:text-red-300",
          icon: <XCircle size={12} />,
        }
    : null;

  const dateObj = new Date(scheduleDate);
  const dateStr = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const accentBg =
    accentColor === "violet"
      ? "bg-violet-50 dark:bg-violet-950/20"
      : "bg-blue-50 dark:bg-blue-950/20";
  const accentBorder =
    accentColor === "violet" ? "border-l-violet-500" : "border-l-blue-500";

  return (
    <Card
      className={`shadow-sm border-l-4 ${accentBorder} ${isCancelled ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${accentBg}`}>{icon}</div>
            <div>
              <CardTitle className="text-base">{type}</CardTitle>
              <CardDescription className="text-xs">
                {isCompleted
                  ? "Completed"
                  : isCancelled
                    ? "Cancelled"
                    : "Upcoming"}
              </CardDescription>
            </div>
          </div>
          {resultBadge && (
            <Badge
              className={`${resultBadge.bg} ${resultBadge.text} gap-1 text-xs`}
            >
              {resultBadge.icon}
              {result}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Date & Time */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays size={14} className="text-muted-foreground" />
            <span className="text-foreground">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-foreground">{scheduleTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Timer size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">{duration} min</span>
          </div>
        </div>

        {/* Location / Mode */}
        <div className="flex items-center gap-2 text-sm">
          {mode === "ONLINE" ? (
            <Video size={14} className="text-muted-foreground" />
          ) : (
            <MapPin size={14} className="text-muted-foreground" />
          )}
          <span className="text-foreground">
            {mode === "ONLINE"
              ? "Online"
              : mode === "HYBRID"
                ? "Hybrid"
                : location || "On campus"}
          </span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {mode}
          </Badge>
        </div>

        {/* Meeting Link */}
        {meetingLink && isUpcoming && (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto gap-1.5 text-xs h-8"
            onClick={() => window.open(meetingLink, "_blank")}
          >
            <Video size={12} />
            Join Online Session
            <ExternalLink size={10} />
          </Button>
        )}

        {/* Feedback */}
        {feedback && isCompleted && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Feedback
            </p>
            <p className="text-sm text-foreground">{feedback}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
