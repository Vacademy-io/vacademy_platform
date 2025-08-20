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
export type StudentSignupProvider = "google" | "github" | "usernamePassword" | "emailOtp";
export type StudentDefaultProvider = StudentSignupProvider;
export type UsernameStrategy = "email" | "random" | "manual";
export type PasswordStrategy = "manual" | "autoRandom";
export type PasswordDelivery = "showOnScreen" | "sendEmail" | "none";

export interface StudentSignupSettings {
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
}

// Course details
export type StudentCourseDetailsTabId = "OUTLINE" | "CONTENT_STRUCTURE" | "TEACHERS" | "ASSESSMENTS";

export interface StudentCourseDetailsTabConfig {
  id: StudentCourseDetailsTabId;
  label?: string;
  order: number;
  visible: boolean;
}

export type OutlineMode = "expanded" | "collapsed";

export interface StudentCourseDetailsSettings {
  tabs: StudentCourseDetailsTabConfig[];
  defaultTab: StudentCourseDetailsTabId;
  outlineMode: OutlineMode;
  ratingsAndReviewsVisible: boolean;
  // New flags
  showCourseConfiguration: boolean;
  showCourseContentPrefixes: boolean;
  courseOverview: { visible: boolean; showSlidesData: boolean };
  slidesView: { showLearningPath: boolean; feedbackVisible: boolean; canAskDoubt: boolean };
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
}

// Permissions
export interface StudentPermissions {
  canViewProfile: boolean;
  canEditProfile: boolean;
  canDeleteProfile: boolean;
}

// Notifications
export interface StudentNotificationSettings {
  allowSystemAlerts: boolean;
  allowDashboardPins: boolean;
  allowBatchStream: boolean;
}

// Certificates
export interface StudentCertificateSettings {
  // Percentage threshold after which certificate can be generated
  generationThresholdPercent: number;
}

// Root
export interface StudentDisplaySettingsData {
  sidebar: { visible: boolean; tabs: StudentSidebarTabConfig[] };
  dashboard: { widgets: StudentDashboardWidgetConfig[] };
  signup: StudentSignupSettings;
  permissions: StudentPermissions;
  courseDetails: StudentCourseDetailsSettings;
  allCourses: StudentAllCoursesSettings;
  notifications: StudentNotificationSettings;
  certificates: StudentCertificateSettings;
  postLoginRedirectRoute: string;
}


