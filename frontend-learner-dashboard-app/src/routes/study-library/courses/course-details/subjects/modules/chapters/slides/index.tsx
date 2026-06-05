import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState, useCallback, useMemo } from "react";
import { truncateString } from "@/lib/reusable/truncateString";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { toTitleCase } from "@/lib/utils";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { CaretLeft, BookOpen, GraduationCap, CaretRight, CheckCircle } from "@phosphor-icons/react";
import { SlideMaterial } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/slide-material";
import {
  ChapterSidebarSlides,
  calculateOverallCompletion,
} from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { CourseTreeSidebar } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/course-tree-sidebar";
import { getModuleName } from "@/utils/study-library/get-name-by-id/getModuleNameById";
import { getSubjectName } from "@/utils/study-library/get-name-by-id/getSubjectNameById";
import { getChapterName } from "@/utils/study-library/get-name-by-id/getChapterById";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { InitStudyLibraryProvider } from "@/providers/study-library/init-study-library-provider";
import { ModulesWithChaptersProvider } from "@/providers/study-library/modules-with-chapters-provider";
import { useSlides, Slide } from "@/hooks/study-library/use-slides";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { useModulesWithChaptersStore, ModulesWithChapters } from "@/stores/study-library/use-modules-with-chapters-store";
import { useDripConditionStore } from "@/stores/study-library/drip-conditions-store";
import { useDripConditions } from "@/hooks/use-drip-conditions";
import {
  evaluateDripCondition,
  type LearnerProgressData,
} from "@/utils/drip-conditions";
import {
  shouldFilterItem,
  isItemLocked,
} from "@/components/drip-conditions/helpers";
import { useQuery } from "@tanstack/react-query";
import { GET_COURSE_DETAILS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { handleGetCourseInit } from "@/routes/study-library/courses/course-details/-services/get-course-details";
import { getInstituteId } from "@/constants/helper";
import { fetchModulesWithChapters, fetchModulesWithChaptersPublic } from "@/services/study-library/getModulesWithChapters";
import { toast } from "sonner";
import FeedbackPage from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/FeedbackPage";
import { PencilSimple } from "@phosphor-icons/react";
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
  levelId?: string;
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
    levelId: search.levelId as string | undefined,
    subjectId: search.subjectId as string,
    moduleId: search.moduleId as string,
    chapterId: search.chapterId as string,
    slideId: search.slideId as string,
    sessionId: search.sessionId as string,
  }),
});

