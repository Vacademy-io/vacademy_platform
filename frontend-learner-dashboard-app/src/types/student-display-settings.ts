export const STUDENT_DISPLAY_SETTINGS_KEY = "STUDENT_DISPLAY_SETTINGS" as const;

// Sidebar
export interface StudentSidebarSubTabConfig {
  id: string;
  label?: string;
  route: string;
  order: number;
  visible: boolean;
}

export interface StudentSidebarTabConfig {
  id: string; // 'dashboard','learning-center','homework','assessment-center','referral','attendance', ...
  label?: string;
  route?: string;
  order: number;
  visible: boolean;
  subTabs?: StudentSidebarSubTabConfig[];
  isCustom?: boolean;
}

// Dashboard
export type StudentDashboardWidgetId =
  | "coursesStat"
  | "assessmentsStat"
  | "evaluationStat"
  | "continueLearning"
  | "learningAnalytics"
  | "activityTrend"
  | "dailyProgress"
  | "liveClasses"
  | "thisWeekAttendance"
  | "referAFriend"
  | "myClasses"
  | "myMembership"
  | "myBooks"
  | "upcomingLiveClasses"
  | "myOrders"
  | "custom";

export interface StudentDashboardWidgetConfig {
  id: StudentDashboardWidgetId;
  order: number;
  visible: boolean;
  isCustom?: boolean;
  title?: string; // for custom
  subTitle?: string; // for custom
  link?: string; // for custom (route or URL)
}

// Signup/Login
export type StudentSignupProvider =
  | "google"
  | "github"
  | "usernamePassword"
  | "emailOtp";
export type StudentDefaultProvider = StudentSignupProvider;
export type UsernameStrategy = "email" | "random" | "manual";
export type PasswordStrategy = "manual" | "autoRandom";
export type PasswordDelivery = "showOnScreen" | "sendEmail" | "none";

// How catalogue header login/signup buttons surface auth.
// - "page" (default): navigate to /login or /signup
// - "modal": open the AuthModal in-place
export type StudentAuthPresentation = "page" | "modal";

export interface StudentSignupSettings {
  // Master toggle: when false, "Sign Up" links are hidden in the catalogue UI.
  // Default: true.
  enabled?: boolean;
  providers: {
    google: boolean;
    github: boolean;
    usernamePassword: boolean;
    emailOtp: boolean;
    defaultProvider: StudentDefaultProvider;
  };
  usernameStrategy: UsernameStrategy;
  passwordStrategy: PasswordStrategy;
  passwordDelivery: PasswordDelivery;
  presentation?: StudentAuthPresentation;
}

// Course details
export type StudentCourseDetailsTabId =
  | "OUTLINE"
  | "CONTENT_STRUCTURE"
  | "TEACHERS"
  | "ASSESSMENTS";

export interface StudentCourseDetailsTabConfig {
  id: StudentCourseDetailsTabId;
  label?: string;
  order: number;
  visible: boolean;
}

export type OutlineMode = "expanded" | "collapsed";

/**
 * How the slide viewer's left sidebar lets the learner navigate course content.
 *
 * - "breadcrumb": Sidebar shows only the current chapter's slide list (the
 *   legacy view). Cross-subject/cross-module jumps happen via the breadcrumb
 *   popovers at the top.
 * - "ancestors": Sidebar shows the full Subject → Module → Chapter → Slide
 *   tree; the breadcrumb is a passive label (no popovers) since the tree
 *   already exposes every jump.
 */
export type SlidesSidebarNavigation = "breadcrumb" | "ancestors";

export interface StudentCourseDetailsSettings {
  tabs: StudentCourseDetailsTabConfig[];
  defaultTab: StudentCourseDetailsTabId;
  outlineMode: OutlineMode;
  ratingsAndReviewsVisible: boolean;
  /** Hide the "Author" row in the course-details Course Overview panel. Default false (author shown). */
  hideAuthorName?: boolean;
  /** Show the Teachers/Instructors section on the course-details page. Default false (hidden). */
  showInstructors?: boolean;
  // New flags
  showCourseConfiguration: boolean;
  showCourseContentPrefixes: boolean;
  courseOverview: { visible: boolean; showSlidesData: boolean };
  slidesView: {
    showLearningPath: boolean;
    feedbackVisible: boolean;
    canAskDoubt: boolean;
    /** See {@link SlidesSidebarNavigation}. Optional for backwards compat
     *  with settings payloads saved before this field existed — consumers
     *  should fall back to "breadcrumb" (the legacy default) when missing
     *  so existing learners aren't dropped into a different layout. */
    sidebarNavigation?: SlidesSidebarNavigation;
  };
}

