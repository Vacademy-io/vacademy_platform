import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "@phosphor-icons/react";
import { ChevronRight, Video } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SessionDetails } from "@/routes/study-library/live-class/-types/types";
import {
  convertSessionTimeToUserTimezone,
  formatSessionTimeInUserTimezone,
} from "@/utils/timezone";
import { cn } from "@/lib/utils";
import { playIllustrations } from "@/assets/play-illustrations";

interface UpcomingLiveClassesWidgetProps {
  liveSessions: SessionDetails[];
  upcomingSessions: SessionDetails[];
  isLoading: boolean;
  onJoinSession: (session: SessionDetails) => void;
}

/**
 * Filter upcoming sessions to only those within the next 24 hours.
 * Also includes any currently-live sessions.
 */
function getSessionsWithin24Hours(
  liveSessions: SessionDetails[],
  upcomingSessions: SessionDetails[]
): { live: SessionDetails[]; upcoming: SessionDetails[] } {
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = upcomingSessions.filter((s) => {
    try {
      const sessionTime = s.timezone
        ? convertSessionTimeToUserTimezone(
            s.meeting_date,
            s.start_time,
            s.timezone
          )
        : new Date(`${s.meeting_date}T${s.start_time}`);
      return sessionTime <= oneDayFromNow;
    } catch {
      // Fallback: try raw date parse
      const fallback = new Date(`${s.meeting_date}T${s.start_time}`);
      return fallback <= oneDayFromNow;
    }
  });

  return { live: liveSessions, upcoming };
}

function formatRelativeTime(
  meetingDate: string,
  startTime: string,
  timezone: string
): string {
  try {
    const sessionTime = timezone
      ? convertSessionTimeToUserTimezone(meetingDate, startTime, timezone)
      : new Date(`${meetingDate}T${startTime}`);
    const now = new Date();
    const diffMs = sessionTime.getTime() - now.getTime();

    if (diffMs < 0) return "Now";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `in ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours}h ${diffMins % 60}m`;
    return `in ${diffHours}h`;
  } catch {
    return "";
  }
}

export function UpcomingLiveClassesWidget({
  liveSessions,
  upcomingSessions,
  isLoading,
  onJoinSession,
}: UpcomingLiveClassesWidgetProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const { live, upcoming } = getSessionsWithin24Hours(
    liveSessions || [],
    upcomingSessions || []
  );

  // Don't render the widget if no sessions within 24 hours
  if (live.length === 0 && upcoming.length === 0) {
    return null;
  }

  const totalCount = live.length + upcoming.length;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-shadow hover:shadow-md",
        "[.ui-vibrant_&]:border-violet-200 dark:[.ui-vibrant_&]:border-violet-800/50",
        "[.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-card [.ui-vibrant_&]:to-violet-50/50",
        "dark:[.ui-vibrant_&]:from-card dark:[.ui-vibrant_&]:to-violet-950/20",
        // Play Styles - Solid Bold Duolingo
        "[.ui-play_&]:bg-[#E91E63] [.ui-play_&]:border-2 [.ui-play_&]:border-[#c2185b] [.ui-play_&]:rounded-2xl [.ui-play_&]:shadow-[0_4px_0_0_#c2185b]",
        "[.ui-play_&]:text-white [.ui-play_&]:font-bold",
        "[.ui-play_&]:flex [.ui-play_&]:flex-row [.ui-play_&]:md:flex-col"
      )}
    >
      {/* Play SVG: side on mobile, top on desktop */}
      <div className="hidden [.ui-play_&]:!flex order-2 md:order-first w-28 md:w-full items-center justify-center bg-white/10 p-2 md:px-6 md:pt-4 md:pb-2 flex-shrink-0">
        <playIllustrations.LiveClass className="h-24 md:h-28 w-auto text-white" />
      </div>
      <div className="[.ui-play_&]:flex-1 [.ui-play_&]:min-w-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400",
              "[.ui-vibrant_&]:bg-violet-200/70 dark:[.ui-vibrant_&]:bg-violet-800/40",
              // Play icon
              "[.ui-play_&]:bg-white/20 [.ui-play_&]:text-white [.ui-play_&]:rounded-xl"
            )}
          >
            <Video size={18} />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Upcoming Live Classes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCount} class{totalCount !== 1 ? "es" : ""} in next 24h
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => navigate({ to: "/study-library/live-class" })}
        >
          View All <ChevronRight size={14} className="ml-1" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Live sessions */}
        {live.map((session, index) => (
          <div
            key={`live-${session.session_id}-${index}`}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border rounded-lg bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-900/50"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-400 shrink-0">
                <Video size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {session.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {formatSessionTimeInUserTimezone(
                    session.meeting_date,
                    session.start_time,
                    session.timezone
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-xs"
              >
                Live Now
              </Badge>
              <Button size="sm" onClick={() => onJoinSession(session)}>
                Join
              </Button>
            </div>
          </div>
        ))}

        {/* Upcoming sessions (next 24h) */}
        {upcoming.slice(0, 4).map((session, index) => {
          const relTime = formatRelativeTime(
            session.meeting_date,
            session.start_time,
            session.timezone
          );

          return (
            <div
              key={`upcoming-${session.session_id}-${index}`}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400 shrink-0">
                  <Calendar weight="duotone" size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {session.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock weight="duotone" size={12} />
                    <span>
                      {formatSessionTimeInUserTimezone(
                        session.meeting_date,
                        session.start_time,
                        session.timezone
                      )}
                    </span>
                    {relTime && (
                      <span className="text-violet-600 dark:text-violet-400 font-medium">
                        ({relTime})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 text-xs shrink-0"
              >
                Upcoming
              </Badge>
            </div>
          );
        })}
      </CardContent>
      </div>
    </Card>
  );
}
