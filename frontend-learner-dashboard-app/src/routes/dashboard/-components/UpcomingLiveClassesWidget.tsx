import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock } from "@phosphor-icons/react";
import { CaretRight, VideoCamera } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { SessionDetails } from "@/routes/study-library/live-class/-types/types";
import {
  convertSessionTimeToUserTimezone,
  formatSessionTimeInUserTimezone,
} from "@/utils/timezone";
import { cn } from "@/lib/utils";
import { getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

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
        // Vibrant: white card with a tenant-primary top rail (no fixed hues)
        "[.ui-vibrant_&]:border-primary-100",
        "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300",
        // Play: premium solid navy card with press shadow
        "[.ui-play_&]:bg-play-navy [.ui-play_&]:rounded-play-card [.ui-play_&]:border-0",
        "[.ui-play_&]:shadow-play-4d-navy [.ui-play_&]:hover:shadow-play-4d-navy",
        "[.ui-play_&]:text-white [.ui-play_&]:font-bold",
        "[.ui-play_&]:flex [.ui-play_&]:flex-row [.ui-play_&]:items-stretch"
      )}
    >
      <div className="[.ui-play_&]:flex-1 [.ui-play_&]:min-w-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400",
              // Vibrant: primary icon chip (dark-prefixed too so the default
              // dark: violet classes can't out-rank it in dark mode)
              "[.ui-vibrant_&]:bg-primary-100 [.ui-vibrant_&]:text-primary-500",
              "dark:[.ui-vibrant_&]:bg-primary-100 dark:[.ui-vibrant_&]:text-primary-500",
              // Play icon
              "[.ui-play_&]:bg-white/20 [.ui-play_&]:text-white [.ui-play_&]:rounded-xl"
            )}
          >
            <VideoCamera size={18} />
          </div>
          <div>
            <CardTitle
              className={cn(
                "text-base font-semibold",
                "[.ui-play_&]:text-white [.ui-play_&]:font-bold"
              )}
            >
              Upcoming{" "}
              {getTerminologyPlural(
                ContentTerms.LiveSession,
                SystemTerms.LiveSession
              )}
            </CardTitle>
            <p
              className={cn(
                "text-xs text-muted-foreground mt-0.5",
                "[.ui-play_&]:text-white/80 [.ui-play_&]:font-medium"
              )}
            >
              {totalCount} {totalCount === 1 ? "class" : "classes"} in next 24h
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs",
            "[.ui-play_&]:text-white/90 [.ui-play_&]:hover:text-white",
            "[.ui-play_&]:hover:bg-white/10",
            "[.ui-play_&]:focus-visible:ring-2 [.ui-play_&]:focus-visible:ring-white/70"
          )}
          onClick={() => navigate({ to: "/study-library/live-class" })}
        >
          View All <CaretRight size={14} className="ml-1" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Live sessions */}
        {live.map((session, index) => (
          <div
            key={`live-${session.session_id}-${index}`}
            className={cn(
              "flex flex-col items-start gap-2 p-3 border rounded-lg bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-900/50",
              "[.ui-play_&]:bg-white/10 [.ui-play_&]:border-white/20 [.ui-play_&]:rounded-xl"
            )}
          >
            <div className="flex w-full items-center gap-3 min-w-0">
              <div
                className={cn(
                  "p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-400 shrink-0",
                  "[.ui-play_&]:bg-white/15 [.ui-play_&]:text-white/80 [.ui-play_&]:rounded-xl"
                )}
              >
                <VideoCamera size={16} />
              </div>
              <div className="min-w-0">
                <h4
                  className={cn(
                    "font-medium text-sm truncate",
                    "[.ui-play_&]:text-white [.ui-play_&]:font-bold"
                  )}
                >
                  {session.title}
                </h4>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    "[.ui-play_&]:text-white/90"
                  )}
                >
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
                className={cn(
                  "bg-green-600 hover:bg-green-700 text-xs",
                  "[.ui-play_&]:bg-play-danger [.ui-play_&]:hover:bg-play-danger",
                  "[.ui-play_&]:text-white [.ui-play_&]:border-0",
                  "[.ui-play_&]:shadow-play-2d-danger"
                )}
              >
                <span
                  aria-hidden="true"
                  className="hidden [.ui-play_&]:inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse mr-1"
                />
                Live Now
              </Badge>
              <Button
                size="sm"
                onClick={() => onJoinSession(session)}
                className={cn(
                  "[.ui-play_&]:bg-white [.ui-play_&]:text-play-navy-deep",
                  "[.ui-play_&]:hover:bg-white/90 [.ui-play_&]:font-bold",
                  "[.ui-play_&]:rounded-xl [.ui-play_&]:shadow-play-2d-navy",
                  "[.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none",
                  "[.ui-play_&]:focus-visible:ring-2 [.ui-play_&]:focus-visible:ring-white/70"
                )}
              >
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
              className={cn(
                "flex flex-col items-start gap-2 p-3 border rounded-lg",
                "[.ui-play_&]:bg-white/10 [.ui-play_&]:border-white/20 [.ui-play_&]:rounded-xl"
              )}
            >
              <div className="flex w-full items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400 shrink-0",
                    "[.ui-play_&]:bg-white/15 [.ui-play_&]:text-white/80 [.ui-play_&]:rounded-xl"
                  )}
                >
                  <Calendar weight="duotone" size={16} />
                </div>
                <div className="min-w-0">
                  <h4
                    className={cn(
                      "font-medium text-sm truncate",
                      "[.ui-play_&]:text-white [.ui-play_&]:font-bold"
                    )}
                  >
                    {session.title}
                  </h4>
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground min-w-0",
                      "[.ui-play_&]:text-white/90"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1 whitespace-nowrap">
                      <Clock weight="duotone" size={12} className="shrink-0" />
                      <span className="truncate">
                        {formatSessionTimeInUserTimezone(
                          session.meeting_date,
                          session.start_time,
                          session.timezone
                        )}
                      </span>
                    </span>
                    {relTime && (
                      <span
                        className={cn(
                          "whitespace-nowrap text-violet-600 dark:text-violet-400 font-medium",
                          "[.ui-play_&]:text-white [.ui-play_&]:font-bold"
                        )}
                      >
                        ({relTime})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 text-xs shrink-0",
                  "[.ui-play_&]:bg-white/20 [.ui-play_&]:text-white [.ui-play_&]:border-white/20"
                )}
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
