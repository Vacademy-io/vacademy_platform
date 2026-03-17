import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { fetchStaticData } from "./-lib/utils";
import { Helmet } from "react-helmet";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  getPackageSessionId,
  getAllPackageSessionIds,
} from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { getStudyLibraryQuery } from "@/services/study-library/getStudyLibraryDetails";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { useQuery } from "@tanstack/react-query";
import {
  DashbaordResponse,
  DashboardSlide,
} from "./-types/dashboard-data-types";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { PastLearningInsights } from "./-components/PastLearningInsights";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { useLiveSessions } from "../study-library/live-class/-hooks/useLiveSessions";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Users,
  Trophy,
  Calendar,
  Clock,
  Play,
  Bell,
  CheckCircle,
  XCircle,
  Hourglass,
  TrendUp,
} from "@phosphor-icons/react";
import { ChevronRight, Sparkles, Video } from "lucide-react";
import { SessionDetails } from "../study-library/live-class/-types/types";
import { useMarkAttendance } from "../study-library/live-class/-hooks/useMarkAttendance";
import { SessionStreamingServiceType } from "../register/live-class/-types/enum";
import { toast } from "sonner";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { useWeeklyAttendanceQuery } from "@/services/attendance/getWeeklyAttendance";
import type { StudentDashboardWidgetConfig } from "@/types/student-display-settings";
import { DashboardPinsPanel } from "@/components/announcements";
import { RecentSystemNotifications } from "./-components/RecentSystemNotifications";
import { useServerTime } from "@/hooks/use-server-time";
import {
  convertSessionTimeToUserTimezone,
  formatSessionTimeInUserTimezone,
} from "@/utils/timezone";
import { StatCard } from "./-components/DashboardStatCard";
import { ContinueLearningCard } from "./-components/DashboardContinueLearningCard";
import { cn } from "@/lib/utils";
import { getChatbotSettings } from "@/services/chatbot-settings";
import { MyMembershipWidget } from "./-components/MyMembershipWidget";
import { MyBooksWidget } from "./-components/MyBooksWidget";
import { UpcomingLiveClassesWidget } from "./-components/UpcomingLiveClassesWidget";
import { Preferences } from "@capacitor/preferences";

export const Route = createFileRoute("/dashboard/")({
  component: () => {
    return (
      <LayoutContainer>
        <DashboardComponent />
      </LayoutContainer>
    );
  },
});

