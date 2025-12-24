import {
  FileText,
  PresentationChart,
  Folder,
  ChalkboardTeacher,
  TrendUp,
} from "@phosphor-icons/react";
import { Steps } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { CourseDetailsRatingsComponent } from "./course-details-ratings-page";
import {
  formatTotalCourseDuration,
  SlideCountEntry,
  getBackendCourseDuration,
} from "@/utils/courseTime";
import { ProgressBar } from "@/components/ui/custom-progress-bar";

interface LevelOption {
  _id: string;
  value: string;
  label: string;
}

interface SlideCount {
  source_type: string;
  slide_count: number;
  display_name: string;
}

interface ModuleStats {
  totalModules: number;
  totalChapters: number;
}

interface EnrolledSession {
  id: string;
  session: {
    id: string;
    session_name: string;
    status: string;
    start_date: string;
  };
  level: {
    id: string;
    level_name: string;
    duration_in_days: number | null;
    thumbnail_id: string | null;
  };
  start_time: string | null;
  status: string;
  package_dto: {
    id: string;
    package_name: string;
    thumbnail_id?: string | null;
  };
}

interface CourseSidebarProps {
  hasRightSidebar: boolean;
  levelOptions: LevelOption[];
  selectedLevel: string;
  slideCountQuery: {
    isLoading: boolean;
    error: unknown;
    data?: Array<{
      slide_count: number;
      total_read_time_minutes: number | null;
      source_type: string;
    }>;
  };
  overviewVisible: boolean;
  processedSlideCounts: SlideCount[];
  moduleStats: ModuleStats;
  currentSubjects: unknown[];
  courseStructure: number;
  instructorsCount: number;
  selectedTab: string;
  selectedSession: string;
  enrolledSessions: EnrolledSession[];
  courseId: string;
  primaryInstructorName?: string;
  backendReadTimeMinutes?: number;
  paymentType?: string | null;
  packageSessionIdForCurrentLevel?: string | null;
  percentageCompleted?: number;
  onEnrollmentClick: () => void;
  onRatingsLoadingChange: (loading: boolean) => void;
}