// ── Module Accordion Item ────────────────────────────────────────────────────
// Used inside the Module Switcher popover so each module manages its own
// expanded/collapsed state independently (hooks cannot be called in a .map()).
const ModuleAccordionItem = ({
  modData,
  isInitiallyExpanded,
  currentChapterId,
  onChapterSelect,
}: {
  modData: ModulesWithChapters;
  isInitiallyExpanded: boolean;
  currentChapterId: string;
  onChapterSelect: (moduleId: string, chapterId: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const completedChapters = modData.chapters.filter(
    (c) => c.percentage_completed >= 90
  ).length;

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Module header — tap to expand/collapse */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
          isInitiallyExpanded ? "bg-primary-50/40" : "hover:bg-gray-50"
        }`}
      >
        <div className="min-w-0 flex-1">
          <span
            className={`text-caption font-semibold leading-tight line-clamp-1 ${
              isInitiallyExpanded ? "text-primary-700" : "text-gray-700"
            }`}
          >
            {toTitleCase(modData.module.module_name)}
          </span>
          {modData.chapters.length > 0 && (
            <span className="text-caption text-gray-400 mt-0.5 block">
              {completedChapters}/{modData.chapters.length} {getTerminology(ContentTerms.Chapters, SystemTerms.Chapters).toLowerCase()}
            </span>
          )}
        </div>
        <ChevronRightIcon
          className={`w-3 h-3 flex-shrink-0 ml-2 transition-transform duration-200 ${
            isExpanded ? "rotate-90 text-primary-500" : "text-gray-400"
          }`}
        />
      </button>

      {/* Chapter list */}
      {isExpanded && modData.chapters.length > 0 && (
        <div className="pb-1">
          {modData.chapters.map((chapter) => {
            const isCurrent = chapter.id === currentChapterId;
            const isDone = chapter.percentage_completed >= 90;
            return (
              <button
                key={chapter.id}
                onClick={() => onChapterSelect(modData.module.id, chapter.id)}
                className={`w-full text-left px-5 py-1.5 text-caption transition-colors flex items-center gap-2 ${
                  isCurrent
                    ? "bg-primary-50 text-primary-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isCurrent
                      ? "bg-primary-500"
                      : isDone
                      ? "bg-success-400"
                      : "bg-gray-300"
                  }`}
                />
                <span className="truncate flex-1">
                  {toTitleCase(chapter.chapter_name)}
                </span>
                {isDone && !isCurrent && (
                  <CheckCircle
                    className="w-3 h-3 text-success-500 flex-shrink-0"
                    weight="fill"
                  />
                )}
                {isCurrent && (
                  <span className="text-caption font-bold text-primary-500 uppercase tracking-wide flex-shrink-0">
                    Now
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

function Slides() {
  const { courseId, levelId, subjectId, moduleId, chapterId, slideId, sessionId } =
    Route.useSearch();

  useSidebar();
  const navigate = useNavigate();

  const { data: packageSessionIdFromStore } = useQuery({
    queryKey: ["packageSessionId"],
    queryFn: async () => {
      const { getPackageSessionId } = await import("@/utils/study-library/get-list-from-stores/getPackageSessionId");
      return getPackageSessionId();
    },
  });
  const resolvedSessionId = sessionId || packageSessionIdFromStore || "";
  const {
    setItems,
    setActiveItem,
    activeItem,
    setSlideEvaluations,
    setCurrentPackageSessionId,
  } = useContentStore();

  // Keep the content store in sync with the course currently being viewed so
  // that doubts are raised/filtered against THIS course's package session
  // (the URL's sessionId), not the learner's default first enrollment.
  useEffect(() => {
    setCurrentPackageSessionId(resolvedSessionId || null);
  }, [resolvedSessionId, setCurrentPackageSessionId]);

  const { slides } = useSlides(chapterId || "");
  const { studyLibraryData } = useStudyLibraryStore();
  const { modulesWithChaptersData, setModulesWithChaptersData } = useModulesWithChaptersStore();

  // Get drip conditions from store or fetch from API
  const {
    getDripCondition,
    setDripCondition,
    clearDripCondition,
    isDrippingEnable,
  } = useDripConditionStore();

  const storedDripCondition = courseId ? getDripCondition(courseId) : null;

  // Fetch drip condition from API if not in store
  const { data: courseDetails } = useQuery({
    queryKey: ["course-details", courseId],
    queryFn: async () => {
      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: GET_COURSE_DETAILS,
        params: {
          packageId: courseId,
        },
      });
      return response.data;
    },
    enabled: !!courseId && !storedDripCondition, // Only fetch if not in store
    staleTime: 3600000, // 1 hour
  });

  // Course-init response (same endpoint the outer course page uses) so the
  // breadcrumb subject picker reads from the authoritative sessions →
  // levelDetails → subjects tree. Resolves instituteId asynchronously.
  const [instituteId, setInstituteId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getInstituteId().then((id) => {
      if (!cancelled) setInstituteId(id || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const { data: courseInitData } = useQuery(
    handleGetCourseInit({
      courseId: courseId || "",
      instituteId: instituteId || "",
    })
  );

  // Save fetched drip condition to store
  useEffect(() => {
    if (courseDetails?.drip_condition_json && courseId) {
      const dripCondition =
        courseDetails.drip_condition_json ||
        courseDetails.dripConditionJson ||
        courseDetails.drip_condition ||
        courseDetails.dripCondition;

      if (dripCondition) {
        clearDripCondition(courseId); // Clear before setting
        setDripCondition(courseId, dripCondition);
      }
    }
  }, [courseDetails, courseId, setDripCondition, clearDripCondition]);

  // Use stored or fetched drip condition
  const dripConditionJson =
    storedDripCondition ||
    courseDetails?.drip_condition_json ||
    courseDetails?.dripConditionJson ||
    courseDetails?.drip_condition ||
    courseDetails?.dripCondition ||
    null;

  const { condition: slideCondition } = useDripConditions(
    dripConditionJson,
    "slide"
  );

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

      // Apply drip conditions to filter slides
      let accessibleSlides = slides;
      const evaluations: Record<
        string,
        { isLocked: boolean; isHidden: boolean; unlockMessage: string | null }
      > = {};

      // Build comprehensive prerequisite completions map with BOTH chapters and slides
      const prerequisiteCompletions: Record<string, number> = {};

      // 1. Add all chapters and their progress
      if (modulesWithChaptersData) {
        modulesWithChaptersData.forEach((module) => {
          module.chapters.forEach((chapter) => {
            // Calculate chapter progress from its slides (if available in current context)
            // For now, use 0 as default - will be updated when we have slide data loaded
            prerequisiteCompletions[chapter.id] = 0;
          });
        });
      }

      // 2. Add all slides from current chapter and their progress
      slides.forEach((slide: Slide) => {
        prerequisiteCompletions[slide.id] = slide.percentage_completed || 0;
      });

      // 3. Calculate chapter progress for current chapter based on its slides
      if (chapterId) {
        const chapterProgress = calculateOverallCompletion(slides);
        prerequisiteCompletions[chapterId] = chapterProgress;
      }

      // Evaluate drip conditions for each slide
      accessibleSlides = slides.filter((slide: Slide, index: number) => {
        const previousSlide = index > 0 ? slides[index - 1] : null;
        const progressData: LearnerProgressData = {
          percentageCompleted: slide.percentage_completed || 0,
          previousItemId: previousSlide?.id,
          previousItemCompletion: previousSlide?.percentage_completed || 0,
          itemIndex: index,
          prerequisiteCompletions,
        };

        // Check if this slide has its own drip condition (check both fields)
        let slideDripCondition = null;
        const dripConditionData =
          slide.drip_condition || slide.drip_condition_json;

        if (dripConditionData) {
          try {
            const parsed =
              typeof dripConditionData === "string"
                ? JSON.parse(dripConditionData)
                : dripConditionData;

            // Handle array of conditions - filter for enabled slide conditions
            if (Array.isArray(parsed)) {
              slideDripCondition =
                parsed.find(
                  (cond) =>
                    (cond.target === "slide" || !cond.target) &&
                    cond.is_enabled !== false
                ) || null;
            } else if (parsed && typeof parsed === "object") {
              // Single condition - check if enabled and for slides
              if (
                (parsed.target === "slide" || !parsed.target) &&
                parsed.is_enabled !== false
              ) {
                slideDripCondition = parsed;
              }
            }
          } catch (e) {
            console.error("Failed to parse slide drip condition:", e);
          }
        }

        // Use slide-specific condition if available, otherwise fall back to package-level
        const conditionToUse = slideDripCondition || slideCondition;
        const hasCondition = !!slideDripCondition || !!slideCondition;

        // Check global flag first, then per-item condition's is_enabled flag
        const shouldEvaluate =
          isDrippingEnable &&
          hasCondition &&
          conditionToUse?.is_enabled !== false;

        const evaluation =
          shouldEvaluate && conditionToUse
            ? evaluateDripCondition(conditionToUse, progressData)
            : {
              isLocked: false,
              isHidden: false,
              unlockMessage: null,
            };
        evaluations[slide.id] = evaluation; // Store evaluation for this slide
        const shouldHide = shouldFilterItem(evaluation);

        return !shouldHide; // Keep slide if not hidden
      });

      // Store evaluations for all accessible slides
      setSlideEvaluations(evaluations);

      const slidesWithFeedback = [...accessibleSlides, feedbackSlide];
      setItems(slidesWithFeedback);

      const completion = calculateOverallCompletion(accessibleSlides);

      // Priority 1: If course is 100% completed AND the user hasn't explicitly
      // asked for a specific slide via URL. The !slideId gate matters because
      // this effect re-runs on every slideId change — without the gate, every
      // Next / Previous / sidebar click on a completed chapter would re-route
      // back to the first slide (or feedback), making the chapter feel locked.
      if (completion === 100 && !slideId) {
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
          // Check if the target slide is locked
          const slideIndex = accessibleSlides.findIndex(
            (s) => s.id === slideId
          );
          if (slideIndex !== -1) {
            // Build comprehensive prerequisite completions map
            const prerequisiteCompletions: Record<string, number> = {};

            // Add all chapters and their progress
            if (modulesWithChaptersData) {
              modulesWithChaptersData.forEach((module) => {
                module.chapters.forEach((chapter) => {
                  prerequisiteCompletions[chapter.id] = 0;
                });
              });
            }

            // Add all slides and their progress
            slides.forEach((slide: Slide) => {
              prerequisiteCompletions[slide.id] =
                slide.percentage_completed || 0;
            });

            // Calculate current chapter progress
            if (chapterId) {
              const chapterProgress = calculateOverallCompletion(slides);
              prerequisiteCompletions[chapterId] = chapterProgress;
            }

            const previousSlide =
              slideIndex > 0 ? accessibleSlides[slideIndex - 1] : null;
            const progressData: LearnerProgressData = {
              percentageCompleted: targetSlide.percentage_completed || 0,
              previousItemId: previousSlide?.id,
              previousItemCompletion: previousSlide?.percentage_completed || 0,
              itemIndex: slideIndex,
              prerequisiteCompletions,
            };

            // Check if this slide has its own drip condition (check both fields)
            let slideDripCondition = null;
            const dripConditionData =
              targetSlide.drip_condition || targetSlide.drip_condition_json;

            if (dripConditionData) {
              try {
                const parsed =
                  typeof dripConditionData === "string"
                    ? JSON.parse(dripConditionData)
                    : dripConditionData;

                // Handle array of conditions - filter for enabled slide conditions
                if (Array.isArray(parsed)) {
                  slideDripCondition =
                    parsed.find(
                      (cond) =>
                        (cond.target === "slide" || !cond.target) &&
                        cond.is_enabled !== false
                    ) || null;
                } else if (parsed && typeof parsed === "object") {
                  // Single condition - check if enabled and for slides
                  if (
                    (parsed.target === "slide" || !parsed.target) &&
                    parsed.is_enabled !== false
                  ) {
                    slideDripCondition = parsed;
                  }
                }
              } catch (e) {
                console.error("Failed to parse slide drip condition:", e);
              }
            }

            // Use slide-specific condition if available, otherwise fall back to package-level
            const conditionToUse = slideDripCondition || slideCondition;
            const hasCondition = !!slideDripCondition || !!slideCondition;

            // Check global flag first, then per-item condition's is_enabled flag
            const shouldEvaluate =
              isDrippingEnable &&
              hasCondition &&
              conditionToUse?.is_enabled !== false;

            const evaluation =
              shouldEvaluate && conditionToUse
                ? evaluateDripCondition(conditionToUse, progressData)
                : {
                  isLocked: false,
                  isHidden: false,
                  unlockMessage: null,
                };

            const locked = isItemLocked(evaluation);

            if (locked) {
              setActiveItem(slidesWithFeedback[0]);
              return;
            }
          }

          setActiveItem(targetSlide);
          return;
        }
      }

      // Priority 3: Default to first slide
      setActiveItem(slidesWithFeedback[0]);
    }
  }, [
    slides,
    slideId,
    setActiveItem,
    setItems,
    courseId,
    chapterId,
    slideCondition,
    setSlideEvaluations,
    isDrippingEnable,
    modulesWithChaptersData,
  ]);

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

  const [moduleName, setModuleName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [levelName, setLevelName] = useState("");
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string>("");
  const [homeIconClickRoute, setHomeIconClickRoute] = useState<string | null>(
    null
  );

  // Subjects for the breadcrumb picker. Reads from both known shapes of the
  // course payload (`level_with_details` from package-detail, `levelDetails`
  // from course-init) and falls back to `studyLibraryData` or the current
  // subject so the crumb always populates.
  const courseSubjects = useMemo<Array<{ id: string; subject_name: string; subject_order?: number | null }>>(() => {
    type BreadcrumbSubject = { id: string; subject_name: string; subject_order?: number | null };
    type LoosenedLevel = { id?: string; subjects?: BreadcrumbSubject[] };
    type LoosenedSession = { level_with_details?: LoosenedLevel[]; levelDetails?: LoosenedLevel[] };
    const sources: Array<{ sessions?: LoosenedSession[] } | null | undefined> = [
      courseInitData as { sessions?: LoosenedSession[] } | null | undefined,
      courseDetails as { sessions?: LoosenedSession[] } | null | undefined,
    ];
    for (const src of sources) {
      const sessions = src?.sessions;
      if (!sessions?.length) continue;
      for (const sess of sessions) {
        const levels = sess.level_with_details ?? sess.levelDetails ?? [];
        for (const level of levels) {
          // If levelId matches, return its subjects immediately
          if (levelId && level.id === levelId && level.subjects) {
            return level.subjects;
          }
          if (!levelId && level.subjects?.some((s) => s.id === subjectId)) {
            return level.subjects || [];
          }
        }
      }
      const firstSession = sessions[0];
      const firstLevelSubjects = (firstSession?.level_with_details ?? firstSession?.levelDetails ?? [])[0]?.subjects;
      if (firstLevelSubjects?.length) return firstLevelSubjects;
    }
    if (studyLibraryData?.length) {
      return studyLibraryData.map((s) => ({
        id: s.id,
        subject_name: s.subject_name,
        subject_order: s.subject_order,
      }));
    }
    if (subjectId && subjectName) {
      return [{ id: subjectId, subject_name: subjectName }];
    }
    return [];
  }, [courseInitData, courseDetails, subjectId, studyLibraryData, subjectName, levelId]);

  // Switch to a different subject: fetch that subject's modules/chapters
  // and drop the learner on the first chapter's slides view. If the target
  // subject has no content yet (or the fetch fails), route to the modules
  // landing as a graceful fallback so the learner still arrives at the
  // right place instead of a dead-end. `sessionId` from the URL is the
  // same value the API calls "packageSessionId".
  const [switchingSubjectId, setSwitchingSubjectId] = useState<string | null>(null);
  const handleSubjectSelect = useCallback(
    async (targetSubjectId: string) => {
      if (!targetSubjectId || targetSubjectId === subjectId) return;
      setSwitchingSubjectId(targetSubjectId);
      try {
        const pkgSessionId = resolvedSessionId;
        // Try authenticated fetch first; the public variant is a fallback
        // for unenrolled/public browsing contexts.
        let modules: ModulesWithChapters[] | null = null;
        try {
          modules = await fetchModulesWithChapters(targetSubjectId, pkgSessionId);
        } catch {
          modules = await fetchModulesWithChaptersPublic(targetSubjectId, pkgSessionId);
        }
        const firstModule = (modules || []).find((m) => (m.chapters || []).length > 0) || modules?.[0];
        const firstChapter = firstModule?.chapters?.[0];
        if (firstModule && firstChapter) {
          // Prime the store with the target subject's modules BEFORE
          // navigating so the module popover doesn't briefly show the
          // previous subject's list during the route transition.
          if (modules) setModulesWithChaptersData(modules);
          navigate({
            to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
            search: {
              courseId,
              subjectId: targetSubjectId,
              moduleId: firstModule.module.id,
              chapterId: firstChapter.id,
              slideId: "",
              sessionId,
            },
          });
          return;
        }
      } catch {
        toast.error("Couldn't open that subject. Please try again.");
      } finally {
        setSwitchingSubjectId(null);
      }
      navigate({
        to: "/study-library/courses/course-details/subjects/modules",
        search: { courseId, subjectId: targetSubjectId, moduleId: "" },
      });
    },
    [subjectId, sessionId, courseId, navigate, setModulesWithChaptersData]
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
    const nameFromStore = getSubjectName(subjectId, studyLibraryData);
    const nameFromCourse = courseSubjects.find((s) => s.id === subjectId)?.subject_name;
    setSubjectName(nameFromStore || nameFromCourse || "");
  }, [
    chapterId,
    moduleId,
    subjectId,
    modulesWithChaptersData,
    studyLibraryData,
    courseSubjects,
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
          let batches = institute.batches_for_sessions || [];

          // If no batches in cache, try fetching from API
          if ((!batches || batches.length === 0) && courseId) {
             try {
                const { fetchBatchesForCourse } = await import("@/services/courseBatches");
                batches = await fetchBatchesForCourse(courseId);
             } catch (e) {
                console.error("Failed to fetch batches dynamically", e);
             }
          }

          if (
            batches &&
            Array.isArray(batches)
          ) {
            // Try multiple matching strategies
            let matchingBatch = batches.find(
              (batch: BatchForSessionType) => batch.id === sessionId
            );

            if (!matchingBatch) {
              matchingBatch = batches.find(
                (batch: BatchForSessionType) =>
                  batch.package_dto?.id === courseId
              );
            }

            // If still no match, use the first available batch
            if (!matchingBatch && batches.length > 0) {
              matchingBatch = batches[0];
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
  // "breadcrumb" = legacy per-chapter slide list; cross-module navigation
  // happens via the popovers in the breadcrumb. This is the default to keep
  // existing learners on familiar terrain — admins can opt into the richer
  // "ancestors" tree from Student Display Settings.
  const [sidebarNavigation, setSidebarNavigation] = useState<
    "ancestors" | "breadcrumb"
  >("breadcrumb");

  // Load Student Display Settings for slides view
  useEffect(() => {
    getStudentDisplaySettings(false).then((s) => {
      setShowLearningPath(
        s?.courseDetails?.slidesView?.showLearningPath ?? true
      );
      setFeedbackVisible(s?.courseDetails?.slidesView?.feedbackVisible ?? true);
      setSidebarNavigation(
        s?.courseDetails?.slidesView?.sidebarNavigation ?? "breadcrumb"
      );
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

  const previousChapter = useMemo(() => {
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

    // Check previous in same module
    if (currentChapIndex - 1 >= 0) {
      return {
        module: currentMod.module,
        chapter: currentMod.chapters[currentChapIndex - 1],
      };
    }

    // Check last chapter of previous module
    if (currentModIndex - 1 >= 0) {
      const prevMod = modulesWithChaptersData[currentModIndex - 1];
      if (prevMod.chapters?.length > 0) {
        return {
          module: prevMod.module,
          chapter: prevMod.chapters[prevMod.chapters.length - 1],
        };
      }
    }

    return null;
  }, [modulesWithChaptersData, moduleId, chapterId]);

  const handlePreviousChapter = useCallback(() => {
    if (previousChapter) {
      navigate({
        to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
        search: {
          courseId,
          subjectId,
          moduleId: previousChapter.module.id,
          chapterId: previousChapter.chapter.id,
          slideId: "", // Default to first slide
          sessionId,
        },
      });
    }
  }, [previousChapter, navigate, courseId, subjectId, sessionId]);

  const SidebarComponent = (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* --- Header Section: Title & Breadcrumbs --- */}
      <div className="flex-none px-3 py-2.5 space-y-2 border-b border-gray-100 bg-white z-10">
        {/* Course Info Row */}
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 w-7 h-7 rounded-md border border-gray-150 bg-white flex items-center justify-center text-primary-600">
            {instituteLogoUrl ? (
              <img
                src={instituteLogoUrl}
                alt="Institute"
                onClick={
                  homeIconClickRoute ? handleInstituteLogoClick : undefined
                }
                className={`max-w-full max-h-full object-contain ${homeIconClickRoute ? "cursor-pointer" : ""
                  }`}
              />
            ) : (
              <GraduationCap size={16} weight="duotone" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-caption font-semibold text-gray-900 leading-tight truncate">
              {courseName ? toTitleCase(courseName) : `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Details`}
            </h3>
            <p className="text-caption text-gray-400 font-medium tracking-wide uppercase mt-0.5">
              {levelName && levelName.toLowerCase() !== "default"
                ? toTitleCase(levelName)
                : `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Material`}
            </p>
          </div>
        </div>

        {/* Breadcrumb: [Subject >] Module Switcher > Current Chapter.
            Subject crumb is only rendered when the course structure actually
            has subjects (`subjectId` set + studyLibraryData populated) —
            otherwise the crumb collapses to Module > Chapter as before. */}
        {showLearningPath && (() => {
          // Backends frequently emit a "Default"-named subject / module /
          // chapter as a placeholder when that level isn't really part of
          // the course. Those crumbs aren't useful navigation context — hide
          // them so the breadcrumb only shows real ancestors.
          const isDefaultName = (n: string | null | undefined) =>
            (n || "").trim().toLowerCase() === "default";
          const showSubjectCrumb =
            !!subjectId &&
            courseSubjects.length > 0 &&
            !isDefaultName(subjectName);
          const showModuleCrumb = !isDefaultName(moduleName);
          const showChapterCrumb = !isDefaultName(chapterName);
          return (
          <div
            className="flex items-center gap-1.5 text-xs text-gray-500 font-medium min-w-0"
            id="slides-breadcrumb-row"
          >
            {/* Subject — tapping opens a picker listing all subjects in the
                course. Selecting one routes to that subject's modules view
                (we don't know its first chapter yet, so we drop the learner
                at the modules list per HIG's "show the landing, don't guess"). */}
            {showSubjectCrumb && (
              <>
                {sidebarNavigation === "breadcrumb" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-0.5 min-w-0 shrink hover:text-primary-600 transition-colors group"
                        title={subjectName || getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}
                      >
                        <span className="truncate max-w-24 sm:max-w-32">
                          {toTitleCase(subjectName || getTerminology(ContentTerms.Subjects, SystemTerms.Subjects))}
                        </span>
                        <ChevronDownIcon className="w-3 h-3 flex-shrink-0 text-gray-400 group-hover:text-primary-400 transition-colors" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-64 p-0 shadow-md border border-gray-200 rounded-lg overflow-hidden"
                      align="start"
                      sideOffset={6}
                    >
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/80">
                        <p className="text-caption font-bold text-gray-500 uppercase tracking-wider">
                          {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}s
                        </p>
                      </div>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        {courseSubjects.map((s) => {
                          const isCurrent = s.id === subjectId;
                          const isSwitching = switchingSubjectId === s.id;
                          return (
                            <button
                              key={s.id}
                              disabled={!!switchingSubjectId && !isSwitching}
                              onClick={() => handleSubjectSelect(s.id)}
                              className={`w-full text-left px-3 py-2 text-caption transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                                isCurrent
                                  ? "bg-primary-50 text-primary-700 font-semibold"
                                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  isCurrent ? "bg-primary-500" : "bg-gray-300"
                                }`}
                              />
                              <span className="truncate flex-1">
                                {toTitleCase(s.subject_name)}
                              </span>
                              {isSwitching ? (
                                <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              ) : isCurrent ? (
                                <span className="text-caption font-bold text-primary-500 uppercase tracking-wide flex-shrink-0">
                                  Now
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  // Tree mode: crumb is a passive label; the sidebar tree
                  // already exposes every cross-subject jump.
                  <span
                    className="truncate max-w-24 sm:max-w-32"
                    title={subjectName || getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}
                  >
                    {toTitleCase(subjectName || getTerminology(ContentTerms.Subjects, SystemTerms.Subjects))}
                  </span>
                )}

                {(showModuleCrumb || showChapterCrumb) && (
                  <ChevronRightIcon className="w-3 h-3 text-gray-300 flex-shrink-0" />
                )}
              </>
            )}

            {/* Module — in breadcrumb mode this is a popover that lists all
                modules (tap to jump). In tree mode we drop the popover since
                the sidebar already shows the full module list; crumb becomes
                a passive label. */}
            {showModuleCrumb && (
              <>
                {sidebarNavigation === "breadcrumb" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-0.5 min-w-0 shrink hover:text-primary-600 transition-colors group"
                        title={moduleName || getTerminology(ContentTerms.Modules, SystemTerms.Modules)}
                      >
                        <span className="truncate max-w-24 sm:max-w-32">
                          {toTitleCase(moduleName || getTerminology(ContentTerms.Modules, SystemTerms.Modules))}
                        </span>
                        <ChevronDownIcon className="w-3 h-3 flex-shrink-0 text-gray-400 group-hover:text-primary-400 transition-colors" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-72 p-0 shadow-md border border-gray-200 rounded-lg overflow-hidden"
                      align="start"
                      sideOffset={6}
                    >
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/80">
                        <p className="text-caption font-bold text-gray-500 uppercase tracking-wider">
                          {subjectName && !isDefaultName(subjectName)
                            ? `${toTitleCase(subjectName)} · ${getTerminology(ContentTerms.Modules, SystemTerms.Modules)}s`
                            : `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Content`}
                        </p>
                      </div>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        {modulesWithChaptersData?.map((modData) => (
                          <ModuleAccordionItem
                            key={modData.module.id}
                            modData={modData}
                            isInitiallyExpanded={modData.module.id === moduleId}
                            currentChapterId={chapterId}
                            onChapterSelect={(targetModuleId, targetChapterId) => {
                              navigate({
                                to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
                                search: {
                                  courseId,
                                  subjectId,
                                  moduleId: targetModuleId,
                                  chapterId: targetChapterId,
                                  slideId: "",
                                  sessionId,
                                },
                              });
                            }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span
                    className="truncate max-w-24 sm:max-w-32"
                    title={moduleName || getTerminology(ContentTerms.Modules, SystemTerms.Modules)}
                  >
                    {toTitleCase(moduleName || getTerminology(ContentTerms.Modules, SystemTerms.Modules))}
                  </span>
                )}

                {showChapterCrumb && (
                  <ChevronRightIcon className="w-3 h-3 text-gray-300 flex-shrink-0" />
                )}
              </>
            )}

            {/* Chapter — current location; per HIG the active crumb is a label,
                not a link. The native `title` attribute provides the full name
                on hover without requiring an extra tooltip component. */}
            {showChapterCrumb && (
              <span
                className="text-gray-900 font-semibold truncate"
                title={chapterName || getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)}
              >
                {toTitleCase(chapterName || getTerminology(ContentTerms.Chapters, SystemTerms.Chapters))}
              </span>
            )}
          </div>
          );
        })()}
      </div>

      {/* --- Scrollable Content ---
          Admin-chosen via Student Display Settings → courseDetails.slidesView.
          • "ancestors" renders the full Subject → Module → Chapter → Slide
            tree so learners can jump anywhere from the sidebar.
          • "breadcrumb" renders the legacy per-chapter flat slide list;
            cross-module navigation happens via the breadcrumb popovers. */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {sidebarNavigation === "ancestors" ? (
          <div className="py-1">
            <CourseTreeSidebar
              courseId={courseId || ""}
              sessionId={resolvedSessionId}
              subjects={courseSubjects}
              currentSubjectId={subjectId || ""}
              currentModuleId={moduleId || ""}
              currentChapterId={chapterId || ""}
              currentSlideId={slideId || ""}
              currentSubjectModules={modulesWithChaptersData}
              onSlideSelect={({ subjectId: targetSubjectId, moduleId: targetModuleId, chapterId: targetChapterId, slideId: targetSlideId }) => {
                navigate({
                  to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
                  search: {
                    courseId,
                    subjectId: targetSubjectId,
                    moduleId: targetModuleId,
                    chapterId: targetChapterId,
                    slideId: targetSlideId,
                    sessionId,
                  },
                });
              }}
            />
          </div>
        ) : (
          <div className="p-2">
            <ChapterSidebarSlides />
          </div>
        )}
      </div>

      {/* --- Footer: Progress & Actions ---
          Prev / Up-next collapsed to single-line pills so the tree above
          gets the screen real estate. The full chapter name still appears
          inline (truncated with a native tooltip) so the learner doesn't
          lose the context the larger cards used to provide. */}
      {slides && slides.length > 0 && (
        <div className="flex-none px-3 py-2 border-t border-gray-100 bg-white space-y-1.5 z-10">
          {previousChapter && (
            <button
              onClick={handlePreviousChapter}
              title={`Previous: ${toTitleCase(previousChapter.chapter.chapter_name)}`}
              className="w-full flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 hover:bg-neutral-100 hover:border-neutral-300 transition-colors group/prev text-left [.ui-play_&]:rounded-lg [.ui-play_&]:border-2"
            >
              <CaretLeft
                size={12}
                className="text-neutral-500 shrink-0 transition-transform group-hover/prev:-translate-x-0.5"
                weight="bold"
              />
              <span className="text-caption font-bold text-neutral-500 uppercase tracking-wider shrink-0">
                Prev
              </span>
              <span className="text-caption font-semibold text-neutral-700 truncate leading-tight min-w-0">
                {toTitleCase(previousChapter.chapter.chapter_name)}
              </span>
            </button>
          )}

          {nextChapter && (
            <button
              onClick={handleNextChapter}
              title={`Up next: ${toTitleCase(nextChapter.chapter.chapter_name)}`}
              className="w-full flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-2 py-1.5 hover:bg-primary-100 hover:border-primary-300 transition-colors group/next text-left [.ui-play_&]:rounded-lg [.ui-play_&]:border-2"
            >
              <span className="text-caption font-bold text-primary-500 uppercase tracking-wider shrink-0">
                Up next
              </span>
              <span className="text-caption font-bold text-primary-700 truncate leading-tight min-w-0 flex-1">
                {toTitleCase(nextChapter.chapter.chapter_name)}
              </span>
              <CaretRight
                size={12}
                className="text-primary-500 shrink-0 transition-transform group-hover/next:translate-x-0.5"
                weight="bold"
              />
            </button>
          )}

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-caption font-semibold text-gray-500 uppercase tracking-wider [.ui-play_&]:font-black [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide">
              <span>Progress</span>
              <span className="text-gray-800 text-xs normal-case tracking-normal [.ui-play_&]:font-black">
                {Math.min(calculateOverallCompletion(slides), 100)}%
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden [.ui-play_&]:rounded-full [.ui-play_&]:h-3">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out [.ui-play_&]:rounded-full [.ui-play_&]:h-3"
                style={{
                  width: `${Math.min(
                    calculateOverallCompletion(slides),
                    100
                  )}%`,
                }}
              />
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
                w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-caption font-medium
                transition-all duration-150
                ${activeItem?.id === "feedback-slide"
                  ? "bg-primary-50 text-primary-700 border border-primary-200"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }
              `}
            >
              <PencilSimple className="w-3 h-3" />
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
          <div className="p-0.5 sm:p-1 bg-primary-50 rounded-lg flex-shrink-0 flex items-center justify-center min-w-8 min-h-8 sm:min-w-10 sm:min-h-10">
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
                        toTitleCase(chapterName || `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Details`),
                        25
                      )}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-vw-90 max-w-sm p-2"
                  sideOffset={6}
                  align="start"
                >
                  <div className="space-y-2">
                    <div className="text-caption font-semibold text-gray-500 uppercase tracking-wide">
                      Learning Path
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <button
                        className="px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 truncate"
                        onClick={handleSubjectRoute}
                      >
                        {toTitleCase(subjectName || getTerminology(ContentTerms.Subjects, SystemTerms.Subjects))}
                      </button>
                      <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                      <button
                        className="px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 truncate"
                        onClick={handleModuleRoute}
                      >
                        {toTitleCase(moduleName || getTerminology(ContentTerms.Modules, SystemTerms.Modules))}
                      </button>
                      <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                      <span className="px-2 py-1 rounded-md bg-primary-50 text-primary-700 font-semibold truncate">
                        {toTitleCase(chapterName || getTerminology(ContentTerms.Chapters, SystemTerms.Chapters))}
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
                  : `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Details`}
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
      className="md:my-0 md:mx-2 lg:mx-3"
    >
      <InitStudyLibraryProvider>
        <ModulesWithChaptersProvider
          subjectId={subjectId}
          packageSessionId={resolvedSessionId || undefined}
        >
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