// All Courses page
export type StudentAllCoursesTabId = "InProgress" | "Completed" | "AllCourses";

export interface StudentAllCoursesTabConfig {
  id: StudentAllCoursesTabId;
  label?: string;
  order: number;
  visible: boolean;
}

export interface StudentAllCoursesSettings {
  tabs: StudentAllCoursesTabConfig[];
  defaultTab: StudentAllCoursesTabId;
  /** Hide the instructor/teacher name block on each course card in the All Courses list. Default false (shown). */
  hideInstructorName?: boolean;
}

// UI
export type StudentUIType = "default" | "vibrant" | "play" | "cleanerPlay";

export interface StudentUISettings {
  type: StudentUIType;
}

// Permissions
export interface StudentPermissions {
  canViewProfile: boolean;
  canEditProfile: boolean;
  canDeleteProfile: boolean;
  canViewFiles: boolean;
  canViewReports: boolean;
}

// Profile page
export interface StudentProfileSettings {
  // Whether the "Membership Status" card (Access Days + expiry date) is shown
  // on the learner's Profile tab. Default: false (hidden).
  showMembershipStatus: boolean;
}

// Notifications
export interface StudentNotificationSettings {
  allowSystemAlerts: boolean;
  allowDashboardPins: boolean;
  allowBatchStream: boolean;
  // Full-screen APP_OVERLAY announcements shown when the app is opened
  allowAppOverlays: boolean;
}

// Guided tutorials (intro tours). Keys must match the admin dashboard's
// Student Display settings tour registry — do not rename.
export const LEARNER_TOUR_KEYS = [
  "dashboard-overview",
  "browse-courses",
  "watch-content",
  "take-assessment",
  "join-live-class",
  "view-progress",
] as const;

export type LearnerTourKey = (typeof LEARNER_TOUR_KEYS)[number];

export interface StudentTutorialSettings {
  // Master switch — institutes opt in from admin Student Display settings
  enabled: boolean;
  // Which predefined tours learners can run (subset of LEARNER_TOUR_KEYS)
  enabledTours: string[];
  // Offer a downloadable, institute-branded how-to PDF (chapters follow
  // enabledTours) from the Help & tutorials menu
  pdfGuideEnabled: boolean;
}

// Certificates
export interface StudentCertificateSettings {
  // Whether certificate generation is enabled
  enabled: boolean;
  // Percentage threshold after which certificate can be generated
  generationThresholdPercent: number;
}

// Course Settings
export interface StudentCourseSettingsQuiz {
  moveOnlyOnCorrectAnswer: boolean;
  celebrateOnQuizComplete: boolean;
  showReportAndCorrectAnswers: boolean;
}

export interface StudentCourseSettings {
  quiz: StudentCourseSettingsQuiz;
}

export interface ConcentrationSettings {
  enabled: boolean;
  frequency: {
    min_minutes: number;
    max_minutes: number;
  };
  behavior: {
    allow_skip: boolean;
    penalty_type: "pause" | "flag_only";
  };
  appearance: {
    title: string;
    subtitle: string;
  };
}

// Root
export interface StudentDisplaySettingsData {
  sidebar: { visible: boolean; tabs: StudentSidebarTabConfig[] };
  dashboard: { widgets: StudentDashboardWidgetConfig[] };
  signup: StudentSignupSettings;
  permissions: StudentPermissions;
  profile: StudentProfileSettings;
  courseDetails: StudentCourseDetailsSettings;
  courseSettings: StudentCourseSettings;
  allCourses: StudentAllCoursesSettings;
  notifications: StudentNotificationSettings;
  tutorials: StudentTutorialSettings;
  certificates: StudentCertificateSettings;
  concentration: ConcentrationSettings;
  ui: StudentUISettings;
  postLoginRedirectRoute: string;
}
