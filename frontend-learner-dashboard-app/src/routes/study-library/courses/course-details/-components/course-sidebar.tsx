import {
  FileText,
  PresentationChart,
  Folder,
  ChalkboardTeacher,
  TrendUp,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Steps } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
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
  const isAlreadyEnrolled = safeEnrolledSessions.some((enrolledSession) => {
    // Original trio match — works when session/level resolve to real UUIDs.
    if (
      enrolledSession.package_dto.id === courseId &&
      enrolledSession.session.id === selectedSession &&
      enrolledSession.level.id === selectedLevel
    ) {
      return true;
    }
    // Additive: match by package_session_id (unique batch key). Covers cases
    // where the enrollment record carries empty/DEFAULT session/level ids
    // (e.g. backend PROGRESS results for courses with placeholder sessions).
    return (
      !!packageSessionIdForCurrentLevel &&
      enrolledSession.id === packageSessionIdForCurrentLevel
    );
  });

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
    if (
      primaryInstructorName &&
      String(primaryInstructorName).trim().length > 0
    ) {
      return primaryInstructorName;
    }
    if (instructorsCount > 0) {
      return "Unknown Instructor";
    }
    return undefined;
  })();

  if (!hasRightSidebar) return null;

  return (
    <div className="space-y-3 pb-3">
      {/* Course Overview Card */}
      <Card className="animate-fade-in-up transition-all duration-300 hover:shadow-md border-border/60">
        <CardHeader className="p-3 pb-2 border-b bg-muted/40">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-primary/10 rounded-md">
              <Steps size={14} className="text-primary" weight="duotone" />
            </div>
            <CardTitle className="text-sm font-bold">
              {(() => {
                const term = getTerminology(
                  ContentTerms.Course,
                  SystemTerms.Course,
                ).toLocaleLowerCase();
                return term.charAt(0).toUpperCase() + term.slice(1);
              })()}{" "}
              Overview
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-2.5 space-y-2.5">
          {/* Author Name */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Author</span>
            <span className="font-semibold">{displayAuthorName || "—"}</span>
          </div>

          <Separator />

          {/* Level Badge */}
          {levelOptions.length > 0 &&
            selectedLevel &&
            levelOptions.find((option) => option.value === selectedLevel)
              ?.label !== "default" && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Steps size={14} className="text-muted-foreground" />
                    {capitalizeFirst(
                      getTerminology(
                        ContentTerms.Level,
                        SystemTerms.Level,
                      ).toLocaleLowerCase(),
                    )}
                  </span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-md">
                    {capitalizeFirst(
                      levelOptions.find(
                        (option) => option.value === selectedLevel,
                      )?.label || "",
                    )}
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
              <span className="text-muted-foreground font-medium">
                {getTerminology(ContentTerms.Course, SystemTerms.Course)} Time
              </span>
              <span className="font-semibold">{totalDuration}</span>
            </div>
          ) : null}

          {/* Module Stats */}
          {overviewVisible && (
            <div className="space-y-3 pt-2">
              {moduleStats.totalModules > 0 && (
                <div className="flex items-center justify-between text-sm group/item">
                  <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                    <FileText
                      size={16}
                      className="text-blue-500"
                      weight="duotone"
                    />
                    <span>
                      {capitalizeFirst(
                        getTerminology(
                          ContentTerms.Modules,
                          SystemTerms.Modules,
                        ).toLocaleLowerCase(),
                      )}
                    </span>
                  </div>
                  <span className="font-semibold">
                    {moduleStats.totalModules}
                  </span>
                </div>
              )}
              {moduleStats.totalChapters > 0 && (
                <div className="flex items-center justify-between text-sm group/item">
                  <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                    <PresentationChart
                      size={16}
                      className="text-green-500"
                      weight="duotone"
                    />
                    <span>
                      {capitalizeFirst(
                        getTerminology(
                          ContentTerms.Chapters,
                          SystemTerms.Chapters,
                        ).toLocaleLowerCase(),
                      )}
                    </span>
                  </div>
                  <span className="font-semibold">
                    {moduleStats.totalChapters}
                  </span>
                </div>
              )}
              {courseStructure === 5 && currentSubjects.length > 0 && (
                <div className="flex items-center justify-between text-sm group/item">
                  <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                    <Folder
                      size={16}
                      className="text-purple-500"
                      weight="duotone"
                    />
                    <span>
                      {capitalizeFirst(
                        getTerminology(
                          ContentTerms.Subjects,
                          SystemTerms.Subjects,
                        ).toLocaleLowerCase(),
                      )}
                    </span>
                  </div>
                  <span className="font-semibold">
                    {currentSubjects.length}
                  </span>
                </div>
              )}
              {instructorsCount > 0 && (
                <div className="flex items-center justify-between text-sm group/item">
                  <div className="flex items-center gap-2 text-muted-foreground group-hover/item:text-foreground transition-colors">
                    <ChalkboardTeacher
                      size={16}
                      className="text-orange-500"
                      weight="duotone"
                    />
                    <span>
                      {getTerminologyPlural(
                        RoleTerms.Teacher,
                        SystemTerms.Teacher,
                      )}
                    </span>
                  </div>
                  <span className="font-semibold">{instructorsCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {selectedTab === "ALL" &&
            selectedSession &&
            selectedLevel &&
            !isAlreadyEnrolled && (
              <div className="pt-2">
                <Button
                  className={cn(
                    "w-full font-semibold",
                    // Vibrant Styles - Flat Button
                    "[.ui-vibrant_&]:bg-indigo-600 [.ui-vibrant_&]:hover:bg-indigo-700 [.ui-vibrant_&]:text-white",
                    "[.ui-vibrant_&]:shadow-md",
                    // Play Styles — solid, bold, Duolingo-style
                    "[.ui-play_&]:bg-[#58cc02] [.ui-play_&]:hover:bg-[#46a302] [.ui-play_&]:text-white [.ui-play_&]:font-extrabold [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide",
                    "[.ui-play_&]:rounded-xl [.ui-play_&]:shadow-[0_4px_0_#46a302] [.ui-play_&]:hover:shadow-[0_2px_0_#46a302] [.ui-play_&]:active:shadow-none",
                  )}
                  onClick={onEnrollmentClick}
                >
                  Enroll Now
                </Button>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Course Progress Card */}
      {selectedTab === "PROGRESS" &&
        typeof percentageCompleted === "number" && (
          <Card
            className={cn(
              "animate-fade-in-up border-border/60 hover:shadow-md transition-all",
              // Vibrant Styles - Flat Pastel
              percentageCompleted === 100
                ? "[.ui-vibrant_&]:bg-emerald-50/50 dark:[.ui-vibrant_&]:bg-emerald-950/20 [.ui-vibrant_&]:border-emerald-200/50 dark:[.ui-vibrant_&]:border-emerald-800/30"
                : "[.ui-vibrant_&]:bg-blue-50/50 dark:[.ui-vibrant_&]:bg-blue-950/20 [.ui-vibrant_&]:border-blue-200/50 dark:[.ui-vibrant_&]:border-blue-800/30",
              "[.ui-vibrant_&]:shadow-md",
              // Play Styles — solid hero card with soft layered shadow
              "[.ui-play_&]:rounded-2xl [.ui-play_&]:border-transparent [.ui-play_&]:font-bold",
              percentageCompleted === 100
                ? "[.ui-play_&]:bg-[#58cc02] [.ui-play_&]:text-white [.ui-play_&]:shadow-[0_1px_2px_rgba(70,163,2,0.22),0_16px_32px_-12px_rgba(88,204,2,0.45)]"
                : "[.ui-play_&]:bg-[#1cb0f6] [.ui-play_&]:text-white [.ui-play_&]:shadow-[0_1px_2px_rgba(24,153,214,0.22),0_16px_32px_-12px_rgba(28,176,246,0.45)]",
            )}
          >
            <CardHeader
              className={cn(
                "p-3 pb-2 border-b bg-muted/40",
                "[.ui-vibrant_&]:bg-transparent [.ui-vibrant_&]:border-black/5 dark:[.ui-vibrant_&]:border-white/5",
                // Play Styles
                "[.ui-play_&]:bg-transparent [.ui-play_&]:border-white/20",
              )}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={cn(
                    "p-1 bg-green-100 dark:bg-green-900/30 rounded-md",
                    "[.ui-vibrant_&]:bg-green-500/20",
                    // Play Styles
                    "[.ui-play_&]:bg-white/20 [.ui-play_&]:rounded-xl",
                  )}
                >
                  <TrendUp
                    size={14}
                    className="text-green-600 dark:text-green-400"
                    weight="duotone"
                  />
                </div>
                <CardTitle className="text-base font-bold">
                  {getTerminology(ContentTerms.Course, SystemTerms.Course)}{" "}
                  Progress
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-2.5 space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">
                    Completion
                  </span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {Math.min(percentageCompleted, 100).toFixed(0)}%
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(percentageCompleted, 100)}
                  className="h-2.5"
                />
              </div>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/10 rounded-md border border-amber-200 dark:border-amber-800">
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
  );
};