export const CourseSidebar = ({
  hasRightSidebar,
  levelOptions,
  selectedLevel,
  slideCountQuery,
  overviewVisible,
  processedSlideCounts,
  moduleStats,
  currentSubjects,
  courseStructure,
  instructorsCount,
  selectedTab,
  selectedSession,
  enrolledSessions,
  courseId,
  primaryInstructorName,
  backendReadTimeMinutes,
  packageSessionIdForCurrentLevel,
  percentageCompleted,
  onEnrollmentClick,
  onRatingsLoadingChange,
}: CourseSidebarProps) => {
  const capitalizeFirst = (text: string): string => text;

  const safeEnrolledSessions = enrolledSessions || [];
  const isAlreadyEnrolled = safeEnrolledSessions.some(
    (enrolledSession) =>
      enrolledSession.package_dto.id === courseId &&
      enrolledSession.session.id === selectedSession &&
      enrolledSession.level.id === selectedLevel
  );

  // Compute total duration
  const totalDuration = (() => {
    if (
      typeof backendReadTimeMinutes === "number" &&
      !Number.isNaN(backendReadTimeMinutes) &&
      backendReadTimeMinutes > 0
    ) {
      return getBackendCourseDuration(backendReadTimeMinutes);
    }

    const raw = (slideCountQuery as unknown as { data?: SlideCountEntry[] })
      ?.data;
    if (raw && Array.isArray(raw)) {
      const totalMinutesFromSlides = raw.reduce((sum, entry) => {
        if (typeof entry.total_read_time_minutes === "number") {
          return sum + entry.total_read_time_minutes;
        }
        return sum;
      }, 0);

      if (totalMinutesFromSlides > 0) {
        return formatTotalCourseDuration(raw);
      }
    }

    const mapped: SlideCountEntry[] = (processedSlideCounts || []).map((c) => ({
      slide_count: c.slide_count,
      total_read_time_minutes: null,
      source_type: c.source_type,
    }));
    return formatTotalCourseDuration(mapped);
  })();

  const displayAuthorName = (() => {
    if (primaryInstructorName && String(primaryInstructorName).trim().length > 0) {
      return primaryInstructorName;
    }
    if (instructorsCount > 0) {
      return "Unknown Instructor";
    }
    return undefined;
  })();

  if (!hasRightSidebar) return null;

  return (
    <div className="lg:col-span-1 space-y-4">
      <div className="sticky top-4 space-y-4 lg:max-h-[calc(100vh-1rem)] overflow-y-auto pb-4">
        {/* Course Overview Card */}
        <Card className="animate-fade-in-up transition-all duration-300 hover:shadow-md border-border/60">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <Steps size={18} className="text-primary" weight="duotone" />
              </div>
              <CardTitle className="text-base font-bold">
                {(() => {
                  const term = getTerminology(
                    ContentTerms.Course,
                    SystemTerms.Course
                  ).toLocaleLowerCase();
                  return term.charAt(0).toUpperCase() + term.slice(1);
                })()}{" "}
                Overview
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Author Name */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Author</span>
              <span className="font-semibold">{displayAuthorName || "—"}</span>
            </div>

            <Separator />

            {/* Level Badge */}
            {levelOptions.length > 0 &&
              selectedLevel &&
              levelOptions.find((option) => option.value === selectedLevel)?.label !== "default" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Steps size={14} className="text-muted-foreground" />
                      {capitalizeFirst(getTerminology(ContentTerms.Level, SystemTerms.Level).toLocaleLowerCase())}
                    </span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-md">
                      {capitalizeFirst(levelOptions.find((option) => option.value === selectedLevel)?.label || "")}
                    </span>
                  </div>
                  <Separator />
                </>
              )}

            {/* Course Time */}
            {slideCountQuery.isLoading ? (
              <div className="flex justify-between items-center animate-pulse">
                <div className="h-4 w-20 bg-muted rounded"></div>
                <div className="h-4 w-12 bg-muted rounded"></div>
              </div>
            ) : !slideCountQuery.error ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Course Time</span>
                <span className="font-semibold">{totalDuration}</span>
              </div>
            ) : null}

            {/* Module Stats */}
            {overviewVisible && (
              <div className="space-y-3 pt-2">
                {moduleStats.totalModules > 0 && (
                  <div className="flex items-center justify-between text-sm group/item">
                    <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                      <FileText size={16} className="text-blue-500" weight="duotone" />
                      <span>{capitalizeFirst(getTerminology(ContentTerms.Modules, SystemTerms.Modules).toLocaleLowerCase())}</span>
                    </div>
                    <span className="font-semibold">{moduleStats.totalModules}</span>
                  </div>
                )}
                {moduleStats.totalChapters > 0 && (
                  <div className="flex items-center justify-between text-sm group/item">
                    <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                      <PresentationChart size={16} className="text-green-500" weight="duotone" />
                      <span>{capitalizeFirst(getTerminology(ContentTerms.Chapters, SystemTerms.Chapters).toLocaleLowerCase())}</span>
                    </div>
                    <span className="font-semibold">{moduleStats.totalChapters}</span>
                  </div>
                )}
                {courseStructure === 5 && currentSubjects.length > 0 && (
                  <div className="flex items-center justify-between text-sm group/item">
                    <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                      <Folder size={16} className="text-purple-500" weight="duotone" />
                      <span>{capitalizeFirst(getTerminology(ContentTerms.Subjects, SystemTerms.Subjects).toLocaleLowerCase())}</span>
                    </div>
                    <span className="font-semibold">{currentSubjects.length}</span>
                  </div>
                )}
                {instructorsCount > 0 && (
                  <div className="flex items-center justify-between text-sm group/item">
                    <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                      <ChalkboardTeacher size={16} className="text-orange-500" weight="duotone" />
                      <span>Instructors</span>
                    </div>
                    <span className="font-semibold">{instructorsCount}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {selectedTab === "ALL" && selectedSession && selectedLevel && !isAlreadyEnrolled && (
              <div className="pt-2">
                <Button className="w-full" onClick={onEnrollmentClick}>
                  Enroll Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Progress Card */}
        {selectedTab === "PROGRESS" && typeof percentageCompleted === "number" && (
          <Card className="animate-fade-in-up border-border/60 hover:shadow-md transition-all">
            <CardHeader className="pb-3 border-b bg-muted/40">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md">
                  <TrendUp size={18} className="text-green-600 dark:text-green-400" weight="duotone" />
                </div>
                <CardTitle className="text-base font-bold">Course Progress</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Completion</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {Math.min(percentageCompleted, 100).toFixed(0)}%
                  </span>
                </div>
                <ProgressBar value={Math.min(percentageCompleted, 100)} className="h-2.5" />
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-md border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium text-center">
                  Certificate will be generated upon completion
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ratings & Reviews */}
        {packageSessionIdForCurrentLevel && (
          <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <CourseDetailsRatingsComponent
              packageSessionId={packageSessionIdForCurrentLevel}
              onLoadingChange={onRatingsLoadingChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
