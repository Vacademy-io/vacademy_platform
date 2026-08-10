import type {
  StudentDisplaySettingsData,
  StudentDashboardWidgetConfig,
  StudentSidebarTabConfig,
} from "@/types/student-display-settings";
import { LEARNER_TOUR_KEYS } from "@/types/student-display-settings";

function defaultSidebarTabs(): StudentSidebarTabConfig[] {
  return [
    { id: "dashboard", order: 1, visible: true },
    {
      id: "learning-center",
      order: 2,
      visible: true,
      subTabs: [
        {
          id: "study-library",
          route: "/study-library",
          order: 1,
          visible: true,
        },
        {
          id: "attendance",
          route: "/learning-centre/attendance",
          order: 2,
          visible: true,
        },
        {
          id: "live-classes",
          route: "/study-library/live-class",
          order: 3,
          visible: true,
        },
      ],
    },
    {
      id: "homework",
      order: 3,
      // Hidden from learners by default; admins can enable it in Student Display settings.
      visible: false,
      subTabs: [
        {
          id: "homework-list",
          route: "/homework/list",
          order: 1,
          visible: true,
        },
        {
          id: "homework-reports",
          route: "/homework/reports",
          order: 2,
          visible: true,
        },
      ],
    },
    {
      id: "assessment-center",
      order: 4,
      visible: true,
      subTabs: [
        {
          id: "assessment-list",
          route: "/assessment/examination",
          order: 1,
          visible: true,
        },
        {
          id: "assessment-reports",
          route: "/assessment/reports",
          order: 2,
          visible: true,
        },
      ],
    },
    // Hidden from learners by default; admins can enable it in Student Display settings.
    { id: "referral", order: 5, visible: false },
    { id: "attendance", order: 6, visible: true },
    // Hidden by default; admins enable it per-institute in Student Display settings.
    { id: "my-mentors", order: 7, visible: false },
  ];
}

function defaultDashboardWidgets(): StudentDashboardWidgetConfig[] {
  // Curated dashboard order. The dashboard renders a 2/3 main column and a
  // 1/3 rail on large screens; orders only sort widgets WITHIN their column,
  // so institutes' saved orders keep working after the redesign.
  //
  // MUST stay identical (ids, order AND default visibility) to the admin app's
  // defaultDashboardWidgets: the admin persists its own defaults on the first
  // save, so any divergence silently reshuffles or re-shows widgets the moment
  // someone opens the settings screen and hits Save.
  // Typed without `order` so the ids keep their literal types through .map()
  // (annotating the mapped result instead widens id to string).
  const defaults: Array<Omit<StudentDashboardWidgetConfig, "order">> = [
    // Hero band, above the columns — its order is cosmetic (the hero is not
    // part of the ordered main/rail columns), it leads the list because that
    // is where it renders.
    { id: "gettingStarted", visible: true },
    // Main column: continue learning first, then the stat-cards row.
    { id: "continueLearning", visible: true },
    { id: "coursesStat", visible: true },
    { id: "liveClasses", visible: true },
    { id: "evaluationStat", visible: true },
    // Progress and insights widgets.
    { id: "learningAnalytics", visible: true },
    // Commerce widgets (hidden in play mode).
    { id: "myMembership", visible: true },
    { id: "myBooks", visible: true },
    // Opt-in: off unless an institute turns it on.
    { id: "myOrders", visible: false },
    // Rail column: announcements pin panel renders first (not configurable),
    // then live classes, mentors and attendance.
    { id: "upcomingLiveClasses", visible: true },
    { id: "myMentors", visible: true },
    { id: "thisWeekAttendance", visible: true },
    // Bottom of the main flow: XP / streak / badges.
    { id: "gamification", visible: true },
    // Bottom-of-page commerce CTAs.
    { id: "exploreMemberships", visible: true },
    { id: "exploreBooks", visible: true },
  ];
  return defaults.map((w, idx) => ({ ...w, order: idx + 1 }));
}

export const DEFAULT_STUDENT_DISPLAY_SETTINGS: StudentDisplaySettingsData = {
  sidebar: { visible: true, tabs: defaultSidebarTabs() },
  dashboard: { widgets: defaultDashboardWidgets() },
  ui: { type: "default" },
  signup: {
    enabled: true,
    providers: {
      google: true,
      github: true,
      usernamePassword: true,
      emailOtp: true,
      defaultProvider: "emailOtp",
    },
    usernameStrategy: "manual",
    passwordStrategy: "manual",
    passwordDelivery: "none",
    presentation: "page",
  },
  permissions: {
    canViewProfile: true,
    canEditProfile: false,
    canDeleteProfile: false,
    canViewFiles: false,
    canViewReports: false,
  },
  profile: {
    // Hidden by default; admins can enable it in Student Display settings.
    showMembershipStatus: false,
  },
  courseDetails: {
    tabs: [
      { id: "OUTLINE", order: 1, visible: true },
      { id: "CONTENT_STRUCTURE", order: 2, visible: true },
      { id: "TEACHERS", order: 3, visible: true },
      { id: "ASSESSMENTS", order: 4, visible: true },
    ],
    defaultTab: "OUTLINE",
    outlineMode: "expanded",
    ratingsAndReviewsVisible: true,
    hideAuthorName: false,
    // Teachers/Instructors section hidden by default; admins opt-in to show it.
    showInstructors: false,
    // New defaults
    showCourseConfiguration: true,
    showCourseContentPrefixes: true,
    courseOverview: { visible: true, showSlidesData: true },
    slidesView: {
      showLearningPath: true,
      feedbackVisible: true,
      canAskDoubt: true,
      // "breadcrumb" = legacy chapter-scoped slide list with cross-module
      // navigation via breadcrumb popovers. Switch to "ancestors" to show
      // the full Subject → Module → Chapter → Slide tree in the sidebar.
      sidebarNavigation: "breadcrumb",
    },
  },
  courseSettings: {
    quiz: {
      moveOnlyOnCorrectAnswer: true,
      celebrateOnQuizComplete: true,
    },
  },
  allCourses: {
    tabs: [
      { id: "InProgress", order: 1, visible: true },
      { id: "Completed", order: 2, visible: true },
      { id: "AllCourses", order: 3, visible: true },
    ],
    defaultTab: "InProgress",
    hideInstructorName: false,
  },
  notifications: {
    allowSystemAlerts: true,
    allowDashboardPins: true,
    allowBatchStream: true,
    allowAppOverlays: true,
  },
  tutorials: {
    // Off by default — institutes opt in via Settings > Student Display.
    enabled: false,
    enabledTours: [...LEARNER_TOUR_KEYS],
    pdfGuideEnabled: false,
  },
  certificates: {
    enabled: true,
    generationThresholdPercent: 80,
  },
  concentration: {
    enabled: true,
    frequency: {
      min_minutes: 5,
      max_minutes: 7,
    },
    behavior: {
      allow_skip: false,
      penalty_type: "pause",
    },
    appearance: {
      title: "Focus Check",
      subtitle: "Select the matching number to continue your streak",
    },
  },
  postLoginRedirectRoute: "/dashboard",
};
