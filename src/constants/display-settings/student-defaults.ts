import type {
  StudentDisplaySettingsData,
  StudentDashboardWidgetConfig,
  StudentSidebarTabConfig,
} from "@/types/student-display-settings";

function defaultSidebarTabs(): StudentSidebarTabConfig[] {
  return [
    { id: "dashboard", order: 1, visible: true },
    {
      id: "learning-center",
      order: 2,
      visible: true,
      subTabs: [
        { id: "study-library", route: "/study-library", order: 1, visible: true },
        { id: "attendance", route: "/learning-centre/attendance", order: 2, visible: true },
        { id: "live-classes", route: "/study-library/live-class", order: 3, visible: true },
      ],
    },
    {
      id: "homework",
      order: 3,
      visible: true,
      subTabs: [
        { id: "homework-list", route: "/homework/list", order: 1, visible: true },
        { id: "homework-reports", route: "/homework/reports", order: 2, visible: true },
      ],
    },
    {
      id: "assessment-center",
      order: 4,
      visible: true,
      subTabs: [
        { id: "assessment-list", route: "/assessment/examination", order: 1, visible: true },
        { id: "assessment-reports", route: "/assessment/reports", order: 2, visible: true },
      ],
    },
    { id: "referral", order: 5, visible: true },
    { id: "attendance", order: 6, visible: true },
  ];
}

function defaultDashboardWidgets(): StudentDashboardWidgetConfig[] {
  const ids: StudentDashboardWidgetConfig["id"][] = [
    "coursesStat",
    "assessmentsStat",
    "evaluationStat",
    "continueLearning",
    "learningAnalytics",
    "activityTrend",
    "dailyProgress",
    "liveClasses",
    "thisWeekAttendance",
    "referAFriend",
    "myClasses",
  ];
  return ids.map((id, idx) => ({ id, order: idx + 1, visible: true }));
}

export const DEFAULT_STUDENT_DISPLAY_SETTINGS: StudentDisplaySettingsData = {
  sidebar: { visible: true, tabs: defaultSidebarTabs() },
  dashboard: { widgets: defaultDashboardWidgets() },
  ui: { type: "default" },
  signup: {
    providers: { google: true, github: true, usernamePassword: true, emailOtp: true, defaultProvider: "emailOtp" },
    usernameStrategy: "manual",
    passwordStrategy: "manual",
    passwordDelivery: "none",
  },
  permissions: { canViewProfile: false, canEditProfile: false, canDeleteProfile: false, canViewFiles: false },
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
    // New defaults
    showCourseConfiguration: true,
    showCourseContentPrefixes: true,
    courseOverview: { visible: true, showSlidesData: true },
    slidesView: { showLearningPath: true, feedbackVisible: true, canAskDoubt: true },
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
  },
  notifications: {
    allowSystemAlerts: true,
    allowDashboardPins: true,
    allowBatchStream: true,
  },
  certificates: {
    enabled: true,
    generationThresholdPercent: 80,
  },
  postLoginRedirectRoute: "/dashboard",
};


