import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState, useCallback, useMemo } from "react";
import { truncateString } from "@/lib/reusable/truncateString";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { toTitleCase } from "@/lib/utils";
import { CaretLeft, BookOpen, GraduationCap, CaretRight } from "phosphor-react";
import { SlideMaterial } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/slide-material";
import {
  ChapterSidebarSlides,
  calculateOverallCompletion,
} from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { getModuleName } from "@/utils/study-library/get-name-by-id/getModuleNameById";
import { getSubjectName } from "@/utils/study-library/get-name-by-id/getSubjectNameById";
import { getChapterName } from "@/utils/study-library/get-name-by-id/getChapterById";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { InitStudyLibraryProvider } from "@/providers/study-library/init-study-library-provider";
import { ModulesWithChaptersProvider } from "@/providers/study-library/modules-with-chapters-provider";
import { useSlides, Slide } from "@/hooks/study-library/use-slides";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";
import FeedbackPage from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/FeedbackPage";
import { FiEdit } from "react-icons/fi";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { Preferences } from "@capacitor/preferences";
import { BatchForSessionType } from "@/stores/study-library/institute-schema";
import { getPublicUrl } from "@/services/upload_file";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChapterSearchParams {
  courseId: string;
  subjectId: string;
  moduleId: string;
  chapterId: string;
  slideId: string;
  sessionId: string;
}

export const Route = createFileRoute(
  "/study-library/courses/course-details/subjects/modules/chapters/slides/"
)({
  component: Slides,
  validateSearch: (search: Record<string, unknown>): ChapterSearchParams => ({
    courseId: search.courseId as string,
    subjectId: search.subjectId as string,
    moduleId: search.moduleId as string,
    chapterId: search.chapterId as string,
    slideId: search.slideId as string,
    sessionId: search.sessionId as string,
  }),
});

