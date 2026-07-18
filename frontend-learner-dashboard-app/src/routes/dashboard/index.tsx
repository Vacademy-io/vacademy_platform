import { useEffect, useMemo, useState } from "react";
import { openInBrowser } from "@/lib/open-in-browser";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ModernCard } from "@/components/design-system/modern-card";
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
  MinusCircle,
  Hourglass,
  CaretRight,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react";
import { SessionDetails } from "../study-library/live-class/-types/types";
import { isBbbSession, openBbbJoinForLearner } from "@/lib/live-class/bbb-join";
import { useMarkAttendance } from "../study-library/live-class/-hooks/useMarkAttendance";
import { SessionStreamingServiceType } from "../register/live-class/-types/enum";
import { toast } from "sonner";
import { getTerminology, getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { useWeeklyAttendanceQuery } from "@/services/attendance/getWeeklyAttendance";
import type { StudentDashboardWidgetConfig } from "@/types/student-display-settings";
import { DashboardPinsPanel } from "@/components/announcements";
import { RaiseQueryCard } from "./-components/RaiseQueryCard";
import { useServerTime } from "@/hooks/use-server-time";
import {
  convertSessionTimeToUserTimezone,
  formatSessionTimeInUserTimezone,
} from "@/utils/timezone";
import { StatCard } from "./-components/DashboardStatCard";
import { ContinueLearningCard } from "./-components/DashboardContinueLearningCard";
import { DashboardHero } from "./-components/DashboardHero";
import { PlayDashboardHero } from "./-components/play/PlayDashboardHero";
import { CleanerPlayDashboardHero } from "./-components/play/CleanerPlayDashboardHero";
import { cn } from "@/lib/utils";
import { getChatbotSettings } from "@/services/chatbot-settings";
import { MyMembershipWidget } from "./-components/MyMembershipWidget";
import { MyBooksWidget } from "./-components/MyBooksWidget";
import { MyOrdersWidget } from "./-components/MyOrdersWidget";
import { shouldHidePaidPurchaseUI } from "@/utils/ios-iap-compliance";
import { UpcomingLiveClassesWidget } from "./-components/UpcomingLiveClassesWidget";
import { Preferences } from "@capacitor/preferences";
import { AttendanceWidget } from "./-components/AttendanceWidget";
import cleanerIconCourses from "@/assets/cleaner-play/icon-courses.webp";
import cleanerIconAssessments from "@/assets/cleaner-play/icon-assessments.webp";
import cleanerIconLive from "@/assets/cleaner-play/icon-live-sessions.webp";
import { usePlayTheme } from "@/hooks/use-play-theme";
import { useCleanerPlayTheme } from "@/hooks/use-cleaner-play-theme";
import { usePlayGamificationStore } from "@/stores/play-gamification-store";
import { computeGamificationData } from "@/services/play-gamification";
import {
  getBadgeConfig,
  configNeedsAssessmentScore,
  configNeedsLiveSession,
  getScoringConfig,
} from "@/services/badge-config";
import { fetchBestAssessmentScorePct } from "@/services/assessment-score";
import { fetchLiveAttendanceStats } from "@/services/live-attendance-stats";
import { fetchAwardedBadges } from "@/services/awarded-badges";
import { fetchLast7DaysProgress } from "./-lib/utils";
import { StreakCounterWidget } from "./-components/play/StreakCounterWidget";
import { XpDisplayWidget } from "./-components/play/XpDisplayWidget";
import { AchievementBadgesWidget } from "./-components/play/AchievementBadgesWidget";
import { DashboardGamificationPanel } from "./-components/DashboardGamificationPanel";
import { TncModal } from "@/components/Dashboards/LearnerDashboard/TncModal";
import type { BatchForSessionType } from "@/stores/study-library/institute-schema";
import {
  ONBOARDING_INSTANCES_QUERY_KEY,
  OnboardingStepForm,
} from "../onboarding/-components/onboarding-step-form";
import { OnboardingProgressList } from "../onboarding/-components/onboarding-progress-list";
import {
  getMyOnboardingInstances,
  type OnboardingInstanceDTO,
  type OnboardingStepInstanceDTO,
} from "../onboarding/-services/onboarding-services";

export const Route = createFileRoute("/dashboard/")({
  component: () => {
    return (
      <LayoutContainer>
        <DashboardOnboardingGate />
      </LayoutContainer>
    );
  },
});

/** The step the caller should act on next, if any -- a current step they can't
 *  act on (e.g. a create_student step, always admin-only) is skipped so they
 *  aren't blocked waiting on an admin action from their own dashboard. */
const getActiveFormStep = (
  instance: OnboardingInstanceDTO
): OnboardingStepInstanceDTO | null => {
  if (instance.status !== "IN_PROGRESS") return null;
  const current =
    instance.step_instances.find((s) => s.id === instance.current_step_id) ??
    instance.step_instances.find((s) => s.status === "IN_PROGRESS");
  if (!current) return null;
  if (current.status !== "IN_PROGRESS" && current.status !== "PENDING") return null;
  if (current.step_type !== "FORM") return null;
  if (current.learner_can_act === false) return null;
  return current;
};

/**
 * Gates the dashboard on any pending onboarding step the caller can actually
 * act on: while one exists, the learner sees that step's form here instead of
 * the full dashboard. Once it's submitted (or there simply isn't one — no
 * onboarding started, already completed, or the only pending step needs an
 * admin), this frees up and mounts the real dashboard. The dashboard's own
 * (expensive) data fetches only start once this resolves, so a blocked
 * learner doesn't pay for dashboard queries they can't see yet.
 */
function DashboardOnboardingGate() {
  const { instituteId } = useInstituteFeatureStore();

  const { data: instances, isLoading } = useQuery({
    queryKey: [ONBOARDING_INSTANCES_QUERY_KEY, instituteId],
    queryFn: () => getMyOnboardingInstances(instituteId as string),
    enabled: Boolean(instituteId),
    staleTime: 30 * 1000,
  });

  const pending = (instances ?? [])
    .map((instance) => ({ instance, step: getActiveFormStep(instance) }))
    .find((entry) => entry.step !== null) as
    | { instance: OnboardingInstanceDTO; step: OnboardingStepInstanceDTO }
    | undefined;

  if (Boolean(instituteId) && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (pending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-1 py-6">
        <div>
          <h1 className="text-h3 font-semibold text-neutral-700">
            Finish setting up your account
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Complete the steps below to continue to your dashboard.
          </p>
        </div>
        <OnboardingStepForm stepInstance={pending.step} onSubmitted={() => {}} />
        <ModernCard variant="outlined" padding="md" rounded="lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Progress
          </p>
          <OnboardingProgressList stepInstances={pending.instance.step_instances} />
        </ModernCard>
      </div>
    );
  }

  return <DashboardComponent />;
}

export function DashboardComponent() {
  const [username, setUsername] = useState<string | null>(null);
  const [testAssignedCount, setTestAssignedCount] = useState<number>(0);
  // Count kept in state only because fetchStaticData's signature requires the setter.
  const [, setHomeworkAssignedCount] = useState<number>(0);
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
  const isPlayTheme = usePlayTheme();
  const isCleanerPlayTheme = useCleanerPlayTheme();
  const { setData: setGamificationData } = usePlayGamificationStore();
  const { instituteId } = useInstituteFeatureStore();

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

  // ── Derived view-model for the hero band and header ────────────────────────

  // Hero contract: pass live + upcoming merged; the heroes classify
  // live vs imminent internally — do not pre-filter here.
  const mergedLiveSessions = useMemo(
    () => [
      ...(liveSessions?.live_sessions ?? []),
      ...(liveSessions?.upcoming_sessions ?? []),
    ],
    [liveSessions]
  );

  // Sessions whose timezone-aware start falls on today's calendar date.
  const classesTodayCount = useMemo(() => {
    const now = new Date();
    return mergedLiveSessions.filter((session) => {
      try {
        const start = session.timezone
          ? convertSessionTimeToUserTimezone(
              session.meeting_date,
              session.start_time,
              session.timezone
            )
          : new Date(`${session.meeting_date}T${session.start_time}`);
        return (
          !Number.isNaN(start.getTime()) &&
          start.getFullYear() === now.getFullYear() &&
          start.getMonth() === now.getMonth() &&
          start.getDate() === now.getDate()
        );
      } catch {
        return false;
      }
    }).length;
  }, [mergedLiveSessions]);

  // Consecutive attended class days this week, walking back from the most
  // recent day. PENDING / NO_CLASS days neither extend nor break the streak.
  const attendanceStreak = useMemo(() => {
    const days = weeklyAttendance?.days ?? [];
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const status = days[i]?.status;
      if (status === "PRESENT") streak += 1;
      else if (status === "ABSENT" || status === "UNMARKED") break;
    }
    return streak;
  }, [weeklyAttendance]);

  // Any course with progress > 0 — splits first-run from returning learners.
  const hasAnyProgress = useMemo(
    () =>
      (studyLibraryData ?? []).some(
        (subject) => (subject.percentage_completed ?? 0) > 0
      ),
    [studyLibraryData]
  );
  // Loaded when the query resolved OR when the page settled without a batch
  // (zero-enrollment learners must reach the first-run hero, not a forever-skeleton).
  const studyLibraryLoaded = Boolean(studyLibraryData) || !isLoading;

  const userInitials = useMemo(() => {
    const words = (username ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "U";
    const first = words[0]?.charAt(0) ?? "";
    const last =
      words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
    return (first + last).toUpperCase() || "U";
  }, [username]);

  const greetingText = useMemo(() => {
    const firstName = (username ?? "").trim().split(/\s+/)[0] ?? "";
    if (!firstName) return "Welcome back";
    const hour = new Date().getHours();
    const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    return `Good ${period}, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}`;
  }, [username]);

  // Update Zustand store when React Query data changes
  useEffect(() => {
    if (studyLibraryData) {
      setStudyLibraryData(studyLibraryData);
    }
  }, [studyLibraryData, setStudyLibraryData]);

  const handleResumeClick = async (slide: DashboardSlide) => {
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

    // The slides route needs both courseId (= package_id) and sessionId
    // (= package_session_id) to load the surrounding Subject/Module/Chapter
    // tree. The dashboard API returns package_id + level_id per slide; we
    // resolve the matching package_session_id from the institute's batch
    // list stored in Preferences. Without this, the slide viewer opens but
    // the sidebar tree can't hydrate.
    let sessionId = slide.package_session_id || "";
    if (!sessionId) {
      try {
        const instituteDetailsStr = await Preferences.get({ key: "InstituteDetails" });
        const institute = instituteDetailsStr.value ? JSON.parse(instituteDetailsStr.value) : null;
        const batches: BatchForSessionType[] | null = institute?.batches_for_sessions ?? null;
        const match = batches?.find(
          (b) => b.package_dto?.id === slide.package_id && b.level?.id === slide.level_id
        );
        sessionId = match?.id || "";
        if (!sessionId) {
          // Fall back to the currently selected batch — usually the right one
          // for single-batch learners.
          sessionId = (await getPackageSessionId()) || "";
        }
      } catch {
        sessionId = (await getPackageSessionId()) || "";
      }
    }

    navigate({
      to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
      search: {
        courseId: slide.package_id,
        levelId: slide.level_id,
        subjectId: slide.subject_id,
        moduleId: slide.module_id,
        chapterId: slide.chapter_id,
        slideId: slide.slide_id,
        sessionId,
      },
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

  const OPT_IN_WIDGETS: Set<StudentDashboardWidgetConfig["id"]> = new Set(["myOrders"]);

  const isWidgetVisible = (id: StudentDashboardWidgetConfig["id"]) => {
    const cfg = widgetConfigs?.find((w) => w.id === id);
    if (!cfg) return !OPT_IN_WIDGETS.has(id);
    return cfg.visible !== false;
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

  // Refresh gamification data (badges / XP / streak) once dashboard data is ready.
  // Runs for EVERY theme: the Play theme renders the play widgets while all other
  // themes render DashboardGamificationPanel — both read from the same store.
  useEffect(() => {
    if (!data || !instituteId) return;

    const refreshGamification = async () => {
      try {
        // Fetch 30 days of activity for streak calculation
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const userId = ""; // fetched inside fetchLast7DaysProgress from stored details
        const activities = await fetchLast7DaysProgress({
          user_id: userId,
          start_date: thirtyDaysAgo.toISOString().slice(0, 10),
          end_date: now.toISOString().slice(0, 10),
        });

        // Admin-configured badge definitions + awarded badges + points scoring.
        const [badgeConfig, awardedBadges, scoring] = await Promise.all([
          getBadgeConfig(),
          fetchAwardedBadges(),
          getScoringConfig(),
        ]);
        // Fetch the assessment score only when a badge OR the points scoring needs it.
        const needAssessment =
          configNeedsAssessmentScore(badgeConfig) || scoring.assessmentBestScore > 0;
        const bestAssessmentScorePct = needAssessment
          ? await fetchBestAssessmentScorePct()
          : null;

        // Live-class attendance is only needed when a live-session badge is configured.
        const liveStats = configNeedsLiveSession(badgeConfig)
          ? await fetchLiveAttendanceStats()
          : { count: 0, streak: 0 };

        const gamificationData = computeGamificationData({
          dashboard: data,
          activities,
          attendance: weeklyAttendance ?? null,
          instituteId,
          badgeConfig,
          studyLibrary: studyLibraryData ?? null,
          bestAssessmentScorePct,
          awardedBadges,
          scoring,
          liveSessionCount: liveStats.count,
          liveSessionStreak: liveStats.streak,
        });

        setGamificationData(gamificationData);
      } catch (error) {
        console.error("Failed to compute gamification data:", error);
      }
    };

    refreshGamification();
  }, [
    data,
    weeklyAttendance,
    instituteId,
    studyLibraryData,
    setGamificationData,
  ]);

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
    // PRE_JOINING sessions join the live class directly during the
    // waiting-room window instead of entering the waiting-room screen.
    const isPreJoining = session.waiting_room_type === "PRE_JOINING";

    if (isInWaitingRoom && !isPreJoining) {
      track("Live Session Waiting Room Entered", {
        sessionId: session.session_id,
        sessionTitle: session.title,
      });
      navigate({
        to: "/study-library/live-class/waiting-room",
        search: { sessionId: session.schedule_id },
      });
    } else if (isInMainSession || (isInWaitingRoom && isPreJoining)) {
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

        if (isBbbSession(session.link_type)) {
          // BBB: open the personalized join URL (real name + userId). Checked FIRST
          // so BBB never routes to the embed page (which can't resolve a BBB room →
          // "Unsupported session type") or the shared generic meeting_link.
          await openBbbJoinForLearner(session.schedule_id);
        } else if (
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
          await openInBrowser(session.meeting_link);
        }
      } catch (error) {
        console.error("Failed to mark attendance:", error);
        toast.error("Failed to mark attendance");

        if (isBbbSession(session.link_type)) {
          // BBB: open the personalized join URL (real name + userId). Checked FIRST
          // so BBB never routes to the embed page (which can't resolve a BBB room →
          // "Unsupported session type") or the shared generic meeting_link.
          await openBbbJoinForLearner(session.schedule_id);
        } else if (
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
          await openInBrowser(session.meeting_link);
        }
      }
    }
  };

  const liveClassSingular = getTerminology(
    ContentTerms.LiveSession,
    SystemTerms.LiveSession
  );
  const liveClassPlural = getTerminologyPlural(
    ContentTerms.LiveSession,
    SystemTerms.LiveSession
  );
  // One useful header fact: classes today, else attendance streak, else none.
  const headerFact =
    classesTodayCount > 0
      ? `${classesTodayCount} ${(classesTodayCount === 1
          ? liveClassSingular
          : liveClassPlural
        ).toLowerCase()} today`
      : attendanceStreak > 0
        ? `${attendanceStreak}-day attendance streak`
        : null;

  const heroProps = {
    userName: username,
    liveSessions: mergedLiveSessions,
    isLoadingLive: isLoadingLiveSessions,
    hasAnyProgress,
    studyLibraryLoaded,
    onJoinSession: handleJoinSession,
  };

  // ── Curated 2/3 + 1/3 layout ────────────────────────────────────────────────
  // Column assignment is fixed by the redesign; institutes' saved widget
  // orders still sort widgets within their column.

  const statCards = [
    {
      id: "coursesStat" as const,
      render: (
        <StatCard
          title={getTerminologyPlural(ContentTerms.Course, SystemTerms.Course)}
          count={data?.courses}
          icon={BookOpen}
          onClick={() => {
            track("Dashboard Card Clicked", {
              cardType: "Courses",
              count: data?.courses || 0,
            });
            navigate({ to: "/study-library/courses" });
          }}
          isLoading={isLoading}
          emptyActionLabel={`Browse ${getTerminologyPlural(
            ContentTerms.Course,
            SystemTerms.Course
          )}`}
          className="stat-card-courses [.ui-vibrant_&]:bg-primary-50 [.ui-vibrant_&]:border-primary-100 [.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300"
          iconClassName="[.ui-vibrant_&]:bg-primary-100 [.ui-vibrant_&]:text-primary-500 [.ui-play_&]:bg-white/70 [.ui-play_&]:text-play-info-soft-ink [.ui-play_&]:ring-0"
          cleanerIllustrationSrc={cleanerIconCourses}
        />
      ),
    },
    {
      id: "liveClasses" as const,
      render: (
        <StatCard
          title={getTerminologyPlural(
            ContentTerms.LiveSession,
            SystemTerms.LiveSession
          )}
          count={liveSessions?.live_sessions?.length}
          icon={Play}
          onClick={() => navigate({ to: "/study-library/live-class" })}
          isLoading={isLoadingLiveSessions}
          emptyActionLabel={`View ${getTerminologyPlural(
            ContentTerms.LiveSession,
            SystemTerms.LiveSession
          )}`}
          className="stat-card-live [.ui-vibrant_&]:bg-primary-50 [.ui-vibrant_&]:border-primary-100 [.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300"
          iconClassName="[.ui-vibrant_&]:bg-primary-100 [.ui-vibrant_&]:text-primary-500 [.ui-play_&]:bg-white/70 [.ui-play_&]:text-play-navy-soft-ink [.ui-play_&]:ring-0"
          cleanerIllustrationSrc={cleanerIconLive}
        />
      ),
    },
    {
      id: "evaluationStat" as const,
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
          emptyActionLabel="View Assessments"
          className="stat-card-assessments [.ui-vibrant_&]:bg-primary-50 [.ui-vibrant_&]:border-primary-100 [.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300"
          iconClassName="[.ui-vibrant_&]:bg-primary-100 [.ui-vibrant_&]:text-primary-500 [.ui-play_&]:bg-white/70 [.ui-play_&]:text-play-accent-soft-ink [.ui-play_&]:ring-0"
          cleanerIllustrationSrc={cleanerIconAssessments}
        />
      ),
    },
  ]
    .filter((w) => isWidgetVisible(w.id))
    .sort((a, b) => getWidgetOrder(a.id) - getWidgetOrder(b.id));

  // MAIN column (lg:col-span-2): continue learning, stats row, progress
  // insights, custom widget, commerce. Commerce is hidden for the play
  // (K-12) audience.
  const mainColumnWidgets = [
    {
      id: "continueLearning" as const,
      order: getWidgetOrder("continueLearning"),
      visible: isWidgetVisible("continueLearning"),
      render: (
        <ContinueLearningCard
          data={data}
          onResumeClick={handleResumeClick}
          isLoading={isLoading}
          hasAnyProgress={hasAnyProgress}
        />
      ),
    },
    {
      id: "statsRow" as const,
      order: statCards.length
        ? Math.min(...statCards.map((w) => getWidgetOrder(w.id)))
        : Number.MAX_SAFE_INTEGER,
      visible: statCards.length > 0,
      render: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-sm:[.ui-cleaner-play_&]:grid-cols-2 max-sm:[.ui-play_&]:grid-cols-2 max-sm:[.ui-cleaner-play_&]:[&>*:last-child:nth-child(odd)]:col-span-2 max-sm:[.ui-play_&]:[&>*:last-child:nth-child(odd)]:col-span-2">
          {statCards.map((w) => (
            <div key={w.id}>{w.render}</div>
          ))}
        </div>
      ),
    },
    {
      id: "learningAnalytics" as const,
      order: getWidgetOrder("learningAnalytics"),
      visible: isWidgetVisible("learningAnalytics"),
      render: <PastLearningInsights />,
    },
    {
      id: "custom" as const,
      order: getWidgetOrder("custom"),
      visible: Boolean(customWidget),
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
              <CardDescription>{customWidget.subTitle}</CardDescription>
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
                Open <CaretRight size={14} />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null,
    },
    {
      id: "myMembership" as const,
      order: getWidgetOrder("myMembership"),
      visible: !isPlayTheme && isWidgetVisible("myMembership"),
      render: <MyMembershipWidget />,
    },
    {
      id: "myBooks" as const,
      order: getWidgetOrder("myBooks"),
      visible: !isPlayTheme && isWidgetVisible("myBooks"),
      render: <MyBooksWidget />,
    },
    {
      id: "myOrders" as const,
      order: getWidgetOrder("myOrders"),
      visible: !isPlayTheme && isWidgetVisible("myOrders"),
      render: <MyOrdersWidget />,
    },
  ]
    .filter((w) => w.visible && w.render)
    .sort((a, b) => a.order - b.order);

  // RAIL column (lg:col-span-1): pins panel renders first (always on),
  // then the configurable rail widgets.
  const railWidgets = [
    {
      id: "upcomingLiveClasses" as const,
      order: getWidgetOrder("upcomingLiveClasses"),
      visible: isWidgetVisible("upcomingLiveClasses"),
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
      id: "thisWeekAttendance" as const,
      order: getWidgetOrder("thisWeekAttendance"),
      visible: isWidgetVisible("thisWeekAttendance"),
      render: <AttendanceWidget />,
    },
  ]
    .filter((w) => w.visible)
    .sort((a, b) => a.order - b.order);

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

      {/* Render T&C Modal if ask_for_tnc is true */}
      {data?.ask_for_tnc && data?.tnc_url && (
        <TncModal
          tncUrl={data.tnc_url}
          prefillName={data.tnc_prefill_name ?? false}
          onAccepted={() => {
            setData(prev => prev ? { ...prev, ask_for_tnc: false } : prev);
          }}
        />
      )}

      <div className="relative z-10 space-y-4 p-3 sm:p-4 lg:p-6 mx-auto w-full max-w-7xl animate-in fade-in duration-500">
        {/* Header — default/vibrant only; the play / cleaner-play hero carries its own greeting */}
        {!isPlayTheme && !isCleanerPlayTheme && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-primary-100 text-lg font-semibold text-primary-500">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-h2 sm:text-h1 tracking-tight text-foreground">
                  {isLoading ? (
                    <Skeleton className="h-8 w-48" />
                  ) : (
                    <span>{greetingText}</span>
                  )}
                </h1>
                {showForInstitutes([HOLISTIC_INSTITUTE_ID]) ? (
                  <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <Sparkle size={16} className="text-primary" />
                    <span>Ready for today's yoga journey?</span>
                  </p>
                ) : headerFact ? (
                  <p className="mt-1 text-caption text-muted-foreground">
                    {headerFact}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="text-caption text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        )}

        {!showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
          <>
            {/* Hero — owns the live-class banner and resume / first-run band */}
            {isCleanerPlayTheme ? (
              <CleanerPlayDashboardHero {...heroProps} />
            ) : isPlayTheme ? (
              <PlayDashboardHero {...heroProps} />
            ) : (
              <DashboardHero {...heroProps} />
            )}

            {/* Main 2/3 + 1/3 layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">
              <div className="space-y-4 lg:col-span-2 lg:space-y-6">
                {mainColumnWidgets.map((w) => (
                  <div key={w.id}>{w.render}</div>
                ))}
              </div>

              <div className="space-y-4 lg:col-span-1 lg:space-y-6">
                {/* Institute announcements pin to the top of the rail */}
                <DashboardPinsPanel maxPins={3} />
                {railWidgets.map((w) => (
                  <div key={w.id}>{w.render}</div>
                ))}
              </div>
            </div>

            {/* Gamification (badges / XP / streak) — bottom of the main flow.
                Play theme keeps its vibrant play-token widgets; every other theme
                gets the standard design-token panel. */}
            {isPlayTheme ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
                <StreakCounterWidget />
                <XpDisplayWidget />
                <AchievementBadgesWidget />
              </div>
            ) : (
              <DashboardGamificationPanel />
            )}

            {/* General query intake — only when the institute enabled the dashboard card */}
            <RaiseQueryCard />

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

            {/* Explore Buttons Section — commerce, hidden for the play (K-12)
                audience and in reader mode (iOS / reader-mode institutes,
                Apple 3.1.1). */}
            {!isPlayTheme && !shouldHidePaidPurchaseUI() && (
              <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pb-12 px-4">
                {isWidgetVisible("myMembership") && (
                  <Button
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 py-2 px-6 h-9 text-xs font-bold"
                    onClick={() => {
                      sessionStorage.setItem("levelFilter", "rent");
                      navigate({ to: "/collections" as never });
                    }}
                  >
                    Explore Memberships
                    <CaretRight size={14} />
                  </Button>
                )}
                {isWidgetVisible("myBooks") && (
                  <Button
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 py-2 px-6 h-9 text-xs font-bold"
                    onClick={() => {
                      sessionStorage.setItem("levelFilter", "buy");
                      navigate({ to: "/collections" as never });
                    }}
                  >
                    Explore Books
                    <CaretRight size={14} />
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
          <div className="space-y-6">
            {/* Institute announcements */}
            <DashboardPinsPanel maxPins={3} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Hero Section */}
              <div className="lg:col-span-8">
                <Card className="h-full overflow-hidden border-0 shadow-sm relative bg-white">
                  <CardContent className="p-0 relative h-full flex items-center justify-center min-h-72">
                    <img
                      src="/yoga-dashboard.png"
                      alt="Yoga illustration"
                      className="object-contain max-h-72"
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
                            case "UNMARKED":
                              Icon = MinusCircle;
                              colorClass = "text-gray-400";
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
                              <span className="text-caption font-medium text-muted-foreground truncate w-full">
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
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate({ to: "/referral" })}
                    >
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
                    <VideoCamera size={18} />
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
                  View All <CaretRight size={14} className="ms-1" />
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
                            <VideoCamera size={16} />
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
                            <VideoCamera
                              size={20}
                              className="text-muted-foreground"
                            />
                          </div>
                          <h3 className="font-semibold text-sm">
                            No {getTerminologyPlural(ContentTerms.LiveSession, SystemTerms.LiveSession).toLowerCase()} scheduled
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

            {/* General query intake — only when the institute enabled the dashboard card */}
            <RaiseQueryCard />
          </div>
        )}
      </div>
    </div>
  );
}
