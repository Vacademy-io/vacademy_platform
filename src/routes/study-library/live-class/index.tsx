import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect, useState, useLayoutEffect, useCallback, useMemo } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useLiveSessions } from "./-hooks/useLiveSessions";
import { SessionDetails } from "./-types/types";

import { useNavigate } from "@tanstack/react-router";
import { SessionStreamingServiceType } from "@/routes/register/live-class/-types/enum";
import { getAllPackageSessionIds } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { useMarkAttendance } from "./-hooks/useMarkAttendance";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar,
  List,
  Clock,
  MapPin,
  Users,
  ArrowSquareOut,
  X,
  FunnelSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { calculateDuration } from "@/lib/live-class/utils";
import {
  formatSessionTimeInUserTimezone,
  convertSessionTimeToUserTimezone,
  getTimezoneDisplayInfo,
} from "@/utils/timezone";
import { getUserTimezone } from "@/hooks/use-server-time";
import { DefaultClassCard } from "./-components/DefaultClassCard";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
export const Route = createFileRoute("/study-library/live-class/")({
  component: RouteComponent,
});

function RouteComponent() {

  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [selectedView, setSelectedView] = useState<string>("list");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dayModalOpen, setDayModalOpen] = useState<boolean>(false);
  const [selectedDayData, setSelectedDayData] = useState<{
    date: Date;
    sessions: SessionDetails[];
  } | null>(null);


  // Filter states
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [apiPage, setApiPage] = useState<number>(0);
  const [upcomingPage, setUpcomingPage] = useState<number>(0); // Client-side pagination for upcoming sessions
  const SESSIONS_PER_PAGE = 5;

  const clearFilters = () => {
    setStartDateFilter("");
    setEndDateFilter("");
    setApiPage(0);
  };


  // Helper function to format date as YYYY-MM-DD
  const formatDateToISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };


  const { mutateAsync: markAttendance } = useMarkAttendance();

  // State to trigger re-renders for time-based updates
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Check every 10 seconds for smoother transitions
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBatchIds = async () => {
      const ids = await getAllPackageSessionIds();
      console.log('Fetched batch IDs:', ids);
      setBatchIds(ids);
    };
    fetchBatchIds();
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [apiPage]);

  const {
    data: sessions,
    isLoading,
    isFetching,
    error,
  } = useLiveSessions(batchIds, {
    startDate:
      selectedView === "calendar"
        ? formatDateToISO(
          new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        )
        : undefined,
    endDate:
      selectedView === "calendar"
        ? formatDateToISO(
          new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
        )
        : undefined,
    size: 500,
    page: selectedView === "list" ? apiPage : 0,
  });



  useLayoutEffect(() => {
    setNavHeading(
      <div className="flex items-center gap-2">
        <div>Live Classes</div>
      </div>
    );
  }, [setNavHeading]);
  const hasNextPage = (sessions?.totalReturned ?? 0) === 10;

  const formatDateTime = (date: string, time: string, timezone?: string) => {
    if (timezone) {
      return formatSessionTimeInUserTimezone(date, time, timezone);
    }
    // Fallback to original logic for sessions without timezone
    const datetime = new Date(`${date}T${time}`);
    return datetime.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleJoinSession = async (session: SessionDetails) => {
    if (
      session.session_streaming_service_type ===
      SessionStreamingServiceType.EMBED
    ) {
      console.log("Embed session clicked:", session);
    }
    const now = new Date();

    let sessionDate, sessionEndDate, waitingRoomStart;

    if (session.timezone) {
      // Use timezone-aware calculation
      sessionDate = convertSessionTimeToUserTimezone(
        session.meeting_date,
        session.start_time,
        session.timezone
      );
      sessionEndDate = convertSessionTimeToUserTimezone(
        session.meeting_date,
        session.last_entry_time,
        session.timezone
      );

      // If end time is before start time, session spans midnight - add 1 day
      if (sessionEndDate < sessionDate) {
        sessionEndDate = new Date(sessionEndDate.getTime() + 24 * 60 * 60 * 1000);
      }

      waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
    } else {
      // Fallback to original logic
      sessionDate = new Date(`${session.meeting_date}T${session.start_time}`);
      sessionEndDate = new Date(`${session.meeting_date}T${session.last_entry_time}`);

      // If end time is before start time, session spans midnight - add 1 day
      if (sessionEndDate < sessionDate) {
        sessionEndDate = new Date(sessionEndDate.getTime() + 24 * 60 * 60 * 1000);
      }

      waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
    }

    // Check timing status
    const isBeforeWaitingRoom = now < waitingRoomStart;
    const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
    const isLiveClassStarted = now >= sessionDate;
    const hasSessionEnded = now > sessionEndDate;

    // If session has ended, show error
    if (hasSessionEnded) {
      toast.error("This class has ended");
      return;
    }

    // If it's before waiting room time, show error
    if (isBeforeWaitingRoom) {
      toast.error(
        "Class has not started yet. Please wait for the waiting room to open."
      );
      return;
    }

    // If we're in waiting room period, ONLY go to waiting room
    if (isInWaitingRoom) {
      // Navigate to waiting room without marking attendance
      (navigate as any)({
        to: "/study-library/live-class/waiting-room",
        search: { sessionId: session.schedule_id },
      });
      return;
    }

    // If live class has started, proceed to live session
    if (isLiveClassStarted) {
      try {
        // Mark attendance only when directly joining live session
        await markAttendance({
          sessionId: session.session_id,
          scheduleId: session.schedule_id,
          userSourceType: "USER",
          userSourceId: "",
          details: "Joined live class directly",
        });

        // Navigate to live session
        if (
          session.session_streaming_service_type ===
          SessionStreamingServiceType.EMBED
        ) {
          (navigate as any)({
            to: "/study-library/live-class/embed",
            search: { sessionId: session.schedule_id },
          });
        } else {
          window.open(session.meeting_link, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        console.error("Failed to mark attendance:", error);
        toast.error("Failed to mark attendance");

        // Still proceed with navigation even if attendance marking fails
        if (
          session.session_streaming_service_type ===
          SessionStreamingServiceType.EMBED
        ) {
          (navigate as any)({
            to: "/study-library/live-class/embed",
            search: { sessionId: session.schedule_id },
          });
        } else {
          window.open(session.meeting_link, "_blank", "noopener,noreferrer");
        }
      }
    } else {
      // This should not happen, but add a fallback
      console.warn("Unexpected timing state - no action taken");
      toast.error("Unable to determine session status. Please try again.");
    }
  };

  // Helper function to filter sessions based on date range and subject
  const filterSessions = (sessions: SessionDetails[]) => {
    return sessions.filter((session) => {
      // Use string comparison for YYYY-MM-DD which is more robust than Date objects
      const sessionDateStr = session.meeting_date;

      // Date range filter
      if (startDateFilter && sessionDateStr < startDateFilter) {
        return false;
      }

      if (endDateFilter && sessionDateStr > endDateFilter) {
        return false;
      }

      return true;
    });
  };

  // Reset pagination when filters change
  useEffect(() => {
    setApiPage(0);
  }, [startDateFilter, endDateFilter, selectedView]);

  // Helper function to determine if a session is currently live (in waiting room or active)
  const isSessionLive = useCallback((session: SessionDetails) => {
    // We access currentTime here just to ensure this function (and dependents) updating
    // But we still use new Date() for the most precise check at moment of execution
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tick = currentTime;
    const now = new Date();

    let sessionStart, sessionEnd, waitingRoomStart;

    if (session.timezone) {
      // Use timezone-aware calculation
      sessionStart = convertSessionTimeToUserTimezone(
        session.meeting_date,
        session.start_time,
        session.timezone
      );
      sessionEnd = convertSessionTimeToUserTimezone(
        session.meeting_date,
        session.last_entry_time,
        session.timezone
      );

      // If end time is before start time, session spans midnight - add 1 day
      if (sessionEnd < sessionStart) {
        sessionEnd = new Date(sessionEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      waitingRoomStart = new Date(sessionStart);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
    } else {
      // Fallback to original logic
      sessionStart = new Date(`${session.meeting_date}T${session.start_time}`);
      sessionEnd = new Date(`${session.meeting_date}T${session.last_entry_time}`);

      // If end time is before start time, session spans midnight - add 1 day
      if (sessionEnd < sessionStart) {
        sessionEnd = new Date(sessionEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      waitingRoomStart = new Date(sessionStart);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
    }

    // Session is considered "live" if:
    // 1. Current time is after waiting room start
    // 2. Current time is before session end
    return now >= waitingRoomStart && now <= sessionEnd;
  }, [currentTime]);

  const renderSession = (session: SessionDetails, isLive: boolean) => {
    // Calculate session timing for button text and status
    const now = new Date();
    let sessionDate, waitingRoomStart;

    if (session.timezone) {
      sessionDate = convertSessionTimeToUserTimezone(
        session.meeting_date,
        session.start_time,
        session.timezone
      );
      waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
    } else {
      sessionDate = new Date(`${session.meeting_date}T${session.start_time}`);
      waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
    }

    const isBeforeWaitingRoom = now < waitingRoomStart;
    const isInWaitingRoom = now >= waitingRoomStart && now < sessionDate;
    const isLiveClassStarted = now >= sessionDate;

    return (
      <div
        key={session.schedule_id}
        className="group p-4 border rounded-xl bg-white dark:bg-neutral-900 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 border-neutral-200 dark:border-neutral-800 hover:border-primary-200/60 dark:hover:border-primary-700/60 hover:shadow-sm transition-all duration-200 w-full"
      >
        {/* Desktop Layout: Button on the right */}
        <div className="hidden sm:flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-100 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                {session.title}
              </h3>
              {isLive && (
                <span
                  className={`px-2 py-1 text-white text-xs font-medium rounded-full animate-pulse whitespace-nowrap ${isInWaitingRoom
                    ? "bg-orange-600"
                    : isLiveClassStarted
                      ? "bg-danger-600"
                      : "bg-gray-600"
                    }`}
                >
                  {isInWaitingRoom
                    ? "WAITING ROOM"
                    : isLiveClassStarted
                      ? "LIVE"
                      : "STARTING SOON"}
                </span>
              )}
            </div>
            {/* Subject - Display if not 'none', for both Live and Upcoming */}
            {session.subject && session.subject.toLowerCase() !== 'none' && (
              <div className="flex items-center gap-1 text-sm text-neutral-600 mb-2">
                <MapPin
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="capitalize dark:text-neutral-300">
                  {session.subject}
                </span>
              </div>
            )}

            {/* Date - Display only for Upcoming sessions */}
            {!isLive && (
              <div className="flex items-center gap-1 text-sm text-neutral-600 mb-2">
                <Calendar
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="capitalize dark:text-neutral-300">
                  {new Date(session.meeting_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="text-neutral-600 dark:text-neutral-300">
                  <span className="font-medium">Starts:</span>{" "}
                  {formatDateTime(
                    session.meeting_date,
                    session.start_time,
                    session.timezone
                  )}
                  {session.timezone && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                      ({getTimezoneDisplayInfo(session.timezone).sessionTz})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="text-neutral-600 dark:text-neutral-300">
                  <span className="font-medium">Duration:</span>{" "}
                  {calculateDuration(session.start_time, session.last_entry_time)}
                </span>
              </div>
            </div>
          </div>

          {isLive && session.meeting_link && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
              onClick={() => handleJoinSession(session)}
            >
              <ArrowSquareOut size={16} className="mr-1.5" />
              {isBeforeWaitingRoom
                ? "Not Started"
                : isInWaitingRoom
                  ? "Join Waiting Room"
                  : "Join Session"}
            </Button>
          )}
        </div>

        {/* Mobile Layout: Button at the bottom */}
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-100 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                {session.title}
              </h3>
              {isLive && (
                <span
                  className={`px-2 py-1 text-white text-xs font-medium rounded-full animate-pulse whitespace-nowrap ${isInWaitingRoom
                    ? "bg-orange-600"
                    : isLiveClassStarted
                      ? "bg-danger-600"
                      : "bg-gray-600"
                    }`}
                >
                  {isInWaitingRoom
                    ? "WAITING ROOM"
                    : isLiveClassStarted
                      ? "LIVE"
                      : "STARTING SOON"}
                </span>
              )}
            </div>
            {/* Subject - Display if not 'none', for both Live and Upcoming */}
            {session.subject && session.subject.toLowerCase() !== 'none' && (
              <div className="flex items-center gap-1 text-sm text-neutral-600 mb-2">
                <MapPin
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="capitalize dark:text-neutral-300">
                  {session.subject}
                </span>
              </div>
            )}

            {/* Date - Display only for Upcoming sessions */}
            {!isLive && (
              <div className="flex items-center gap-1 text-sm text-neutral-600 mb-2">
                <Calendar
                  size={16}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="capitalize dark:text-neutral-300">
                  {new Date(session.meeting_date).toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock
                size={16}
                className="text-neutral-500 dark:text-neutral-400"
              />
              <span className="text-neutral-600 dark:text-neutral-300">
                <span className="font-medium">Starts:</span>{" "}
                {formatDateTime(
                  session.meeting_date,
                  session.start_time,
                  session.timezone
                )}
                {session.timezone && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                    ({getTimezoneDisplayInfo(session.timezone).sessionTz})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users
                size={16}
                className="text-neutral-500 dark:text-neutral-400"
              />
              <span className="text-neutral-600 dark:text-neutral-300">
                <span className="font-medium">Duration:</span>{" "}
                {calculateDuration(session.start_time, session.last_entry_time)}
              </span>
            </div>
          </div>

          {isLive && session.meeting_link && (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
              onClick={() => handleJoinSession(session)}
            >
              <ArrowSquareOut size={16} className="mr-1.5" />
              {isBeforeWaitingRoom
                ? "Not Started"
                : isInWaitingRoom
                  ? "Join Waiting Room"
                  : "Join Session"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Calendar view functions
  const getCurrentMonth = () => {
    return selectedDate.getMonth();
  };

  const getCurrentYear = () => {
    return selectedDate.getFullYear();
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getSessionsForDate = (date: Date) => {
    if (selectedView !== "calendar") return [];

    const formattedDate = formatDateToISO(date);

    return [
      ...(sessions?.live_sessions ?? []),
      ...(sessions?.upcoming_sessions ?? []),
    ].filter((session) => session.meeting_date === formattedDate);
  };


  const handleDayClick = (date: Date, sessionsForDay: SessionDetails[]) => {
    if (sessionsForDay.length > 0) {
      setSelectedDayData({ date, sessions: sessionsForDay });
      setDayModalOpen(true);
    }
  };

  const renderDayModal = () => {
    if (!selectedDayData) return null;

    const liveSessions = selectedDayData.sessions.filter((session) =>
      sessions?.live_sessions?.includes(session)
    );
    const upcomingSessions = selectedDayData.sessions.filter((session) =>
      sessions?.upcoming_sessions?.includes(session)
    );

    return (
      <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
              Classes on {formatDate(selectedDayData.date)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {liveSessions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-danger-600 animate-pulse"></div>
                  Live Sessions
                </h3>
                <div className="space-y-3">
                  {liveSessions
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((session) => (
                      <div
                        key={session.schedule_id}
                        className="p-4 border rounded-lg bg-gradient-to-r from-red-50/50 to-red-100/30 border-red-200 dark:from-red-950/30 dark:to-red-900/20 dark:border-red-900"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
                              {session.title}
                            </h4>
                            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>
                                  {formatDateTime(
                                    session.meeting_date,
                                    session.start_time,
                                    session.timezone
                                  )}{" "}
                                  -{" "}
                                  {formatDateTime(
                                    session.meeting_date,
                                    session.last_entry_time,
                                    session.timezone
                                  )}
                                  {session.timezone && (
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                                      (
                                      {
                                        getTimezoneDisplayInfo(session.timezone)
                                          .sessionTz
                                      }
                                      )
                                    </span>
                                  )}
                                </span>
                              </div>
                              {session.subject && session.subject.toLowerCase() !== "none" && (
                                <div className="flex items-center gap-1">
                                  <MapPin size={14} />
                                  <span className="capitalize dark:text-neutral-300">
                                    {session.subject}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {session.meeting_link && (
                            <Button
                              size="sm"
                              className="bg-danger-600 hover:bg-danger-700 text-white"
                              onClick={() => {
                                handleJoinSession(session);
                                setDayModalOpen(false);
                              }}
                            >
                              <ArrowSquareOut size={14} className="mr-1" />
                              Join
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {upcomingSessions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info-600"></div>
                  Upcoming Sessions
                </h3>
                <div className="space-y-3">
                  {upcomingSessions
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((session) => (
                      <div
                        key={session.schedule_id}
                        className="p-4 border rounded-lg bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-1">
                              {session.title}
                            </h4>
                            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>
                                  {formatDateTime(
                                    session.meeting_date,
                                    session.start_time,
                                    session.timezone
                                  )}{" "}
                                  -{" "}
                                  {formatDateTime(
                                    session.meeting_date,
                                    session.last_entry_time,
                                    session.timezone
                                  )}
                                  {session.timezone && (
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                                      (
                                      {
                                        getTimezoneDisplayInfo(session.timezone)
                                          .sessionTz
                                      }
                                      )
                                    </span>
                                  )}
                                </span>
                              </div>
                              {session.subject && session.subject.toLowerCase() !== "none" && (
                                <div className="flex items-center gap-1">
                                  <MapPin size={14} />
                                  <span className="capitalize dark:text-neutral-300">
                                    {session.subject}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {selectedDayData.sessions.length === 0 && (
              <div className="text-center py-8">
                <Clock size={48} className="mx-auto text-neutral-400 mb-3" />
                <p className="text-neutral-600 dark:text-neutral-300">
                  No classes scheduled for this day
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderCalendarView = () => {
    const month = getCurrentMonth();
    const year = getCurrentYear();
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="h-24 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        ></div>
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const sessionsForDay = getSessionsForDate(currentDate);
      const isToday = currentDate.toDateString() === new Date().toDateString();
      const hasLive = sessionsForDay.some((session) =>
        sessions?.live_sessions?.includes(session)
      );
      const sessionCount = sessionsForDay.length;

      days.push(
        <div
          key={day}
          className={`h-24 border border-neutral-200 dark:border-neutral-800 p-1 transition-all duration-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer ${isToday
            ? "bg-primary-50/50 border-primary-200 dark:bg-primary-950/30 dark:border-primary-700"
            : "bg-white dark:bg-neutral-900"
            } ${sessionCount > 0 ? "hover:shadow-sm" : ""}`}
          onClick={() => handleDayClick(currentDate, sessionsForDay)}
        >
          <div
            className={`text-sm font-medium mb-1 flex items-center justify-between ${isToday
              ? "text-primary-700 dark:text-primary-300"
              : "text-neutral-700 dark:text-neutral-200"
              }`}
          >
            <span>{day}</span>
            {sessionCount > 0 && (
              <div
                className={`flex items-center gap-1 ${hasLive
                  ? "text-red-600 dark:text-red-400"
                  : "text-blue-600 dark:text-blue-400"
                  }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${hasLive ? "bg-danger-600 animate-pulse" : "bg-info-600"
                    }`}
                ></div>
                <span className="text-xs font-semibold">{sessionCount}</span>
              </div>
            )}
          </div>

          {/* Compact session indicators */}
          <div className="space-y-1">
            {sessionsForDay.slice(0, 1).map((session) => {
              const isLive = sessions?.live_sessions?.includes(session);
              return (
                <div
                  key={session.schedule_id}
                  className={`text-xs p-1 rounded truncate transition-all duration-200 ${isLive
                    ? "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
                    : "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                    }`}
                  title={`${session.title} - ${session.start_time}${session.timezone
                    ? ` (${getTimezoneDisplayInfo(session.timezone).sessionTz
                    })`
                    : ""
                    }`}
                >
                  {formatSessionTimeInUserTimezone(
                    session.meeting_date,
                    session.start_time,
                    session.timezone
                  ).slice(0, 5)}{" "}
                  {session.title}
                </div>
              );
            })}

            {sessionCount > 1 && (
              <div
                className={`text-xs text-center font-medium rounded py-1 ${hasLive
                  ? "bg-red-100/80 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
                  : "bg-blue-100/80 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                  }`}
              >
                +{sessionCount - 1} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
              className="border-neutral-300 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              className="border-neutral-300 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
              className="border-neutral-300 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              →
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0">
          {/* Day headers */}
          {dayNames.map((day) => (
            <div
              key={day}
              className="h-10 border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-medium text-sm text-neutral-700 dark:text-neutral-200"
            >
              {day}
            </div>
          ))}
          {/* Calendar days */}
          {days}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-200 dark:from-red-900/40 dark:to-red-800/40 dark:border-red-900"></div>
            <span className="text-neutral-600 dark:text-neutral-300">
              Live Sessions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900"></div>
            <span className="text-neutral-600 dark:text-neutral-300">
              Upcoming Sessions
            </span>
          </div>
          <div className="text-neutral-500 dark:text-neutral-400 text-xs italic">
            Click on a day to view all classes
          </div>
        </div>
      </div>
    );
  };

  // Combine and re-classify sessions dynamically
  // This ensures that if a session enters waiting room, it moves to "Live" immediately
  const { derivedLiveSessions, derivedUpcomingSessions } = useMemo(() => {
    if (!sessions) return { derivedLiveSessions: [], derivedUpcomingSessions: [] };

    // Combine all sessions from backend (since backend categorization might lag behind client time)
    const allSessions = [
      ...(sessions.live_sessions || []),
      ...(sessions.upcoming_sessions || []),
    ];

    // Deduplicate in case API returns same session in both
    const uniqueSessionsMap = new Map<string, SessionDetails>();
    allSessions.forEach(s => uniqueSessionsMap.set(s.schedule_id, s));
    const uniqueSessions = Array.from(uniqueSessionsMap.values());

    const live: SessionDetails[] = [];
    const upcoming: SessionDetails[] = [];

    uniqueSessions.forEach(session => {
      if (isSessionLive(session)) {
        live.push(session);
      } else {
        upcoming.push(session);
      }
    });

    // Sort live sessions: earliest start time first
    live.sort((a, b) => {
      const startA = new Date(`${a.meeting_date}T${a.start_time}`).getTime();
      const startB = new Date(`${b.meeting_date}T${b.start_time}`).getTime();
      return startA - startB;
    });

    // Sort upcoming sessions: earliest start time first
    upcoming.sort((a, b) => {
      const startA = new Date(`${a.meeting_date}T${a.start_time}`).getTime();
      const startB = new Date(`${b.meeting_date}T${b.start_time}`).getTime();
      return startA - startB;
    });

    return { derivedLiveSessions: live, derivedUpcomingSessions: upcoming };
  }, [sessions, isSessionLive]); // Re-calculate when sessions change or isSessionLive logic changes (which depends on currentTime)

  if (isLoading) {
    return (
      <LayoutContainer>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <div className="text-neutral-600 dark:text-neutral-300">
              Loading sessions...
            </div>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  if (error) {
    return (
      <LayoutContainer>
        <div className="p-4 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <span className="font-medium">Error loading sessions:</span>
            <span>{(error as Error).message}</span>
          </div>
        </div>
      </LayoutContainer>
    );
  }

  const liveSessions = selectedView === "list" ? derivedLiveSessions : [];
  const upcomingSessions = selectedView === "list" ? derivedUpcomingSessions : [];
  return (
    <LayoutContainer>
      <Helmet>
        <title>{document?.title || "Live Classes"}</title>
        <meta name="description" content="Live and upcoming class sessions" />
      </Helmet>

      <div className="space-y-6">
        {/* View Toggle */}
        <Tabs
          value={selectedView}
          onValueChange={setSelectedView}
          className="w-full"
        >
          <TabsList className="h-auto border-b border-neutral-200/80 dark:border-neutral-800 bg-transparent p-0">
            <TabsTrigger
              value="list"
              className="data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 dark:hover:from-primary-900/20 dark:hover:to-transparent focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-primary-50/30 dark:data-[state=active]:from-neutral-900 dark:data-[state=active]:to-primary-900/20 data-[state=inactive]:text-neutral-500 dark:data-[state=inactive]:text-neutral-400 data-[state=inactive]:hover:rounded-t-lg"
            >
              <List size={18} className="mr-2" />
              List View
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-4 py-2 text-sm font-medium transition-all duration-200 hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 dark:hover:from-primary-900/20 dark:hover:to-transparent focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1 data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-primary-50/30 dark:data-[state=active]:from-neutral-900 dark:data-[state=active]:to-primary-900/20 data-[state=inactive]:text-neutral-500 dark:data-[state=inactive]:text-neutral-400 data-[state=inactive]:hover:rounded-t-lg"
            >
              <Calendar size={18} className="mr-2" />
              Calendar View
            </TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-6" key={`list-view-${apiPage}`}>
            <div className={`space-y-6 transition-opacity duration-200 ${isFetching && !isLoading ? 'opacity-50' : 'opacity-100'}`} key={`page-${apiPage}`}>
              {/* Live Sessions Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                    {getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)}s - {getUserTimezone()}
                  </h2>
                  {liveSessions.length > 0 && (
                    <span className="text-sm text-neutral-600 dark:text-neutral-300">
                      {liveSessions.length} session
                      {liveSessions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {liveSessions.length > 0 ? (
                  <div className="space-y-4 w-full">
                    {liveSessions.map((session) =>
                      renderSession(session, isSessionLive(session))
                    )}
                  </div>
                ) : (sessions as any)?.defaultDayConfig?.defaultClassLink ? (
                  <div className="w-full">
                    <DefaultClassCard
                      defaultClassLink={(sessions as any)?.defaultDayConfig?.defaultClassLink}
                      learnerButtonConfig={(sessions as any)?.defaultDayConfig?.learnerButtonConfig}
                      defaultClassName={(sessions as any)?.defaultDayConfig?.defaultClassName}
                    />
                  </div>
                ) : (
                  <div className="text-neutral-600 dark:text-neutral-300 p-4 sm:p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-900/60 rounded-lg w-full border border-neutral-200 dark:border-neutral-800">
                    <div className="text-center">
                      <Users
                        size={48}
                        className="mx-auto text-neutral-400 dark:text-neutral-500 mb-3"
                      />
                      <p className="font-medium">
                        No {getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession).toLowerCase()}s at the moment
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                        Check back later or view upcoming {getTerminology(ContentTerms.Session, SystemTerms.Session).toLowerCase()}s
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upcoming Sessions Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                    Upcoming {getTerminology(ContentTerms.Session, SystemTerms.Session)}s
                  </h2>
                  {(() => {
                    const filteredUpcomingSessions =
                      filterSessions(upcomingSessions);
                    return (
                      filteredUpcomingSessions.length > 0 && (
                        <span className="text-sm text-neutral-600 dark:text-neutral-300">
                          {filteredUpcomingSessions.length} session
                          {filteredUpcomingSessions.length !== 1
                            ? "s"
                            : ""}{" "}
                          found
                        </span>
                      )
                    );
                  })()}
                </div>

                {/* Filters Section - Below Upcoming Sessions title */}
                <div className="p-2 sm:p-4 bg-gradient-to-r from-white to-neutral-50/50 dark:from-neutral-900 dark:to-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-lg mb-4">
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-4">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <FunnelSimple
                        size={16}
                        className="text-neutral-600 dark:text-neutral-300 sm:w-[18px] sm:h-[18px]"
                      />
                      <h3 className="text-sm sm:text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                        Filters
                      </h3>
                    </div>
                    {(startDateFilter || endDateFilter) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="border-red-300 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-400 dark:hover:border-red-800 h-7 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                      >
                        <X size={12} className="mr-0.5 sm:mr-1 sm:w-[14px] sm:h-[14px]" />
                        <span className="hidden xs:inline">Clear </span>Filters
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div>
                      <label className="block text-[10px] sm:text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1 sm:mb-2">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={startDateFilter}
                        min={formatDateToISO(new Date())}
                        onChange={(e) => {
                          setStartDateFilter(e.target.value);
                          setApiPage(0);
                        }}
                        className="w-full text-xs sm:text-sm h-8 sm:h-10"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1 sm:mb-2">
                        End Date
                      </label>
                      <Input
                        type="date"
                        value={endDateFilter}
                        min={startDateFilter || formatDateToISO(new Date())}
                        onChange={(e) => {
                          setEndDateFilter(e.target.value);
                          setApiPage(0);
                        }}
                        className="w-full text-xs sm:text-sm h-8 sm:h-10"
                      />
                    </div>
                  </div>
                </div>
                {(() => {
                  const filteredUpcomingSessions =
                    filterSessions(upcomingSessions);

                  // Client-side pagination
                  const startIndex = upcomingPage * SESSIONS_PER_PAGE;
                  const endIndex = startIndex + SESSIONS_PER_PAGE;
                  const paginatedSessions = filteredUpcomingSessions.slice(startIndex, endIndex);
                  const totalPages = Math.ceil(filteredUpcomingSessions.length / SESSIONS_PER_PAGE);

                  return (
                    <>
                      {filteredUpcomingSessions.length > 0 ? (
                        <>
                          <div className="space-y-4 w-full">
                            {paginatedSessions.map((session) =>
                              renderSession(session, false)
                            )}
                          </div>

                          {/* Client-side pagination for upcoming sessions */}
                          <div className="mt-6 flex items-center justify-center gap-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUpcomingPage(p => Math.max(0, p - 1))}
                              disabled={upcomingPage === 0}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-neutral-600 dark:text-neutral-300">
                              Page {upcomingPage + 1} of {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUpcomingPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={upcomingPage >= totalPages - 1}
                            >
                              Next
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-neutral-600 dark:text-neutral-300 p-4 sm:p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-900/60 rounded-lg w-full border border-neutral-200 dark:border-neutral-800">
                          <div className="text-center">
                            <Clock
                              size={48}
                              className="mx-auto text-neutral-400 dark:text-neutral-500 mb-3"
                            />
                            <p className="font-medium">
                              {startDateFilter || endDateFilter
                                ? `No upcoming ${getTerminology(ContentTerms.Session, SystemTerms.Session).toLowerCase()}s match your filters`
                                : `No upcoming ${getTerminology(ContentTerms.Session, SystemTerms.Session).toLowerCase()}s scheduled`}
                            </p>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                              {startDateFilter || endDateFilter
                                ? "Try adjusting your filters or clear them to see all sessions"
                                : `New ${getTerminology(ContentTerms.Session, SystemTerms.Session).toLowerCase()}s will appear here when scheduled`}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* API Pagination - To navigate through the sized results */}
              {(sessions as any)?.totalReturned >= 500 || apiPage > 0 ? (
                <div className="mt-12 flex flex-col items-center gap-4 border-t pt-8">
                  <div className="text-sm text-neutral-500">
                    Viewing Page {apiPage + 1}
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setApiPage((p) => Math.max(0, p - 1));

                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={apiPage === 0}
                    >
                      Previous Sessions
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setApiPage(apiPage + 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={!hasNextPage}

                    >
                      Next Sessions
                    </Button>
                  </div>
                </div>
              ) : null}


            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            {renderCalendarView()}
          </TabsContent>
        </Tabs >

        {/* Day Details Modal */}
        {renderDayModal()}
      </div >
    </LayoutContainer >
  );
}