function Slides() {
  const { courseId, subjectId, moduleId, chapterId, slideId, sessionId } =
    Route.useSearch();

  useSidebar();
  const navigate = useNavigate();
  const { setItems, setActiveItem, activeItem } = useContentStore();
  const { slides } = useSlides(chapterId || "");
  const { studyLibraryData } = useStudyLibraryStore();
  const { modulesWithChaptersData } = useModulesWithChaptersStore();

  useEffect(() => {
    if (slides?.length) {
      const feedbackSlide: Slide = {
        id: "feedback-slide",
        title: "Give Feedback",
        source_type: "FEEDBACK",
        source_id: "",
        image_file_id: "",
        description: "Provide feedback for this chapter",
        status: "ACTIVE",
        slide_order: slides.length + 1,
        percentage_completed: 0,
        is_loaded: true,
        new_slide: false,
        progress_marker: 0,
      };

      const slidesWithFeedback = [...slides, feedbackSlide];
      setItems(slidesWithFeedback);

      const completion = calculateOverallCompletion(slides);

      // Priority 1: If course is 100% completed
      if (completion === 100) {
        // Check if user has already seen feedback for this course
        const feedbackSeenKey = `feedback_seen_${courseId}_${chapterId}`;
        const hasSeenFeedback = localStorage.getItem(feedbackSeenKey);

        if (!hasSeenFeedback) {
          // First time completion - show feedback page
          localStorage.setItem(feedbackSeenKey, "true");
          setActiveItem(feedbackSlide);
          return;
        } else {
          // User returning to completed course - show first slide for better UX
          setActiveItem(slidesWithFeedback[0]);
          return;
        }
      }

      // Priority 2: If user explicitly navigated to a specific slide via URL
      if (slideId) {
        const targetSlide = slidesWithFeedback.find((s) => s.id === slideId);
        if (targetSlide) {
          setActiveItem(targetSlide);
          return;
        }
      }

      // Priority 3: Default to first slide
      setActiveItem(slidesWithFeedback[0]);
    }
  }, [slides, slideId, setActiveItem, setItems, courseId, chapterId]);

  const handleSubjectRoute = useCallback(() => {
    navigate({
      to: "/study-library/courses/course-details/subjects/modules",
      search: { courseId, subjectId, moduleId },
    });
  }, [navigate, courseId, subjectId, moduleId]);

  const handleModuleRoute = useCallback(() => {
    navigate({
      to: "/study-library/courses/course-details/subjects/modules/chapters",
      search: { courseId, subjectId, moduleId, chapterId },
    });
  }, [navigate, courseId, subjectId, moduleId, chapterId]);

  // gotoSlide removed (unused)

  const [moduleName, setModuleName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [levelName, setLevelName] = useState("");
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string>("");
  const [homeIconClickRoute, setHomeIconClickRoute] = useState<string | null>(
    null
  );
  // truncatedChapterName removed (unused)
  const handleInstituteLogoClick = useCallback(() => {
    if (homeIconClickRoute) {
      window.location.href = homeIconClickRoute;
    }
  }, [homeIconClickRoute]);

  useEffect(() => {
    setModuleName(getModuleName(moduleId, modulesWithChaptersData));
    setChapterName(getChapterName(chapterId, modulesWithChaptersData) || "");
    setSubjectName(getSubjectName(subjectId, studyLibraryData) || "");
  }, [
    chapterId,
    moduleId,
    subjectId,
    modulesWithChaptersData,
    studyLibraryData,
  ]);

  // Get course and level names, and institute logo
  useEffect(() => {
    const getCourseAndLevelInfo = async () => {
      try {
        // Get institute details first for logo
        const instituteData = await Preferences.get({
          key: "InstituteDetails",
        });
        if (instituteData.value) {
          const institute = JSON.parse(instituteData.value);

          setHomeIconClickRoute(
            institute.home_icon_click_route ??
            institute.homeIconClickRoute ??
            null
          );

          // Get institute logo
          if (institute.institute_logo_file_id) {
            try {
              const logoUrl = await getPublicUrl(
                institute.institute_logo_file_id
              );
              if (logoUrl) {
                setInstituteLogoUrl(logoUrl);
              }
            } catch {
              // Silently handle logo loading error
            }
          }

          // Try to find course info in institute batches_for_sessions
          if (
            institute.batches_for_sessions &&
            Array.isArray(institute.batches_for_sessions)
          ) {
            // Try multiple matching strategies
            let matchingBatch = institute.batches_for_sessions.find(
              (batch: BatchForSessionType) => batch.id === sessionId
            );

            if (!matchingBatch) {
              matchingBatch = institute.batches_for_sessions.find(
                (batch: BatchForSessionType) =>
                  batch.package_dto?.id === courseId
              );
            }

            // If still no match, use the first available batch
            if (!matchingBatch && institute.batches_for_sessions.length > 0) {
              matchingBatch = institute.batches_for_sessions[0];
            }

            if (matchingBatch) {
              const courseNameFromBatch =
                matchingBatch.package_dto?.package_name || "";
              const levelNameFromBatch = matchingBatch.level?.level_name || "";
              setCourseName(courseNameFromBatch);
              setLevelName(levelNameFromBatch);
            }
          }
        }
      } catch {
        // Silently handle errors
        console.error("Error loading institute or course data");
      }
    };

    getCourseAndLevelInfo();
  }, [sessionId, courseId, courseName, levelName]);

  const [showLearningPath, setShowLearningPath] = useState(true);
  const [feedbackVisible, setFeedbackVisible] = useState(true);

  // Load Student Display Settings for slides view
  useEffect(() => {
    getStudentDisplaySettings(false).then((s) => {
      setShowLearningPath(
        s?.courseDetails?.slidesView?.showLearningPath ?? true
      );
      setFeedbackVisible(s?.courseDetails?.slidesView?.feedbackVisible ?? true);
    });
  }, []);

  const nextChapter = useMemo(() => {
    if (!modulesWithChaptersData?.length) return null;

    const currentModIndex = modulesWithChaptersData.findIndex(
      (m) => m.module.id === moduleId
    );
    if (currentModIndex === -1) return null;

    const currentMod = modulesWithChaptersData[currentModIndex];
    if (!currentMod?.chapters) return null;

    const currentChapIndex = currentMod.chapters.findIndex(
      (c) => c.id === chapterId
    );
    if (currentChapIndex === -1) return null;

    // Check next in same module
    if (currentChapIndex + 1 < currentMod.chapters.length) {
      return {
        module: currentMod.module,
        chapter: currentMod.chapters[currentChapIndex + 1],
      };
    }

    // Check start of next module
    if (currentModIndex + 1 < modulesWithChaptersData.length) {
      const nextMod = modulesWithChaptersData[currentModIndex + 1];
      if (nextMod.chapters?.length > 0) {
        return {
          module: nextMod.module,
          chapter: nextMod.chapters[0],
        };
      }
    }

    return null;
  }, [modulesWithChaptersData, moduleId, chapterId]);

  const handleNextChapter = useCallback(() => {
    if (nextChapter) {
      navigate({
        to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
        search: {
          courseId,
          subjectId,
          moduleId: nextChapter.module.id,
          chapterId: nextChapter.chapter.id,
          slideId: "", // Default to first slide
          sessionId,
        },
      });
    }
  }, [nextChapter, navigate, courseId, subjectId, sessionId]);

  const SidebarComponent = (
    <div className="flex flex-col h-full bg-white border-r border-gray-100/50">
      {/* --- Header Section: Title & Breadcrumbs --- */}
      <div className="flex-none p-4 space-y-4 border-b border-dashed border-gray-200 bg-white/50 backdrop-blur-sm z-10">

        {/* Course Info Row */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg border border-gray-200 p-1 bg-white shadow-sm flex items-center justify-center text-primary-600">
            {instituteLogoUrl ? (
              <img
                src={instituteLogoUrl}
                alt="Institute"
                onClick={homeIconClickRoute ? handleInstituteLogoClick : undefined}
                className={`max-w-full max-h-full object-contain ${homeIconClickRoute ? "cursor-pointer" : ""}`}
              />
            ) : (
              <GraduationCap size={16} weight="duotone" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-1 mb-0.5">
              {courseName ? toTitleCase(courseName) : "Course Details"}
            </h3>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              {levelName && levelName.toLowerCase() !== "default"
                ? toTitleCase(levelName)
                : "Course Material"}
            </p>
          </div>
        </div>

        {/* Minimal Breadcrumbs */}
        {showLearningPath && (
          <div className="flex items-center text-xs text-gray-500 font-medium overflow-hidden" id="slides-breadcrumb-row">
            <div className="flex items-center gap-1.5 flex-wrap truncate">
              {/* Subject */}
              <button
                onClick={handleSubjectRoute}
                className="hover:text-primary-600 hover:underline transition-colors truncate max-w-[80px] sm:max-w-[100px]"
              >
                {toTitleCase(subjectName || "Subject")}
              </button>
              <ChevronRightIcon className="w-3 h-3 text-gray-300 flex-shrink-0" />

              {/* Module */}
              <button
                onClick={handleModuleRoute}
                className="hover:text-primary-600 hover:underline transition-colors truncate max-w-[80px] sm:max-w-[100px]"
              >
                {toTitleCase(moduleName || "Module")}
              </button>
              <ChevronRightIcon className="w-3 h-3 text-gray-300 flex-shrink-0" />

              {/* Chapter (Active) */}
              <span className="text-gray-900 font-semibold truncate max-w-[100px] sm:max-w-[120px]">
                {toTitleCase(chapterName || "Chapter")}
              </span>
            </div>

            {/* Mobile Hierarchy Popover (only visible on smallest screens if needed, otherwise handled by wrap) - kept for compatibility if needed, but the flex-wrap above handles most cases cleanly. 
                 Re-adding the popover for mobile interactions just in case. */}
            <div className="sm:hidden ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end">
                  <div className="flex flex-col gap-1 text-xs">
                    <button onClick={handleSubjectRoute} className="text-left px-2 py-1.5 hover:bg-gray-50 rounded">
                      {toTitleCase(subjectName || "Subject")}
                    </button>
                    <button onClick={handleModuleRoute} className="text-left px-2 py-1.5 hover:bg-gray-50 rounded">
                      {toTitleCase(moduleName || "Module")}
                    </button>
                    <span className="px-2 py-1.5 font-semibold bg-gray-50 rounded text-primary-700">
                      {toTitleCase(chapterName || "Chapter")}
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {/* --- Scrollable Content: Slides List --- */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        <div className="p-3">
          <ChapterSidebarSlides />
        </div>
      </div>

      {/* --- Footer: Progress & Actions --- */}
      {slides && slides.length > 0 && (
        <div className="flex-none p-4 border-t border-gray-100 bg-white space-y-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">

          {/* Next Chapter Button (Compact) */}
          {nextChapter && (
            <button
              onClick={handleNextChapter}
              className="w-full flex items-center justify-between gap-2 px-1 py-1 rounded hover:bg-gray-50 transition-colors group/next mb-1"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide group-hover/next:text-primary-500 transition-colors">
                  Next
                </span>
                <span className="text-xs font-semibold text-gray-700 truncate group-hover/next:text-gray-900 transition-colors">
                  {toTitleCase(nextChapter.chapter.chapter_name)}
                </span>
              </div>
              <CaretRight
                size={12}
                className="text-gray-300 group-hover/next:text-primary-500 transition-colors flex-shrink-0"
                weight="bold"
              />
            </button>
          )}

          {/* Progress Bar (Minimal) */}
          <div className="space-y-1.5 group">
            <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              <span>Progress</span>
              <span className="text-gray-900 group-hover:text-primary-600 transition-colors">
                {Math.min(calculateOverallCompletion(slides), 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${Math.min(calculateOverallCompletion(slides), 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse-slow py-0.5" />
              </div>
            </div>
          </div>

          {/* Feedback Button (Ghost) */}
          {feedbackVisible && (
            <button
              onClick={() => {
                const feedbackSlide: Slide = {
                  id: "feedback-slide",
                  title: "Feedback",
                  source_type: "FEEDBACK",
                  source_id: "",
                  image_file_id: "",
                  description: "Provide feedback for this chapter",
                  status: "ACTIVE",
                  slide_order: slides?.length ? slides.length + 1 : 1,
                  percentage_completed: 0,
                  is_loaded: true,
                  new_slide: false,
                  progress_marker: 0,
                };
                setActiveItem(feedbackSlide);
              }}
              className={`
                w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold
                transition-all duration-200 border border-transparent
                ${activeItem?.id === "feedback-slide"
                  ? "bg-primary-50 text-primary-700 border-primary-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-200"
                }
              `}
            >
              <FiEdit className="w-3.5 h-3.5" />
              <span>Feedback</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  const { setNavHeading } = useNavHeadingStore();

  useEffect(() => {
    const heading = (
      <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
        <button
          onClick={() => window.history.back()}
          className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"
        >
          <CaretLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
        </button>
        <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1">
          <div className="p-0.5 sm:p-1 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center min-w-[32px] min-h-[32px] sm:min-w-[40px] sm:min-h-[40px]">
            {instituteLogoUrl ? (
              <img
                src={instituteLogoUrl}
                alt="Institute Logo"
                onClick={
                  homeIconClickRoute ? handleInstituteLogoClick : undefined
                }
                className={`max-w-full max-h-full object-contain${homeIconClickRoute ? " cursor-pointer" : ""
                  }`}
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: "28px",
                  maxHeight: "28px",
                }}
              />
            ) : (
              <BookOpen
                size={16}
                className="sm:w-5 sm:h-5 text-primary-600"
                weight="fill"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Mobile: Show only current node, popover reveals full path for selection */}
            <div className="block sm:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 text-xs font-bold text-gray-900 truncate mb-0.5 max-w-full">
                    <span className="truncate">
                      {truncateString(
                        toTitleCase(chapterName || "Course Details"),
                        25
                      )}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[90vw] max-w-sm p-2"
                  sideOffset={6}
                  align="start"
                >
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Learning Path
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <button
                        className="px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 truncate"
                        onClick={handleSubjectRoute}
                      >
                        {toTitleCase(subjectName || "Subject")}
                      </button>
                      <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                      <button
                        className="px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 truncate"
                        onClick={handleModuleRoute}
                      >
                        {toTitleCase(moduleName || "Module")}
                      </button>
                      <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                      <span className="px-2 py-1 rounded-md bg-primary-50 text-primary-700 font-semibold truncate">
                        {toTitleCase(chapterName || "Chapter")}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-gray-900 truncate">
                {subjectName && moduleName && chapterName
                  ? `${truncateString(
                    toTitleCase(subjectName),
                    window.innerWidth < 768
                      ? 8
                      : window.innerWidth < 1024
                        ? 12
                        : 18
                  )} • ${truncateString(
                    toTitleCase(moduleName),
                    window.innerWidth < 768
                      ? 8
                      : window.innerWidth < 1024
                        ? 12
                        : 18
                  )} • ${truncateString(
                    toTitleCase(chapterName),
                    window.innerWidth < 768
                      ? 10
                      : window.innerWidth < 1024
                        ? 15
                        : 25
                  )}`
                  : "Course Details"}
              </h1>
            </div>
          </div>
        </div>
      </div>
    );
    setNavHeading(heading);
  }, [
    setNavHeading,
    subjectName,
    moduleName,
    chapterName,
    instituteLogoUrl,
    handleSubjectRoute,
    handleModuleRoute,
  ]);

  return (
    <LayoutContainer
      sidebarComponent={SidebarComponent}
      className="md:my-0 md:mx-3 lg:mx-4"
    >
      <InitStudyLibraryProvider>
        <ModulesWithChaptersProvider subjectId={subjectId}>
          <SidebarProvider defaultOpen={false}>
            {activeItem?.id === "feedback-slide" ? (
              <FeedbackPage />
            ) : (
              <SlideMaterial />
            )}
          </SidebarProvider>
        </ModulesWithChaptersProvider>
      </InitStudyLibraryProvider>
    </LayoutContainer>
  );
}