export function DashboardComponent() {
  const [username, setUsername] = useState<string | null>(null);
  const [testAssignedCount, setTestAssignedCount] = useState<number>(0);
  const [homeworkAssignedCount, setHomeworkAssignedCount] = useState<number>(0);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [allBatchIds, setAllBatchIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showForInstitutes } = useInstituteFeatureStore();
  const { mutateAsync: markAttendance } = useMarkAttendance();
  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const { setStudyLibraryData } = useStudyLibraryStore();
  const [data, setData] = useState<DashbaordResponse | null>(null);
  const { setActiveItem } = useContentStore();
  const { getUserTimezone } = useServerTime();

  // Fetch study library data with React Query (5-minute cache)
  const { data: studyLibraryData } = useQuery(getStudyLibraryQuery(batchId));

  // Add weekly attendance query
  const { data: weeklyAttendance, isLoading: isLoadingAttendance } =
    useWeeklyAttendanceQuery();
  const {
    data: liveSessions,
    isLoading: isLoadingLiveSessions,
    refetch: refetchLiveSessions,
  } = useLiveSessions(allBatchIds, { size: 10 });

  // Initialize analytics tracking
  const { trackPageView, track, trackLessonStarted } = useAnalytics();
  const [widgetConfigs, setWidgetConfigs] = useState<
    StudentDashboardWidgetConfig[] | null
  >(null);

  // If settings specify a different post-login route, redirect away from dashboard
  useEffect(() => {
    getStudentDisplaySettings(false)
      .then((s) => {
        const route = s?.postLoginRedirectRoute || "/dashboard";
        if (
          route !== "/dashboard" &&
          !/^https?:\/\//.test(route) &&
          route !== window.location.pathname
        ) {
          // prevent redirect loop and ignore external URLs
          navigate({ to: route as never, replace: true });
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Zustand store when React Query data changes
  useEffect(() => {
    if (studyLibraryData) {
      setStudyLibraryData(studyLibraryData);
    }
  }, [studyLibraryData, setStudyLibraryData]);

  const handleResumeClick = (slide: DashboardSlide) => {
    // Track lesson resumed
    trackLessonStarted(slide.slide_id, slide.slide_title, slide.subject_id);

    track("Resume Learning", {
      slideId: slide.slide_id,
      slideTitle: slide.slide_title,
      subjectId: slide.subject_id,
      moduleId: slide.module_id,
      chapterId: slide.chapter_id,
      sourceType: slide.source_type,
    });

    setActiveItem({
      id: slide.slide_id,
      source_id: "",
      source_type: slide.source_type,
      title: slide.slide_title,
      image_file_id: "",
      description: slide.slide_description,
      status: slide.status,
      slide_order: 0,
      is_loaded: false,
      new_slide: false,
      percentage_completed: 0,
      progress_marker: slide.progress_marker,
    });
    navigate({
      to: `/study-library/courses/course-details/subjects/modules/chapters/slides?subjectId=${slide.subject_id}&moduleId=${slide.module_id}&chapterId=${slide.chapter_id}&slideId=${slide.slide_id}`,
    });
  };

  useEffect(() => {
    // Force-refresh Student Display Settings on dashboard mount to update local cache
    getStudentDisplaySettings(true).catch(() => { });
    getChatbotSettings(true).catch(() => { });

    const fetchIds = async () => {
      try {
        const id = await getPackageSessionId();
        setBatchId(id);

        const ids = await getAllPackageSessionIds();
        setAllBatchIds(ids);
      } catch (error) {
        console.error("Error fetching IDs:", error);
      }
    };
    fetchIds();
  }, [trackPageView, setNavHeading]);

  // Load dashboard widget configurations
  useEffect(() => {
    getStudentDisplaySettings(false)
      .then((s) => {
        setWidgetConfigs(s?.dashboard?.widgets || []);
      })
      .catch(() => setWidgetConfigs(null));
  }, [setNavHeading, trackPageView]);

  const isWidgetVisible = (id: StudentDashboardWidgetConfig["id"]) => {
    const cfg = widgetConfigs?.find((w) => w.id === id);
    return cfg ? cfg.visible !== false : true;
  };

  const getWidgetOrder = (id: StudentDashboardWidgetConfig["id"]) => {
    const cfg = widgetConfigs?.find((w) => w.id === id);
    return cfg?.order ?? Number.MAX_SAFE_INTEGER;
  };

  const customWidget = widgetConfigs?.find(
    (w) => w.id === "custom" && w.visible !== false
  );

  useEffect(() => {
    if (batchId) {
      const interval = setInterval(() => {
        refetchLiveSessions();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [batchId, refetchLiveSessions]);

  useEffect(() => {
    setNavHeading("Dashboard");
    const initializeDashboard = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchStaticData(
            setUsername,
            setTestAssignedCount,
            setHomeworkAssignedCount,
            setData
          ),
        ]);

        // Track dashboard page view
        trackPageView("Dashboard");
      } catch (error) {
        console.error("Error initializing dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeDashboard();
  }, [setNavHeading, trackPageView]);

  const handleJoinSession = async (session: SessionDetails) => {
    // Track live session join attempt
    track("Live Session Join Attempted", {
      sessionId: session.session_id,
      sessionTitle: session.title,
      scheduleId: session.schedule_id,
      streamingType: session.session_streaming_service_type,
      meetingDate: session.meeting_date,
      startTime: session.start_time,
    });

    const now = new Date();
    const sessionDate = new Date(
      `${session.meeting_date}T${session.start_time}`
    );
    const waitingRoomStart = new Date(sessionDate);
    waitingRoomStart.setMinutes(
      waitingRoomStart.getMinutes() - session.waiting_room_time
    );

    let convertedSessionDate = sessionDate;
    try {
      if (session.timezone) {
        convertedSessionDate = convertSessionTimeToUserTimezone(
          session.meeting_date,
          session.start_time,
          session.timezone
        );
      }
    } catch (error) {
      console.error("Error converting session time for comparison:", error);
    }

    const isInWaitingRoom =
      now >= waitingRoomStart && now < convertedSessionDate;
    const isInMainSession = now >= convertedSessionDate;

    if (isInWaitingRoom) {
      track("Live Session Waiting Room Entered", {
        sessionId: session.session_id,
        sessionTitle: session.title,
      });
      navigate({
        to: "/study-library/live-class/waiting-room",
        search: { sessionId: session.schedule_id },
      });
    } else if (isInMainSession) {
      try {
        await markAttendance({
          sessionId: session.session_id,
          scheduleId: session.schedule_id,
          userSourceType: "USER",
          userSourceId: "",
          details: "Joined live class directly",
        });

        track("Live Session Joined Successfully", {
          sessionId: session.session_id,
          sessionTitle: session.title,
          streamingType: session.session_streaming_service_type,
          joinMethod:
            session.session_streaming_service_type ===
              SessionStreamingServiceType.EMBED
              ? "embed"
              : "external_link",
        });

        if (
          session.session_streaming_service_type ===
          SessionStreamingServiceType.EMBED
        ) {
          navigate({
            to: "/study-library/live-class/embed",
            search: {
              sessionId: session.schedule_id,
              learnerButtonConfig: session.learner_button_config ?? undefined,
            },
          });
        } else {
          window.open(session.meeting_link, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        console.error("Failed to mark attendance:", error);
        toast.error("Failed to mark attendance");

        if (
          session.session_streaming_service_type ===
          SessionStreamingServiceType.EMBED
        ) {
          navigate({
            to: "/study-library/live-class/embed",
            search: {
              sessionId: session.schedule_id,
              learnerButtonConfig: session.learner_button_config ?? undefined,
            },
          });
        } else {
          window.open(session.meeting_link, "_blank", "noopener,noreferrer");
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden w-full dashboard-container smooth-scroll">
      <Helmet>
        <title>
          {typeof document !== "undefined" && document.title
            ? document.title
            : "Dashboard"}
        </title>
        <meta
          name="description"
          content="Enterprise Dashboard - Learning Management System"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </Helmet>

      <div className="relative z-10 space-y-4 p-3 sm:p-4 lg:p-6 mx-auto w-full max-w-7xl animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-background shadow-sm">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {username?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? (
                  <Skeleton className="h-8 w-48" />
                ) : (
                  <span>
                    {`Welcome back, ${username ||
                      getTerminology(RoleTerms.Learner, SystemTerms.Learner)
                      }!`}{" "}
                    <span className="hidden sm:inline-block origin-bottom-right rotate-12">
                      👋
                    </span>
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground mt-1 flex items-center space-x-2">
                {showForInstitutes([HOLISTIC_INSTITUTE_ID]) ? (
                  <>
                    <Sparkles size={16} className="text-primary" />
                    <span>Ready for today's yoga journey?</span>
                  </>
                ) : (
                  <>
                    <TrendUp size={16} className="text-primary" />
                    <span>Your learning dashboard overview</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <div className="bg-card border rounded-lg px-4 py-2 shadow-sm">
              <div className="flex items-center text-muted-foreground gap-2">
                <Calendar weight="duotone" size={16} className="text-primary" />
                <span className="font-medium text-sm">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Pins Panel */}
        <DashboardPinsPanel maxPins={3} />

        {/* Recent System Notifications Widget */}
        <RecentSystemNotifications />

        {!showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
          <>
            {/* Stats and Widgets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  id: "coursesStat" as const,
                  className: "",
                  render: (
                    <StatCard
                      title={`${getTerminology(
                        ContentTerms.Course,
                        SystemTerms.Course
                      )}s`}
                      count={data?.courses || 0}
                      icon={BookOpen}
                      onClick={() => {
                        track("Dashboard Card Clicked", {
                          cardType: "Courses",
                          count: data?.courses || 0,
                        });
                        navigate({ to: "/study-library/courses" });
                      }}
                      isLoading={isLoading}
                      className="[.ui-vibrant_&]:bg-sky-50 [.ui-vibrant_&]:border-sky-200 dark:[.ui-vibrant_&]:bg-sky-950/30 dark:[.ui-vibrant_&]:border-sky-800/50"
                      iconClassName="[.ui-vibrant_&]:text-sky-600 dark:[.ui-vibrant_&]:text-sky-300 [.ui-vibrant_&]:bg-sky-100 dark:[.ui-vibrant_&]:bg-sky-500/20"
                    />
                  ),
                },
                {
                  id: "thisWeekAttendance" as const,
                  className: "",
                  render: (
                    <StatCard
                      title="Attendance"
                      count={
                        weeklyAttendance?.days?.filter(
                          (d) => d.status === "PRESENT"
                        ).length || 0
                      }
                      icon={Clock}
                      onClick={() =>
                        navigate({ to: "/learning-centre/attendance" })
                      }
                      isLoading={isLoadingAttendance}
                      className="[.ui-vibrant_&]:bg-emerald-50 [.ui-vibrant_&]:border-emerald-200 dark:[.ui-vibrant_&]:bg-emerald-950/30 dark:[.ui-vibrant_&]:border-emerald-800/50"
                      iconClassName="[.ui-vibrant_&]:text-emerald-600 dark:[.ui-vibrant_&]:text-emerald-300 [.ui-vibrant_&]:bg-emerald-100 dark:[.ui-vibrant_&]:bg-emerald-500/20"
                    />
                  ),
                },
                {
                  id: "liveClasses" as const,
                  className: "",
                  render: (
                    <StatCard
                      title="Live Classes"
                      count={liveSessions?.live_sessions?.length || 0}
                      icon={Play}
                      onClick={() =>
                        navigate({ to: "/study-library/live-class" })
                      }
                      isLoading={isLoadingLiveSessions}
                      className="[.ui-vibrant_&]:bg-rose-50 [.ui-vibrant_&]:border-rose-200 dark:[.ui-vibrant_&]:bg-rose-950/30 dark:[.ui-vibrant_&]:border-rose-800/50"
                      iconClassName="[.ui-vibrant_&]:text-rose-600 dark:[.ui-vibrant_&]:text-rose-300 [.ui-vibrant_&]:bg-rose-100 dark:[.ui-vibrant_&]:bg-rose-500/20"
                    />
                  ),
                },
                {
                  id: "evaluationStat" as const,
                  className: "",
                  render: (
                    <StatCard
                      title="Assessments"
                      count={testAssignedCount}
                      icon={Trophy}
                      onClick={() => {
                        track("Dashboard Card Clicked", {
                          cardType: "Evaluations",
                          count: testAssignedCount,
                        });
                        navigate({ to: "/assessment/examination" });
                      }}
                      isLoading={isLoading}
                      className="[.ui-vibrant_&]:bg-amber-50 [.ui-vibrant_&]:border-amber-200 dark:[.ui-vibrant_&]:bg-amber-950/30 dark:[.ui-vibrant_&]:border-amber-800/50"
                      iconClassName="[.ui-vibrant_&]:text-amber-600 dark:[.ui-vibrant_&]:text-amber-300 [.ui-vibrant_&]:bg-amber-100 dark:[.ui-vibrant_&]:bg-amber-500/20"
                    />
                  ),
                },
                {
                  id: "continueLearning" as const,
                  className: "sm:col-span-2",
                  render: (
                    <ContinueLearningCard
                      data={data}
                      onResumeClick={handleResumeClick}
                    />
                  ),
                },
                {
                  id: "learningAnalytics" as const,
                  className: "sm:col-span-2 lg:col-span-4",
                  render: <PastLearningInsights />,
                },
                {
                  id: "dailyProgress" as const,
                  className: "",
                  render: null,
                },
                {
                  id: "activityTrend" as const,
                  className: "",
                  render: null,
                },
                {
                  id: "liveClasses" as const,
                  className: "",
                  render: null,
                },
                {
                  id: "thisWeekAttendance" as const,
                  className: "",
                  render: null,
                },
                {
                  id: "custom" as const,
                  className: "",
                  render: customWidget ? (
                    <Card
                      className={cn(
                        "transition-shadow",
                        "[.ui-vibrant_&]:border-primary/20",
                        "[.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-card [.ui-vibrant_&]:to-primary/5"
                      )}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          {customWidget.title || "Custom Widget"}
                        </CardTitle>
                        {customWidget.subTitle && (
                          <CardDescription>
                            {customWidget.subTitle}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        {customWidget.link && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = customWidget.link as string;
                              if (/^https?:\/\//.test(link)) {
                                window.open(link, "_blank");
                              } else {
                                navigate({ to: link as never });
                              }
                            }}
                            className="w-full justify-between"
                          >
                            Open <ChevronRight size={14} />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ) : null,
                },
                {
                  id: "upcomingLiveClasses" as const,
                  className: "sm:col-span-2 lg:col-span-4",
                  render: (
                    <UpcomingLiveClassesWidget
                      liveSessions={liveSessions?.live_sessions || []}
                      upcomingSessions={liveSessions?.upcoming_sessions || []}
                      isLoading={isLoadingLiveSessions}
                      onJoinSession={handleJoinSession}
                    />
                  ),
                },
                {
                  id: "myMembership" as const,
                  className: "sm:col-span-2",
                  render: <MyMembershipWidget />,
                },
                {
                  id: "myBooks" as const,
                  className: "sm:col-span-2",
                  render: <MyBooksWidget />,
                },
              ]
                .filter((w) => isWidgetVisible(w.id) && w.render)
                .sort((a, b) => getWidgetOrder(a.id) - getWidgetOrder(b.id))
                .map((w, idx) => (
                  <div key={`${String(w.id)}-${idx}`} className={w.className}>
                    {w.render}
                  </div>
                ))}
            </div>

            {/* Developer Test Section - Only in development */}
            {process.env.NODE_ENV === "development" && (
              <Card className="border-dashed border-orange-300 bg-orange-50/50">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                    <Bell weight="duotone" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-900">
                      Developer Testing
                    </h3>
                    <p className="text-sm text-orange-700">
                      Test push notification functionality
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Explore Buttons Section */}
            {!showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
              <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pb-12 px-4">
                {isWidgetVisible("myMembership") && (
                  <Button
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 py-2 px-6 h-9 text-xs font-bold"
                    onClick={async () => {
                      sessionStorage.setItem("levelFilter", "rent");
                      const details = await Preferences.get({ key: "InstituteDetails" });
                      const themeCode = details.value ? JSON.parse(details.value).institute_theme_code : "";
                      const tagName = themeCode || "collections";
                      navigate({ to: "/collections" as never });
                    }}
                  >
                    Explore Memberships
                    <ChevronRight size={14} />
                  </Button>
                )}
                {isWidgetVisible("myBooks") && (
                  <Button
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 py-2 px-6 h-9 text-xs font-bold"
                    onClick={async () => {
                      sessionStorage.setItem("levelFilter", "buy");
                      const details = await Preferences.get({ key: "InstituteDetails" });
                      const themeCode = details.value ? JSON.parse(details.value).institute_theme_code : "";
                      const tagName = themeCode || "collections";
                      navigate({ to: "/collections" as never });
                    }}
                  >
                    Explore Books
                    <ChevronRight size={14} />
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Hero Section */}
              <div className="lg:col-span-8">
                <Card className="h-full overflow-hidden border-0 shadow-sm relative bg-white">
                  <CardContent className="p-0 relative h-full flex items-center justify-center min-h-[300px]">
                    <img
                      src="/yoga-dashboard.png"
                      alt="Yoga illustration"
                      className="object-contain max-h-[280px]"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Attendance Section */}
              <div className="lg:col-span-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          weight="duotone"
                          size={18}
                          className="text-primary"
                        />
                        <span>This Week</span>
                      </div>
                      {weeklyAttendance?.weekRange && (
                        <span className="text-xs text-muted-foreground font-normal">
                          {weeklyAttendance.weekRange}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-1">
                      {isLoadingAttendance
                        ? [...Array(7)].map((_, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-1 p-2 border rounded-md"
                          >
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-3 w-8" />
                          </div>
                        ))
                        : (weeklyAttendance?.days || []).map((dayData) => {
                          let Icon = Hourglass;
                          let colorClass = "text-muted-foreground";

                          switch (dayData.status) {
                            case "PRESENT":
                              Icon = CheckCircle;
                              colorClass = "text-green-500";
                              break;
                            case "ABSENT":
                              Icon = XCircle;
                              colorClass = "text-red-500";
                              break;
                            case "PENDING":
                              Icon = Hourglass;
                              colorClass = "text-yellow-500";
                              break;
                            case "NO_CLASS":
                              Icon = Clock;
                              colorClass = "text-muted-foreground";
                              break;
                          }

                          return (
                            <div
                              key={dayData.day}
                              className={cn(
                                "flex flex-col items-center gap-1 p-2 border rounded-md text-center transition-colors",
                                dayData.status === "PENDING" ||
                                  dayData.status === "NO_CLASS"
                                  ? "opacity-60"
                                  : "bg-muted/10"
                              )}
                            >
                              <Icon
                                size={16}
                                className={colorClass}
                                weight="duotone"
                              />
                              <span className="text-[10px] font-medium text-muted-foreground truncate w-full">
                                {dayData.day}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <Users weight="duotone" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">
                          Refer A Friend
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Share the journey
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary">
                      Invite
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Live Classes Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                    <Video size={18} />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-base">My Classes</CardTitle>
                    <CardDescription className="text-xs">
                      {getUserTimezone()}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ to: "/study-library/live-class" })}
                >
                  View All <ChevronRight size={14} className="ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingLiveSessions ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-9 w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {liveSessions?.live_sessions?.map((session, index) => (
                      <div
                        key={`live-${session.session_id}-${index}`}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-green-100 rounded-lg text-green-700">
                            <Video size={16} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm truncate">
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
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <Badge
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Live
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => handleJoinSession(session)}
                          >
                            Join Now
                          </Button>
                        </div>
                      </div>
                    ))}

                    {liveSessions?.upcoming_sessions
                      ?.slice(0, 2)
                      .map((session, index) => (
                        <div
                          key={`upcoming-${session.session_id}-${index}`}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                              <Calendar weight="duotone" size={16} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm truncate">
                                {session.title}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  `${session.meeting_date}T${session.start_time}`
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                at{" "}
                                {formatSessionTimeInUserTimezone(
                                  session.meeting_date,
                                  session.start_time,
                                  session.timezone
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-700 border-blue-200"
                          >
                            Upcoming
                          </Badge>
                        </div>
                      ))}

                    {!liveSessions?.live_sessions?.length &&
                      !liveSessions?.upcoming_sessions?.length && (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                            <Video
                              size={20}
                              className="text-muted-foreground"
                            />
                          </div>
                          <h3 className="font-semibold text-sm">
                            No classes scheduled
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 mb-4">
                            Check back later for upcoming live classes
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate({ to: "/study-library/live-class" })
                            }
                          >
                            View All Classes
                          </Button>
                        </div>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
