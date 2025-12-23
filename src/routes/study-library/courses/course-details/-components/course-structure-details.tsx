import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { PullToRefreshWrapper } from "@/components/design-system/pull-to-refresh";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toTitleCase } from "@/lib/utils";
import { useDripConditions } from "@/hooks/use-drip-conditions";
import { LockedBadge } from "@/components/drip-conditions";
import { useDripConditionStore } from "@/stores/study-library/drip-conditions-store";
import { evaluateDripCondition } from "@/utils/drip-conditions";
import type {
  LearnerProgressData,
  DripConditionEvaluation,
} from "@/utils/drip-conditions";
import {
  isItemLocked,
  shouldFilterItem,
} from "@/components/drip-conditions/helpers";
import {
  CaretDown,
  CaretRight,
  Folder,
  FileText,
  PresentationChart,
  FolderOpen,
} from "@phosphor-icons/react";
import { Steps } from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  fetchModulesWithChapters,
  fetchModulesWithChaptersPublic,
} from "@/services/study-library/getModulesWithChapters";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSlidesByChapterId,
  Slide,
} from "@/hooks/study-library/use-slides";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TabType,
  tabs,
} from "@/components/common/study-library/level-material/subject-material/-constants/constant";
import {
  getIcon,
  getSlideTypeDisplay,
} from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { CourseDetailsFormValues } from "./course-details-schema";
import { getSubjectDetails } from "@/routes/courses/course-details/-utils/helper";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { useRouter } from "@tanstack/react-router";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { Preferences } from "@capacitor/preferences";
// import { CODE_CIRCLE_INSTITUTE_ID } from "@/constants/urls";
// import { getInstituteId } from "@/constants/urls";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { DonationDialog } from "@/components/common/donation/DonationDialog";
import { useEnrollmentStatus } from "@/hooks/use-enrollment-status";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import type { StudentCourseDetailsTabId } from "@/types/student-display-settings";
import { PackageSessionMessages } from "@/components/announcements";
import {
  calculateOverallCompletion,
  getStatusDetails,
} from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";

export interface Chapter {
  id: string;
  chapter_name: string;
  status: string;
  description: string;
  file_id: string | null;
  chapter_order: number;
  drip_condition_json?: string | null;
  drip_condition?: string | null; // JSON string from API
}
export interface ChapterMetadata {
  chapter: Chapter;
  slides_count: {
    video_count: number;
    pdf_count: number;
    doc_count: number;
    unknown_count: number;
  };
  chapter_in_package_sessions: string[];
}
export interface Module {
  id: string;
  module_name: string;
  status: string;
  description: string;
  thumbnail_id: string;
}
export interface ModuleWithChapters {
  module: Module;
  chapters: Chapter[];
}
export type SubjectModulesMap = { [subjectId: string]: ModuleWithChapters[] };

export const CourseStructureDetails = ({
  selectedSession,
  selectedLevel,
  courseStructure,
  courseData,
  packageSessionId,
  selectedTab,
  isEnrolledInCourse,
  onLoadingChange,
  updateModuleStats,
  paymentType,
  dripConditionJson,
}: {
  selectedSession: string;
  selectedLevel: string;
  courseStructure: number;
  courseData: CourseDetailsFormValues;
  packageSessionId: string;
  selectedTab: string;
  isEnrolledInCourse?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  updateModuleStats?: (
    modulesData: Record<string, Array<{ chapters?: Array<unknown> }>>
  ) => void;
  paymentType?: string | null;
  dripConditionJson?: string | null;
}) => {
  const router = useRouter();
  const searchParams = router.state.location.search;
  const navigateTo = (
    pathname: string,
    searchParamsObj: Record<string, string | undefined>
  ) => router.navigate({ to: pathname, search: searchParamsObj });
  const { setNavHeading } = useNavHeadingStore();

  const [studyLibraryData, setStudyLibraryData] = useState<SubjectType[]>([]);
  const [showContentPrefixes, setShowContentPrefixes] = useState<boolean>(true);
  // Helper: format video duration from millis to h:mm:ss or m:ss
  const formatDuration = useCallback((millis?: number | null): string => {
    if (!millis || millis <= 0) return "";
    const totalSeconds = Math.round(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }, []);

  // Helper: compute short meta text for a slide
  const getSlideMetaText = useCallback(
    (slide: Slide): string => {
      // Prefer document/video/question/assignment specifics
      if (slide.document_slide) {
        const pages: number | undefined =
          (slide.document_slide as { published_document_total_pages?: number })
            .published_document_total_pages ?? slide.document_slide.total_pages;
        if (typeof pages === "number" && pages > 0) return `${pages} pages`;
      }
      if (slide.video_slide) {
        const ms: number | undefined =
          (slide.video_slide as { published_video_length_in_millis?: number })
            .published_video_length_in_millis ??
          slide.video_slide.video_length_in_millis;
        const text = formatDuration(ms);
        if (text) return text + " mins";
      }
      if (slide.question_slide) {
        const qType = slide.question_slide.question_type;
        if (qType) return qType;
      }
      if (slide.assignment_slide) {
        const end = slide.assignment_slide.end_date;
        if (end) return `Due ${end}`;
      }
      return "";
    },
    [formatDuration]
  );

  // Helper: neutral badge classes for slide type with inverted text (professional look)
  const getTypeBadgeClasses = (slide: Slide): string => {
    // All types use neutral tones for subdued UI; you can reintroduce brand hues if needed
    if (slide.video_slide) return "bg-neutral-700 text-white";
    if (slide.document_slide) return "bg-neutral-700 text-white";
    if (slide.question_slide) return "bg-neutral-700 text-white";
    if (slide.assignment_slide) return "bg-neutral-700 text-white";
    return "bg-neutral-600 text-white";
  };

  // (unused) Helper retained for potential future UI badges
  // const getChapterProgressStatus = (chapterId: string) => {
  //     const progress = calculateChapterProgress(chapterId);
  //     if (progress === 0) return { status: 'not-started', color: 'text-neutral-400', bgColor: 'bg-neutral-100' };
  //     if (progress >= 80) return { status: 'completed', color: 'text-green-600', bgColor: 'bg-green-100' };
  //     return { status: 'in-progress', color: 'text-primary-600', bgColor: 'bg-primary-100' };
  // };

  // Helper: calculate module progress from chapters
  const calculateModuleProgress = (moduleChapters: Chapter[]): number => {
    if (!moduleChapters || moduleChapters.length === 0) return 0;

    const totalProgress = moduleChapters.reduce((sum, chapter) => {
      return sum + calculateChapterProgress(chapter.id);
    }, 0);

    return Math.round(totalProgress / moduleChapters.length);
  };

  // const getModuleProgressStatus = (moduleChapters: Chapter[]) => {
  //     const progress = calculateModuleProgress(moduleChapters);
  //     if (progress === 0) return { status: 'not-started', color: 'text-neutral-400', bgColor: 'bg-neutral-100' };
  //     if (progress >= 80) return { status: 'completed', color: 'text-green-600', bgColor: 'bg-green-100' };
  //     return { status: 'in-progress', color: 'text-primary-600', bgColor: 'bg-primary-100' };
  // };

  // Helper: render progress bar
  const renderProgressBar = (percentage: number, size: "sm" | "md" = "sm") => {
    const height = size === "sm" ? "h-1" : "h-2";
    const radius = size === "sm" ? "rounded-full" : "rounded";

    return (
      <div
        className={`w-full ${height} bg-neutral-200 ${radius} overflow-hidden`}
      >
        <div
          className={`${height} bg-primary-600 ${radius} transition-all duration-300 ease-in-out`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    );
  };

  // Helper: render completion badge
  const renderCompletionBadge = (percentage: number) => {
    if (percentage === 0) return null;

    const isCompleted = percentage >= 80;
    const bgColor = isCompleted ? "bg-green-100" : "bg-primary-100";
    const textColor = isCompleted ? "text-green-700" : "text-primary-700";
    const icon = isCompleted ? "✓" : `${Math.round(percentage)}%`;

    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}
      >
        {icon}
      </span>
    );
  };
  // (removed) renderSlideSkeletonRow - unused helper

  type LocalTab = { label: string; value: string };
  const [filteredTabs, setFilteredTabs] = useState<LocalTab[]>([]);

  const [selectedStructureTab, setSelectedStructureTab] = useState<string>(
    TabType.OUTLINE
  );
  // const [showCourseDiscussion, setShowCourseDiscussion] = useState(false);
  const handleTabChange = (value: string) => setSelectedStructureTab(value);
  // Enforce Course Details tabs (visibility/order/default) from settings
  useEffect(() => {
    const mapSettingIdToValue = (
      id: StudentCourseDetailsTabId
    ): (typeof TabType)[keyof typeof TabType] => {
      switch (id) {
        case "OUTLINE":
          return TabType.OUTLINE;
        case "CONTENT_STRUCTURE":
          return TabType.CONTENT_STRUCTURE;
        case "TEACHERS":
          return TabType.TEACHERS;
        case "ASSESSMENTS":
          return TabType.ASSESSMENT;
        default:
          return TabType.OUTLINE;
      }
    };

    getStudentDisplaySettings(false).then((settings) => {
      const tabsSetting = settings?.courseDetails?.tabs || [];
      const ordered = tabsSetting
        .filter((t) => t.visible !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((t) => ({
          label:
            t.label ||
            tabs.find((x) => x.value === mapSettingIdToValue(t.id))?.label ||
            t.id,
          value: mapSettingIdToValue(t.id),
        }));

      // Check if course discussion should be shown based on student display settings
      const shouldShowCourseDiscussion =
        settings?.notifications?.allowBatchStream === true;
      // setShowCourseDiscussion(shouldShowCourseDiscussion);

      // Fallback: ensure CONTENT_STRUCTURE appears if visible in settings but mapping missed
      const hasContentStructureSetting = tabsSetting.some(
        (t) => t.id === "CONTENT_STRUCTURE" && t.visible !== false
      );
      const hasContentStructureMapped = ordered.some(
        (t) => t.value === TabType.CONTENT_STRUCTURE
      );
      const finalTabs = [...ordered];
      if (hasContentStructureSetting && !hasContentStructureMapped) {
        finalTabs.push({
          label: "Content Structure",
          value: TabType.CONTENT_STRUCTURE,
        });
      }

      // Add course discussion tab if enabled
      if (shouldShowCourseDiscussion) {
        finalTabs.push({
          label: "Course Discussion",
          value: TabType.COURSE_DISCUSSION,
        });
      }

      if (finalTabs.length) setFilteredTabs(finalTabs as typeof tabs);

      // New: respect content prefix visibility
      const resolvedShowPrefixes =
        settings?.courseDetails?.showCourseContentPrefixes !== false;

      setShowContentPrefixes(resolvedShowPrefixes);

      const defaultTabId = settings?.courseDetails?.defaultTab || "OUTLINE";
      const defaultValue = mapSettingIdToValue(defaultTabId);
      const isDefaultVisible = ordered.some((t) => t.value === defaultValue);
      const firstVisible = (ordered[0]?.value as string) || TabType.OUTLINE;
      const resolvedDefault = isDefaultVisible
        ? (defaultValue as string)
        : firstVisible;

      setSelectedStructureTab(resolvedDefault);
    });
  }, []);

  const renderTabs = useMemo(() => {
    const priorityOrder = [
      TabType.OUTLINE,
      TabType.CONTENT_STRUCTURE,
      TabType.COURSE_DISCUSSION,
    ];
    const byValue = new Map(filteredTabs.map((t) => [t.value, t]));
    const prioritized = priorityOrder
      .filter((v) => byValue.has(v))
      .map((v) => byValue.get(v)!) as { label: string; value: string }[];
    const rest = filteredTabs.filter(
      (t) => !priorityOrder.includes(t.value as TabType)
    );
    const finalArr = [...prioritized, ...rest];

    return finalArr;
  }, [filteredTabs]);
  const [subjectModulesMap, setSubjectModulesMap] = useState<SubjectModulesMap>(
    {}
  );
  const [slidesMap, setSlidesMap] = useState<Record<string, Slide[]>>({});
  const [slidesLoadingStatus, setSlidesLoadingStatus] = useState<
    Record<string, "idle" | "loading" | "loaded" | "error">
  >({});
  const [isModulesLoading, setIsModulesLoading] = useState<boolean>(false);

  // Helper: calculate chapter progress from slides
  const calculateChapterProgress = useCallback(
    (chapterId: string): number => {
      const slides = slidesMap[chapterId] || [];
      return calculateOverallCompletion(slides);
    },
    [slidesMap]
  );

  // Get drip condition from store as fallback if not provided via props
  const getDripCondition = useDripConditionStore(
    (state) => state.getDripCondition
  );
  const isDrippingEnable = useDripConditionStore(
    (state) => state.isDrippingEnable
  );
  const effectiveDripConditionJson =
    dripConditionJson ||
    (searchParams.courseId ? getDripCondition(searchParams.courseId) : null);

  const { condition: chapterCondition, hasConditions: hasChapterConditions } =
    useDripConditions(effectiveDripConditionJson, "chapter");
  const { condition: slideCondition, hasConditions: hasSlideConditions } =
    useDripConditions(effectiveDripConditionJson, "slide");

  // Drill-down state for Content Structure tab
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null
  );
  const [thumbUrlById, setThumbUrlById] = useState<Record<string, string>>({});

  // Donation dialog state
  const [donationDialogOpen, setDonationDialogOpen] = useState(false);
  const [targetSlideDetails, setTargetSlideDetails] = useState<{
    courseId: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
  } | null>(null);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string>("");

  // Use enrollment status hook
  const { userHasDonated } = useEnrollmentStatus(instituteId);

  // Log enrollment status changes
  useEffect(() => {}, [instituteId, userHasDonated, isEnrolledInCourse]);
  // const [thumbUrlById, setThumbUrlById] = useState<Record<string, string>>({});

  // Evaluate drip conditions for chapters
  const chapterEvaluations = useMemo(() => {
    // Build progress data for all chapters
    const allChapters = Object.values(subjectModulesMap)
      .flatMap((modules) => modules)
      .flatMap((mod) => mod.chapters);

    // Build prerequisite completions map for chapters
    const prerequisiteCompletions: Record<string, number> = {};
    allChapters.forEach((chapter) => {
      const progress = calculateChapterProgress(chapter.id);
      prerequisiteCompletions[chapter.id] = progress;
    });

    const progressDataByChapterId: Record<string, LearnerProgressData> = {};
    allChapters.forEach((chapter, index) => {
      const previousChapter = index > 0 ? allChapters[index - 1] : null;
      const progress = calculateChapterProgress(chapter.id);
      progressDataByChapterId[chapter.id] = {
        percentageCompleted: progress,
        previousItemId: previousChapter?.id,
        previousItemCompletion: previousChapter
          ? calculateChapterProgress(previousChapter.id)
          : 0,
        itemIndex: index, // Add index for count-based exception logic
        prerequisiteCompletions, // Add prerequisite completions map
      };
    });

    // Evaluate drip conditions - check per-chapter conditions first
    const evaluations: Record<string, DripConditionEvaluation> = {};

    for (const chapter of allChapters) {
      const progressData = progressDataByChapterId[chapter.id];

      // Check if this chapter has its own drip condition (check both fields)
      let chapterDripCondition = null;
      const dripConditionData = chapter.drip_condition;

      if (dripConditionData) {
        try {
          const parsed =
            typeof dripConditionData === "string"
              ? JSON.parse(dripConditionData)
              : dripConditionData;

          // Handle array of conditions - filter for enabled chapter conditions
          if (Array.isArray(parsed)) {
            chapterDripCondition =
              parsed.find(
                (cond) =>
                  (cond.target === "chapter" || !cond.target) &&
                  cond.is_enabled !== false
              ) || null;
          } else if (parsed && typeof parsed === "object") {
            // Single condition - check if enabled and for chapters
            if (
              (parsed.target === "chapter" || !parsed.target) &&
              parsed.is_enabled !== false
            ) {
              chapterDripCondition = parsed;
            }
          }
        } catch (e) {
          console.error("Failed to parse chapter drip condition:", e);
        }
      }

      // Use chapter-specific condition if available, otherwise fall back to package-level
      const conditionToUse = chapterDripCondition || chapterCondition;
      const hasCondition = !!chapterDripCondition || hasChapterConditions;

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
      evaluations[chapter.id] = evaluation;
    }
    return evaluations;
  }, [
    hasChapterConditions,
    chapterCondition,
    subjectModulesMap,
    calculateChapterProgress,
    isDrippingEnable,
  ]);

  // Evaluate drip conditions for slides
  const slideEvaluations = useMemo(() => {
    const evaluations: Record<string, DripConditionEvaluation> = {};

    // Build comprehensive prerequisite completions map with BOTH chapters and slides
    const prerequisiteCompletions: Record<string, number> = {};

    // 1. Add all chapters and their progress
    const allChapters = Object.values(subjectModulesMap)
      .flatMap((modules) => modules)
      .flatMap((mod) => mod.chapters);

    allChapters.forEach((chapter) => {
      const progress = calculateChapterProgress(chapter.id);
      prerequisiteCompletions[chapter.id] = progress;
    });

    // 2. Add all slides and their progress
    for (const slides of Object.values(slidesMap)) {
      slides.forEach((slide) => {
        prerequisiteCompletions[slide.id] = slide.percentage_completed || 0;
      });
    }

    for (const slides of Object.values(slidesMap)) {
      slides.forEach((slide, index) => {
        const previousSlide = index > 0 ? slides[index - 1] : null;
        const progressData: LearnerProgressData = {
          percentageCompleted: slide.percentage_completed || 0,
          previousItemId: previousSlide?.id,
          previousItemCompletion: previousSlide?.percentage_completed || 0,
          itemIndex: index, // Add index for count-based exception logic
          prerequisiteCompletions, // Add prerequisite completions map
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
        const hasCondition = !!slideDripCondition || hasSlideConditions;

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

        evaluations[slide.id] = evaluation;
      });
    }
    return evaluations;
  }, [
    hasSlideConditions,
    slideCondition,
    slidesMap,
    isDrippingEnable,
    subjectModulesMap,
    calculateChapterProgress,
  ]);

  // Helpers to safely extract optional thumbnail IDs without using any
  const getSubjectThumbnailId = (subject: SubjectType): string | undefined => {
    return (
      (subject as unknown as { thumbnail_id?: string | null }).thumbnail_id ||
      undefined
    );
  };
  const getModuleThumbnailId = (mod: Module): string | undefined => {
    return (
      (mod as unknown as { thumbnail_id?: string | null }).thumbnail_id ||
      undefined
    );
  };

  // Fetch institute ID and auth token
  useEffect(() => {
    const fetchInstituteAndAuth = async () => {
      try {
        // Get institute ID from preferences
        const instituteResult = await Preferences.get({ key: "InstituteId" });
        setInstituteId(instituteResult.value || null);

        // Get auth token
        const token = await getTokenFromStorage(TokenKey.accessToken);
        setAuthToken(token || "");
      } catch {
        // Silent error handling
      }
    };

    fetchInstituteAndAuth();
  }, []);

  // Ensure subject thumbnails are fetched for Content Structure top level
  useEffect(() => {
    const prefetchTopLevelSubjects = async () => {
      if (selectedSubjectId) return; // already drilled down
      const subjects = studyLibraryData ?? [];
      if (subjects.length === 0) return;

      const pending = subjects
        .map((s) => ({
          key: `subject:${s.id}`,
          fileId: getSubjectThumbnailId(s),
        }))
        .filter(
          ({ key, fileId }) => Boolean(fileId) && !thumbUrlById[key]
        ) as Array<{ key: string; fileId: string }>;
      if (pending.length === 0) return;

      const results = await Promise.all(
        pending.map(async ({ key, fileId }) => {
          try {
            const url = await getPublicUrlWithoutLogin(fileId);
            return { key, url } as const;
          } catch {
            return { key, url: "" } as const;
          }
        })
      );
      const updates: Record<string, string> = {};
      for (const { key, url } of results) if (url) updates[key] = url;
      if (Object.keys(updates).length > 0)
        setThumbUrlById((prev) => ({ ...prev, ...updates }));
    };
    prefetchTopLevelSubjects();
  }, [selectedSubjectId, studyLibraryData, thumbUrlById]);

  const handleSlideNavigation = async (
    subjectId: string,
    moduleId: string,
    chapterId: string,
    slideId: string
  ) => {
    // Allow navigation if user is enrolled in the course OR if it's PROGRESS/COMPLETED tabs
    if (
      isEnrolledInCourse ||
      selectedTab === "PROGRESS" ||
      selectedTab === "COMPLETED"
    ) {
      // Default behavior: Direct navigation for enrolled users
      // Only show donation dialog if payment type is specifically "DONATION"
      if (
        paymentType &&
        paymentType.toLowerCase() === "donation" &&
        isEnrolledInCourse
      ) {
        // For donation type, check donation status
        if (userHasDonated === false) {
          // Show donation dialog for slide access
          setTargetSlideDetails({
            courseId: searchParams.courseId || "",
            subjectId,
            moduleId,
            chapterId,
            slideId,
          });
          setDonationDialogOpen(true);
          return;
        }
      }

      // Default: Navigate directly to slide (for all non-donation types or when payment type is not loaded)

      navigateTo(
        `/study-library/courses/course-details/subjects/modules/chapters/slides`,
        {
          courseId: searchParams.courseId,
          subjectId,
          moduleId,
          chapterId,
          slideId,
          sessionId: packageSessionId || "",
        }
      );
    }
    // For ALL tab when not enrolled, do nothing (view-only mode)
  };

  // Helper function to determine if slides should be clickable
  const isSlideClickable = () => {
    // If user is enrolled, slides are clickable in ALL tabs
    // If not enrolled, slides are only clickable in PROGRESS/COMPLETED tabs
    return (
      isEnrolledInCourse ||
      selectedTab === "PROGRESS" ||
      selectedTab === "COMPLETED"
    );
  };

  // Helper function to get slide styling based on clickability
  const getSlideStyling = (textSize: "xs" | "sm" = "xs") => {
    const sizeClass = textSize === "sm" ? "text-sm" : "text-xs";
    if (isSlideClickable()) {
      return `group flex cursor-pointer items-center gap-1.5 px-2 py-1 ${sizeClass} text-neutral-500 rounded hover:bg-amber-50/60 hover:border-amber-200/40 border border-transparent transition-all duration-200`;
    } else {
      return `group flex items-center gap-1.5 px-2 py-1 ${sizeClass} text-neutral-400 rounded bg-neutral-50/50 border border-transparent`;
    }
  };

  // Track in-flight requests to prevent duplicate API calls
  const slidesRequestsRef = useRef<Set<string>>(new Set());

  const getSlidesWithChapterId = useCallback(async (chapterId: string) => {
    // Check if already loaded or currently loading
    setSlidesLoadingStatus((prevStatus) => {
      if (
        prevStatus[chapterId] === "loaded" ||
        prevStatus[chapterId] === "loading"
      ) {
        return prevStatus; // Already handled
      }
      return { ...prevStatus, [chapterId]: "loading" };
    });

    // Prevent duplicate concurrent requests
    if (slidesRequestsRef.current.has(chapterId)) {
      return;
    }

    slidesRequestsRef.current.add(chapterId);

    try {
      const slides = await fetchSlidesByChapterId(chapterId);
      setSlidesMap((prev) => ({ ...prev, [chapterId]: slides }));
      setSlidesLoadingStatus((prev) => ({ ...prev, [chapterId]: "loaded" }));
    } catch {
      setSlidesLoadingStatus((prev) => ({ ...prev, [chapterId]: "error" }));
    } finally {
      slidesRequestsRef.current.delete(chapterId);
    }
  }, []);

  const useModulesMutation = () => {
    return useMutation({
      mutationFn: async ({
        subjects: currentSubjects,
      }: {
        subjects: SubjectType[];
      }) => {
        // Ensure packageSessionId is available for all course depths
        if (!packageSessionId) {
          throw new Error(
            "Package session ID is required for fetching modules"
          );
        }

        const results = await Promise.all(
          currentSubjects?.map(async (subject) => {
            // For depth 5 courses, try using the public endpoint first
            let res;

            res = await fetchModulesWithChapters(subject.id, packageSessionId);
            // Fallback: if private returns empty, try public once (for ALL tab/unenrolled visibility)
            if (Array.isArray(res) && res.length === 0) {
              try {
                const alt = await fetchModulesWithChaptersPublic(
                  subject.id,
                  packageSessionId
                );
                if (Array.isArray(alt) && alt.length > 0) {
                  res = alt;
                }
              } catch {
                // ignore
              }
            }

            return { subjectId: subject.id, modules: res };
          })
        );

        const modulesMap: SubjectModulesMap = {};
        results.forEach(({ subjectId, modules }) => {
          modulesMap[subjectId] = modules;
        });

        return modulesMap;
      },
    });
  };

  const { mutateAsync: fetchModules } = useModulesMutation();

  // Memoized callback for loading state changes
  const handleLoadingChange = useCallback(
    (loading: boolean) => {
      if (onLoadingChange) {
        onLoadingChange(loading);
      }
    },
    [onLoadingChange]
  );

  const refreshData = async () => {
    if (!packageSessionId) {
      return;
    }
    // Refresh by reloading modules
    try {
      setIsModulesLoading(true);
      const modulesMap = await fetchModules({
        subjects: getSubjectDetails(courseData, selectedSession, selectedLevel),
      });
      setSubjectModulesMap(modulesMap);

      // Update module stats for parent component
      if (updateModuleStats) {
        updateModuleStats(modulesMap);
      }
    } catch {
      // Silent error handling
    } finally {
      setIsModulesLoading(false);
    }
  };

  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyIncomplete, setOnlyIncomplete] = useState<boolean>(false);

  const filterSlides = useCallback(
    (slides: Slide[]): Slide[] => {
      const q = searchQuery.trim().toLowerCase();
      return (slides || []).filter((sl) => {
        if (onlyIncomplete && (sl.percentage_completed || 0) >= 80)
          return false;
        if (!q) return true;
        const title = (sl.title || "").toLowerCase();
        const typeLabel = (getSlideTypeDisplay(sl) || "").toLowerCase();
        const meta = (getSlideMetaText(sl) || "").toLowerCase();
        return title.includes(q) || typeLabel.includes(q) || meta.includes(q);
      });
    },
    [searchQuery, onlyIncomplete, getSlideMetaText]
  );

  const toggleOpenState = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter((prev) => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return new Set(updated); // ensure a new Set reference
    });
  };

  const toggleSubject = (id: string) => toggleOpenState(id, setOpenSubjects);
  const toggleModule = (id: string) => toggleOpenState(id, setOpenModules);
  const toggleChapter = (id: string) => toggleOpenState(id, setOpenChapters);

  // Expand all functionality
  const expandAll = () => {
    if (!studyLibraryData) return;

    const allSubjectIds = new Set<string>(
      studyLibraryData.map((s: SubjectType) => s.id)
    );
    const allModuleIds = new Set<string>();
    const allChapterIds = new Set<string>();

    Object.values(subjectModulesMap).forEach((modules) => {
      modules.forEach((mod) => {
        allModuleIds.add(mod.module.id);
        mod.chapters.forEach((ch) => {
          allChapterIds.add(ch.id);
          // ✅ REMOVED: Don't load slides on expand all
          // Slides will be loaded lazily when each chapter is opened
        });
      });
    });

    setOpenSubjects(allSubjectIds);
    setOpenModules(allModuleIds);
    setOpenChapters(allChapterIds);
  };

  const collapseAll = () => {
    setOpenSubjects(new Set());
    setOpenModules(new Set());
    setOpenChapters(new Set());
  };

  const isAllExpanded =
    studyLibraryData?.every((subject: SubjectType) =>
      openSubjects.has(subject.id)
    ) &&
    Object.values(subjectModulesMap).every((modules) =>
      modules.every(
        (mod) =>
          openModules.has(mod.module.id) &&
          mod.chapters.every((ch) => openChapters.has(ch.id))
      )
    );

  const tabContent: Record<TabType, React.ReactNode> = {
    [TabType.OUTLINE]: (
      <div className="space-y-4">
        {/* Expand/Collapse Controls */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Steps size={18} className="text-primary-600 shrink-0" />
            <span className="text-sm font-medium text-neutral-700 truncate">
              {getTerminology(ContentTerms.Course, SystemTerms.Course)}{" "}
              Structure
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto w-full md:w-auto">
            <div className="hidden md:flex items-center gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search slides…"
                className="h-8 w-48"
              />
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Switch
                  id="only-incomplete"
                  checked={onlyIncomplete}
                  onCheckedChange={setOnlyIncomplete}
                />
                <label htmlFor="only-incomplete" className="cursor-pointer">
                  Only incomplete
                </label>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={isAllExpanded ? collapseAll : expandAll}
              className="h-7 px-3 text-xs border-neutral-300 hover:border-primary-300 hover:bg-primary-50/50"
            >
              {isAllExpanded ? (
                <>
                  <FolderOpen size={14} className="mr-1.5" />
                  Collapse All
                </>
              ) : (
                <>
                  <Folder size={14} className="mr-1.5" />
                  Expand All
                </>
              )}
            </Button>
          </div>
          <div className="md:hidden w-full flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search slides…"
              className="h-9 flex-1 min-w-0"
            />
            <div className="flex items-center gap-2 text-xs text-neutral-600 shrink-0">
              <Switch
                id="only-incomplete-sm"
                checked={onlyIncomplete}
                onCheckedChange={setOnlyIncomplete}
              />
              <label htmlFor="only-incomplete-sm" className="cursor-pointer">
                Only incomplete
              </label>
            </div>
          </div>
        </div>
        <div className="w-full space-y-1.5">
          {isModulesLoading && (
            <div className="py-2 space-y-2">
              {/* Simple outline skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="w-6 h-6 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="ml-8 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-4 w-32" />
                    <div className="ml-auto w-24">
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isModulesLoading &&
            courseStructure === 5 &&
            studyLibraryData?.map((subject: SubjectType, idx: number) => {
              const isSubjectOpen = openSubjects.has(subject.id);
              const baseIndent = "pl-[calc(18px+0.5rem+18px+0.5rem)]";
              const subjectContentIndent = `${baseIndent} pl-[1.5rem]`;
              return (
                <Collapsible
                  key={subject.id}
                  open={isSubjectOpen}
                  onOpenChange={() => toggleSubject(subject.id)}
                >
                  <CollapsibleTrigger className="group flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-700 transition-all duration-200 hover:bg-primary-50/60 hover:border-primary-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {isSubjectOpen ? (
                        <CaretDown
                          size={18}
                          weight="bold"
                          className="shrink-0 text-neutral-500 group-hover:text-primary-600 transition-colors"
                        />
                      ) : (
                        <CaretRight
                          size={18}
                          weight="bold"
                          className="shrink-0 text-neutral-500 group-hover:text-primary-600 transition-colors"
                        />
                      )}
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary-600 text-white text-xs font-bold shrink-0">
                        {isSubjectOpen ? (
                          <FolderOpen size={12} />
                        ) : (
                          <Folder size={12} />
                        )}
                      </div>
                      {thumbUrlById[`subject:${subject.id}`] && (
                        <img
                          src={thumbUrlById[`subject:${subject.id}`]}
                          alt={toTitleCase(subject.subject_name)}
                          className="w-6 h-6 rounded-sm object-cover border border-neutral-200"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          loading="eager"
                          onError={(e) => {
                            e.currentTarget.classList.add("border-red-400");
                          }}
                        />
                      )}
                      {showContentPrefixes && (
                        <span className="w-7 shrink-0 text-center font-mono text-xs font-semibold text-neutral-500 bg-neutral-100 rounded px-1 py-0.5">
                          S{idx + 1}
                        </span>
                      )}
                      <span
                        className="break-words font-medium group-hover:text-primary-700 transition-colors"
                        title={toTitleCase(subject.subject_name)}
                      >
                        {toTitleCase(subject.subject_name)}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={`pb-1 pt-2 ${subjectContentIndent}`}
                  >
                    <div className="space-y-1 border-l-2 border-primary-200/60 pl-3 relative">
                      <div className="absolute left-0 top-0 w-0.5 h-full bg-primary-300/50"></div>
                      {(subjectModulesMap[subject.id] ?? []).map(
                        (mod, modIdx) => {
                          const isModuleOpen = openModules.has(mod.module.id);
                          const moduleContentIndent = `pl-[calc(16px+0.5rem+16px+0.5rem+1.5rem)]`;
                          return (
                            <Collapsible
                              key={mod.module.id}
                              open={isModuleOpen}
                              onOpenChange={() => toggleModule(mod.module.id)}
                            >
                              <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-neutral-600 transition-all duration-200 hover:bg-blue-50/70 hover:border-blue-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  {isModuleOpen ? (
                                    <CaretDown
                                      size={16}
                                      className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                    />
                                  ) : (
                                    <CaretRight
                                      size={16}
                                      className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                    />
                                  )}
                                  <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white">
                                    <FileText size={12} />
                                  </div>
                                  {thumbUrlById[`module:${mod.module.id}`] && (
                                    <img
                                      src={
                                        thumbUrlById[`module:${mod.module.id}`]
                                      }
                                      alt={mod.module.module_name}
                                      className="w-5 h-5 rounded-sm object-cover border border-neutral-200"
                                      crossOrigin="anonymous"
                                      referrerPolicy="no-referrer"
                                      loading="eager"
                                      onError={(e) => {
                                        e.currentTarget.classList.add(
                                          "border-red-400"
                                        );
                                      }}
                                    />
                                  )}
                                  {showContentPrefixes && (
                                    <span className="w-6 shrink-0 text-center font-mono text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1">
                                      M{modIdx + 1}
                                    </span>
                                  )}
                                  <span
                                    className="break-words group-hover:text-blue-700 transition-colors"
                                    title={mod.module.module_name}
                                  >
                                    {mod.module.module_name}
                                  </span>
                                  {/* Module Progress Indicator */}
                                  <div className="flex items-center gap-2 ml-auto shrink-0 min-w-[88px]">
                                    {(() => {
                                      const progress = calculateModuleProgress(
                                        mod.chapters || []
                                      );
                                      // const progressStatus = getModuleProgressStatus(mod.chapters || []);
                                      return (
                                        <>
                                          <div className="w-14 sm:w-16 hidden sm:block">
                                            {renderProgressBar(progress, "sm")}
                                          </div>
                                          {renderCompletionBadge(progress)}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent
                                className={`py-1 ${moduleContentIndent}`}
                              >
                                <div className="space-y-0.5 border-l-2 border-blue-200/40 pl-2.5 relative">
                                  <div className="absolute left-0 top-0 w-0.5 h-full bg-blue-300/60"></div>
                                  {(mod.chapters ?? []).map((ch, chIdx) => {
                                    const isChapterOpen = openChapters.has(
                                      ch.id
                                    );

                                    // Apply drip conditions

                                    const chapterEval =
                                      chapterEvaluations[ch.id];
                                    const shouldHideChapter =
                                      chapterEval &&
                                      shouldFilterItem(chapterEval);
                                    const isChapterLocked =
                                      chapterEval && isItemLocked(chapterEval);

                                    // Hide chapter if drip condition says so
                                    if (shouldHideChapter) {
                                      return null;
                                    }

                                    return (
                                      <Collapsible
                                        key={ch.id}
                                        open={isChapterOpen}
                                        onOpenChange={() => {
                                          if (isChapterLocked) return;
                                          toggleChapter(ch.id);
                                          getSlidesWithChapterId(ch.id);
                                        }}
                                      >
                                        <CollapsibleTrigger
                                          disabled={isChapterLocked}
                                          className={`group flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-neutral-600 transition-all duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1 ${
                                            isChapterLocked
                                              ? "cursor-not-allowed opacity-60"
                                              : "hover:bg-green-50/70 hover:border-green-200/60 cursor-pointer"
                                            }`}
                                        >
                                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                            {isChapterOpen ? (
                                              <CaretDown
                                                size={14}
                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                              />
                                            ) : (
                                              <CaretRight
                                                size={14}
                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                              />
                                            )}
                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-green-600 text-white">
                                              <PresentationChart size={10} />
                                            </div>
                                            {thumbUrlById[
                                              `chapter:${ch.id}`
                                            ] && (
                                                <img
                                                  src={
                                                    thumbUrlById[
                                                    `chapter:${ch.id}`
                                                    ]
                                                  }
                                                  alt={toTitleCase(
                                                    ch.chapter_name
                                                  )}
                                                  className="w-4 h-4 rounded-sm object-cover border border-neutral-200"
                                                  crossOrigin="anonymous"
                                                  referrerPolicy="no-referrer"
                                                  loading="eager"
                                                  onError={(e) => {
                                                    e.currentTarget.classList.add(
                                                      "border-red-400"
                                                    );
                                                  }}
                                                />
                                              )}
                                            {showContentPrefixes && (
                                              <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                C{chIdx + 1}
                                              </span>
                                            )}
                                            <span
                                              className="break-words text-sm sm:text-base font-semibold text-neutral-800 group-hover:text-green-700 transition-colors"
                                              title={toTitleCase(
                                                ch.chapter_name
                                              )}
                                            >
                                              {toTitleCase(ch.chapter_name)}
                                            </span>
                                            {/* Show locked badge if chapter is locked */}
                                            {isChapterLocked && (
                                              <LockedBadge
                                                size="sm"
                                                unlockMessage={
                                                  chapterEval?.unlockMessage
                                                }
                                              />
                                            )}
                                            {/* Chapter Progress Indicator */}
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                              {(() => {
                                                const progress =
                                                  calculateChapterProgress(
                                                    ch.id
                                                  );
                                                // const progressStatus = getChapterProgressStatus(ch.id);
                                                const slidesForChapter =
                                                  slidesMap[ch.id] || [];
                                                const completedSlides =
                                                  slidesForChapter.filter(
                                                    (slide) =>
                                                      (slide.percentage_completed ||
                                                        0) >= 80
                                                  ).length;
                                                const totalSlides =
                                                  slidesForChapter.length;

                                                return (
                                                  <>
                                                    <div className="w-12 hidden sm:block">
                                                      {renderProgressBar(
                                                        progress,
                                                        "sm"
                                                      )}
                                                    </div>
                                                    {slidesMap[ch.id] !==
                                                      undefined && (
                                                        <span className="text-xs text-neutral-500 hidden sm:inline">
                                                          {completedSlides}/
                                                          {totalSlides}
                                                        </span>
                                                      )}
                                                    {renderCompletionBadge(
                                                      progress
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div
                                            className={`space-y-px ml-5 border-l border-green-200/50 py-1 pl-2 relative `}
                                          >
                                            <div className="absolute left-0 top-0 w-px h-full bg-green-300/50"></div>
                                            {(() => {
                                              const slidesForChapter =
                                                slidesMap[ch.id] ?? [];
                                              const filteredSlides =
                                                filterSlides(slidesForChapter);

                                              // Apply drip conditions to filter out hidden slides
                                              const visibleSlides =
                                                filteredSlides.filter(
                                                  (slide) => {
                                                    const slideEval =
                                                      slideEvaluations[
                                                      slide.id
                                                      ];
                                                    const shouldHideSlide =
                                                      slideEval &&
                                                      shouldFilterItem(
                                                        slideEval
                                                      );
                                                    return !shouldHideSlide;
                                                  }
                                                );

                                              const status =
                                                slidesLoadingStatus[ch.id] ||
                                                "idle";
                                              if (status === "loading") {
                                                return (
                                                  <div className="pr-2">
                                                    {Array.from({
                                                      length: 3,
                                                    }).map((_, i) => (
                                                      <div
                                                        key={i}
                                                        className="flex items-center gap-2 px-2 py-1"
                                                      >
                                                        <Skeleton className="w-5 h-5 rounded" />
                                                        <Skeleton className="h-4 w-32" />
                                                        <div className="ml-auto flex items-center gap-2">
                                                          <Skeleton className="h-3 w-16" />
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                );
                                              }
                                              if (
                                                status === "loaded" &&
                                                visibleSlides.length === 0
                                              ) {
                                                return (
                                                  <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                    No Slides
                                                  </div>
                                                );
                                              }
                                              return visibleSlides.map(
                                                (slide, sIdx) => {
                                                  // Check if slide is locked
                                                  const slideEval =
                                                    slideEvaluations[slide.id];
                                                  const isSlideLocked =
                                                    slideEval &&
                                                    isItemLocked(slideEval);

                                                  return (
                                                    <div
                                                      key={slide.id}
                                                      className={
                                                        getSlideStyling() +
                                                        " rounded-md"
                                                      }
                                                      onClick={
                                                        isSlideClickable() &&
                                                          !isSlideLocked
                                                          ? () => {
                                                            handleSlideNavigation(
                                                              subject.id,
                                                              mod.module.id,
                                                              ch.id,
                                                              slide.id
                                                            );
                                                          }
                                                          : undefined
                                                      }
                                                    >
                                                      {showContentPrefixes && (
                                                        <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                          S{sIdx + 1}
                                                        </span>
                                                      )}
                                                      <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                        {getIcon(slide, "3")}
                                                      </div>
                                                      <span
                                                        className="break-words text-sm sm:text-base  text-neutral-800 group-hover:text-amber-700 transition-colors"
                                                        title={slide.title}
                                                      >
                                                        {slide.title}
                                                      </span>
                                                      {/* Show locked badge if slide is locked */}
                                                      {isSlideLocked && (
                                                        <LockedBadge
                                                          size="sm"
                                                          unlockMessage={
                                                            slideEval?.unlockMessage
                                                          }
                                                        />
                                                      )}
                                                      {(() => {
                                                        const sd =
                                                          getStatusDetails(
                                                            slide.percentage_completed ||
                                                            0
                                                          );
                                                        const badgeClass =
                                                          sd.badge === "done"
                                                            ? "bg-neutral-800 text-white"
                                                            : sd.badge ===
                                                              "active"
                                                              ? "bg-neutral-700 text-white"
                                                              : "bg-neutral-600 text-white";
                                                        return (
                                                          <Badge
                                                            variant="secondary"
                                                            className={`ml-2 hidden sm:inline align-middle text-[10px] font-medium ${badgeClass}`}
                                                          >
                                                            {sd.label}
                                                          </Badge>
                                                        );
                                                      })()}
                                                      {/* Slide Meta Row */}
                                                      <div className="flex flex-wrap items-center gap-2 ml-auto shrink-0 text-xs text-neutral-600 w-full sm:w-auto sm:ml-auto">
                                                        {(() => {
                                                          const progress =
                                                            slide.percentage_completed ||
                                                            0;
                                                          const meta =
                                                            getSlideMetaText(
                                                              slide
                                                            );
                                                          const typeLabel =
                                                            getSlideTypeDisplay(
                                                              slide
                                                            );

                                                          return (
                                                            <>
                                                              {typeLabel && (
                                                                <Badge
                                                                  variant="secondary"
                                                                  className={`${getTypeBadgeClasses(
                                                                    slide
                                                                  )}`}
                                                                >
                                                                  {typeLabel}
                                                                </Badge>
                                                              )}
                                                              {meta && (
                                                                <Badge
                                                                  variant="secondary"
                                                                  className="bg-neutral-600 text-white"
                                                                >
                                                                  {meta}
                                                                </Badge>
                                                              )}
                                                              <div className="w-16">
                                                                {renderProgressBar(
                                                                  progress,
                                                                  "sm"
                                                                )}
                                                              </div>
                                                              {/* compact status dot removed for cleaner UI */}
                                                            </>
                                                          );
                                                        })()}
                                                      </div>
                                                    </div>
                                                  );
                                                }
                                              );
                                            })()}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        }
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          {courseStructure === 4 &&
            studyLibraryData?.map((subject: SubjectType) => {
              const isSubjectOpen = openSubjects.has(subject.id);
              return (
                <Collapsible
                  key={subject.id}
                  open={isSubjectOpen}
                  onOpenChange={() => toggleSubject(subject.id)}
                >
                  <CollapsibleContent className={`pb-1 pt-2 `}>
                    <div className="space-y-1 relative">
                      {(subjectModulesMap[subject.id] ?? []).map(
                        (mod, modIdx) => {
                          const isModuleOpen = openModules.has(mod.module.id);
                          const moduleContentIndent = `pl-[calc(16px+0.5rem+16px+0.5rem+1.5rem)]`;
                          return (
                            <Collapsible
                              key={mod.module.id}
                              open={isModuleOpen}
                              onOpenChange={() => toggleModule(mod.module.id)}
                            >
                              <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-neutral-600 transition-all duration-200 hover:bg-blue-50/70 hover:border-blue-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  {isModuleOpen ? (
                                    <CaretDown
                                      size={16}
                                      className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                    />
                                  ) : (
                                    <CaretRight
                                      size={16}
                                      className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                    />
                                  )}
                                  <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white">
                                    <FileText size={12} />
                                  </div>
                                  {showContentPrefixes && (
                                    <span className="w-6 shrink-0 text-center font-mono text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1">
                                      M{modIdx + 1}
                                    </span>
                                  )}
                                  <span
                                    className="break-words group-hover:text-blue-700 transition-colors"
                                    title={toTitleCase(mod.module.module_name)}
                                  >
                                    {toTitleCase(mod.module.module_name)}
                                  </span>
                                  {/* Module Progress Indicator */}
                                  <div className="flex items-center gap-2 ml-auto shrink-0">
                                    {(() => {
                                      const progress = calculateModuleProgress(
                                        mod.chapters || []
                                      );
                                      return (
                                        <>
                                          <div className="w-16 hidden sm:block">
                                            {renderProgressBar(progress, "sm")}
                                          </div>
                                          {renderCompletionBadge(progress)}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent
                                className={`py-1 ${moduleContentIndent}`}
                              >
                                <div className="space-y-0.5 border-l-2 border-blue-200/40 pl-2.5 relative">
                                  <div className="absolute left-0 top-0 w-0.5 h-full bg-blue-300/60"></div>
                                  {(mod.chapters ?? []).map((ch, chIdx) => {
                                    const isChapterOpen = openChapters.has(
                                      ch.id
                                    );

                                    // Apply drip conditions

                                    const chapterEval =
                                      chapterEvaluations[ch.id];
                                    const shouldHideChapter =
                                      chapterEval &&
                                      shouldFilterItem(chapterEval);
                                    const isChapterLocked =
                                      chapterEval && isItemLocked(chapterEval);

                                    // Hide chapter if drip condition says so
                                    if (shouldHideChapter) {
                                      return null;
                                    }

                                    return (
                                      <Collapsible
                                        key={ch.id}
                                        open={isChapterOpen}
                                        onOpenChange={() => {
                                          if (isChapterLocked) return;
                                          toggleChapter(ch.id);
                                          getSlidesWithChapterId(ch.id);
                                        }}
                                      >
                                        <CollapsibleTrigger
                                          disabled={isChapterLocked}
                                          className={`group flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-neutral-600 transition-all duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1 ${
                                            isChapterLocked
                                              ? "cursor-not-allowed opacity-60"
                                              : "hover:bg-green-50/70 hover:border-green-200/60 cursor-pointer"
                                            }`}
                                        >
                                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                            {isChapterOpen ? (
                                              <CaretDown
                                                size={14}
                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                              />
                                            ) : (
                                              <CaretRight
                                                size={14}
                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                              />
                                            )}
                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-green-600 text-white">
                                              <PresentationChart size={10} />
                                            </div>
                                            {showContentPrefixes && (
                                              <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                C{chIdx + 1}
                                              </span>
                                            )}
                                            <span
                                              className="break-words group-hover:text-green-700 transition-colors text-xs"
                                              title={toTitleCase(
                                                ch.chapter_name
                                              )}
                                            >
                                              {toTitleCase(ch.chapter_name)}
                                            </span>
                                            {/* Show locked badge if chapter is locked */}
                                            {isChapterLocked && (
                                              <LockedBadge
                                                size="sm"
                                                unlockMessage={
                                                  chapterEval?.unlockMessage
                                                }
                                              />
                                            )}
                                            {/* Chapter Progress Indicator */}
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                              {(() => {
                                                const progress =
                                                  calculateChapterProgress(
                                                    ch.id
                                                  );
                                                const slidesForChapter =
                                                  slidesMap[ch.id] || [];
                                                const completedSlides =
                                                  slidesForChapter.filter(
                                                    (slide) =>
                                                      (slide.percentage_completed ||
                                                        0) >= 80
                                                  ).length;
                                                const totalSlides =
                                                  slidesForChapter.length;

                                                return (
                                                  <>
                                                    <div className="w-12 hidden sm:block">
                                                      {renderProgressBar(
                                                        progress,
                                                        "sm"
                                                      )}
                                                    </div>
                                                    {slidesMap[ch.id] !==
                                                      undefined && (
                                                        <span className="text-xs text-neutral-500 hidden sm:inline">
                                                          {completedSlides}/
                                                          {totalSlides}
                                                        </span>
                                                      )}
                                                    {renderCompletionBadge(
                                                      progress
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="space-y-px ml-3 sm:ml-5 border-l border-green-200/50 py-1 pl-2 relative">
                                            <div className="absolute left-0 top-0 w-0.5 h-full bg-green-300/60"></div>
                                            {(() => {
                                              const status =
                                                slidesLoadingStatus[ch.id] ||
                                                "idle";
                                              const filtered = filterSlides(
                                                slidesMap[ch.id] ?? []
                                              );
                                              if (status === "loading") {
                                                return (
                                                  <div className="pr-2">
                                                    {Array.from({
                                                      length: 3,
                                                    }).map((_, i) => (
                                                      <div
                                                        key={i}
                                                        className="flex items-center gap-2 px-2 py-1"
                                                      >
                                                        <Skeleton className="w-5 h-5 rounded" />
                                                        <Skeleton className="h-4 w-32" />
                                                        <div className="ml-auto flex items-center gap-2">
                                                          <Skeleton className="h-3 w-16" />
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                );
                                              }
                                              if (
                                                status === "loaded" &&
                                                filtered.length === 0
                                              ) {
                                                return (
                                                  <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                    No Slides
                                                  </div>
                                                );
                                              }
                                              return filtered.map(
                                                (slide, sIdx) => (
                                                  <div
                                                    key={slide.id}
                                                    className={
                                                      getSlideStyling() +
                                                      " rounded-md"
                                                    }
                                                    onClick={
                                                      isSlideClickable()
                                                        ? () => {
                                                          handleSlideNavigation(
                                                            subject.id,
                                                            mod.module.id,
                                                            ch.id,
                                                            slide.id
                                                          );
                                                        }
                                                        : undefined
                                                    }
                                                  >
                                                    {showContentPrefixes && (
                                                      <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                        S{sIdx + 1}
                                                      </span>
                                                    )}
                                                    <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                      {getIcon(slide, "3")}
                                                    </div>
                                                    <span
                                                      className="break-words text-sm sm:text-base text-neutral-800 group-hover:text-amber-700 transition-colors"
                                                      title={slide.title}
                                                    >
                                                      {slide.title}
                                                    </span>
                                                    {(() => {
                                                      const sd =
                                                        getStatusDetails(
                                                          slide.percentage_completed ||
                                                          0
                                                        );
                                                      const badgeClass =
                                                        sd.badge === "done"
                                                          ? "bg-green-50 text-green-700 border-green-200"
                                                          : sd.badge ===
                                                            "active"
                                                            ? "bg-primary-50 text-primary-700 border-primary-200"
                                                            : "bg-neutral-50 text-neutral-600 border-neutral-200";
                                                      return (
                                                        <Badge
                                                          variant="secondary"
                                                          className={`ml-2 hidden sm:inline align-middle text-[10px] font-medium border ${badgeClass}`}
                                                        >
                                                          {sd.label}
                                                        </Badge>
                                                      );
                                                    })()}
                                                    {/* Slide Progress and Meta */}
                                                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                      {getSlideTypeDisplay(
                                                        slide
                                                      ) && (
                                                          <Badge
                                                            variant="secondary"
                                                            className={`hidden sm:inline text-[10px] font-medium border ${getTypeBadgeClasses(
                                                              slide
                                                            )}`}
                                                          >
                                                            {getSlideTypeDisplay(
                                                              slide
                                                            )}
                                                          </Badge>
                                                        )}
                                                      {getSlideMetaText(
                                                        slide
                                                      ) && (
                                                          <Badge
                                                            variant="outline"
                                                            className="hidden sm:inline text-[10px] font-normal bg-neutral-50 text-neutral-600 border-neutral-200"
                                                          >
                                                            {getSlideMetaText(
                                                              slide
                                                            )}
                                                          </Badge>
                                                        )}
                                                      <div className="w-7 sm:w-8 hidden sm:block">
                                                        {renderProgressBar(
                                                          slide.percentage_completed ||
                                                          0,
                                                          "sm"
                                                        )}
                                                      </div>
                                                      <div
                                                        className={`w-2 h-2 rounded-full ${
                                                          (slide.percentage_completed ||
                                                            0) >= 80
                                                            ? "bg-green-500"
                                                            : (slide.percentage_completed ||
                                                              0) > 0
                                                              ? "bg-primary-500"
                                                              : "bg-neutral-300"
                                                          }`}
                                                      />
                                                    </div>
                                                  </div>
                                                )
                                              );
                                            })()}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  })}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        }
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          {courseStructure === 3 &&
            studyLibraryData?.map((subject: SubjectType) => {
              const isSubjectOpen = openSubjects.has(subject.id);
              return (
                <Collapsible
                  key={subject.id}
                  open={isSubjectOpen}
                  onOpenChange={() => toggleSubject(subject.id)}
                >
                  <CollapsibleContent className={`pb-1 pt-2 `}>
                    <div className="space-y-1 relative">
                      {(subjectModulesMap[subject.id] ?? []).map((mod) => {
                        const isModuleOpen = openModules.has(mod.module.id);
                        return (
                          <Collapsible
                            key={mod.module.id}
                            open={isModuleOpen}
                            onOpenChange={() => toggleModule(mod.module.id)}
                          >
                            <CollapsibleContent className={`py-1`}>
                              <div className="space-y-0.5">
                                {(mod.chapters ?? []).map((ch, chIdx) => {
                                  const isChapterOpen = openChapters.has(ch.id);

                                  // Apply drip conditions

                                  const chapterEval = chapterEvaluations[ch.id];
                                  const shouldHideChapter =
                                    chapterEval &&
                                    shouldFilterItem(chapterEval);
                                  const isChapterLocked =
                                    chapterEval && isItemLocked(chapterEval);

                                  // Hide chapter if drip condition says so
                                  if (shouldHideChapter) {
                                    return null;
                                  }

                                  return (
                                    <Collapsible
                                      key={ch.id}
                                      open={isChapterOpen}
                                      onOpenChange={() => {
                                        if (isChapterLocked) return;
                                        toggleChapter(ch.id);
                                        getSlidesWithChapterId(ch.id);
                                      }}
                                    >
                                      <CollapsibleTrigger
                                        disabled={isChapterLocked}
                                        className={`group flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-neutral-600 transition-all duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1 ${
                                          isChapterLocked
                                            ? "cursor-not-allowed opacity-60"
                                            : "hover:bg-green-50/70 hover:border-green-200/60 cursor-pointer"
                                          }`}
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                          {isChapterOpen ? (
                                            <CaretDown
                                              size={14}
                                              className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                            />
                                          ) : (
                                            <CaretRight
                                              size={14}
                                              className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                            />
                                          )}
                                          <div className="flex items-center justify-center w-4 h-4 rounded bg-green-600 text-white">
                                            <PresentationChart size={10} />
                                          </div>
                                          {showContentPrefixes && (
                                            <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                              C{chIdx + 1}
                                            </span>
                                          )}
                                          <span
                                            className="break-words text-sm sm:text-base font-semibold text-neutral-800 group-hover:text-green-700 transition-colors"
                                            title={toTitleCase(ch.chapter_name)}
                                          >
                                            {toTitleCase(ch.chapter_name)}
                                          </span>
                                          {/* Show locked badge if chapter is locked */}
                                          {isChapterLocked && (
                                            <LockedBadge
                                              size="sm"
                                              unlockMessage={
                                                chapterEval?.unlockMessage
                                              }
                                            />
                                          )}
                                          {/* Chapter Progress Indicator */}
                                          <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                            {(() => {
                                              const progress =
                                                calculateChapterProgress(ch.id);
                                              const slidesForChapter =
                                                slidesMap[ch.id] || [];
                                              const completedSlides =
                                                slidesForChapter.filter(
                                                  (slide) =>
                                                    (slide.percentage_completed ||
                                                      0) >= 80
                                                ).length;
                                              const totalSlides =
                                                slidesForChapter.length;

                                              return (
                                                <>
                                                  <div className="w-12 hidden sm:block">
                                                    {renderProgressBar(
                                                      progress,
                                                      "sm"
                                                    )}
                                                  </div>
                                                  {slidesMap[ch.id] !==
                                                    undefined && (
                                                      <span className="text-xs text-neutral-500 hidden sm:inline">
                                                        {completedSlides}/
                                                        {totalSlides}
                                                      </span>
                                                    )}
                                                  {renderCompletionBadge(
                                                    progress
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="space-y-px ml-5 border-l border-green-200/50 py-1 pl-2 relative">
                                          <div className="absolute left-0 top-0 w-px h-full bg-green-300/50"></div>
                                          {(() => {
                                            const status =
                                              slidesLoadingStatus[ch.id] ||
                                              "idle";
                                            const filtered = filterSlides(
                                              slidesMap[ch.id] ?? []
                                            );
                                            if (status === "loading") {
                                              return (
                                                <div className="pr-2">
                                                  {Array.from({
                                                    length: 3,
                                                  }).map((_, i) => (
                                                    <div
                                                      key={i}
                                                      className="flex items-center gap-2 px-2 py-1"
                                                    >
                                                      <Skeleton className="w-5 h-5 rounded" />
                                                      <Skeleton className="h-4 w-32" />
                                                      <div className="ml-auto flex items-center gap-2">
                                                        <Skeleton className="h-3 w-16" />
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              );
                                            }
                                            if (
                                              status === "loaded" &&
                                              filtered.length === 0
                                            ) {
                                              return (
                                                <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                  No Slides
                                                </div>
                                              );
                                            }
                                            return filtered.map(
                                              (slide, sIdx) => (
                                                <div
                                                  key={slide.id}
                                                  className={
                                                    getSlideStyling() +
                                                    " rounded-md"
                                                  }
                                                  onClick={
                                                    isSlideClickable()
                                                      ? () => {
                                                        handleSlideNavigation(
                                                          subject.id,
                                                          mod.module.id,
                                                          ch.id,
                                                          slide.id
                                                        );
                                                      }
                                                      : undefined
                                                  }
                                                >
                                                  {showContentPrefixes && (
                                                    <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                      S{sIdx + 1}
                                                    </span>
                                                  )}
                                                  <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                    {getIcon(slide, "3")}
                                                  </div>
                                                  <span
                                                    className="truncate text-sm sm:text-base text-neutral-800 group-hover:text-amber-700 transition-colors"
                                                    title={slide.title}
                                                  >
                                                    {slide.title}
                                                  </span>
                                                  {(() => {
                                                    const sd = getStatusDetails(
                                                      slide.percentage_completed ||
                                                      0
                                                    );
                                                    const badgeClass =
                                                      sd.badge === "done"
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : sd.badge === "active"
                                                          ? "bg-primary-50 text-primary-700 border-primary-200"
                                                          : "bg-neutral-50 text-neutral-600 border-neutral-200";
                                                    return (
                                                      <Badge
                                                        variant="secondary"
                                                        className={`ml-2 hidden sm:inline align-middle text-[10px] font-medium border ${badgeClass}`}
                                                      >
                                                        {sd.label}
                                                      </Badge>
                                                    );
                                                  })()}
                                                  {/* Slide Progress and Meta */}
                                                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                    {getSlideTypeDisplay(
                                                      slide
                                                    ) && (
                                                        <Badge
                                                          variant="secondary"
                                                          className={`hidden sm:inline text-[10px] font-medium border ${getTypeBadgeClasses(
                                                            slide
                                                          )}`}
                                                        >
                                                          {getSlideTypeDisplay(
                                                            slide
                                                          )}
                                                        </Badge>
                                                      )}
                                                    {getSlideMetaText(
                                                      slide
                                                    ) && (
                                                        <Badge
                                                          variant="outline"
                                                          className="hidden sm:inline text-[10px] font-normal bg-neutral-50 text-neutral-600 border-neutral-200"
                                                        >
                                                          {getSlideMetaText(
                                                            slide
                                                          )}
                                                        </Badge>
                                                      )}
                                                    <div className="w-7 sm:w-8 hidden sm:block">
                                                      {renderProgressBar(
                                                        slide.percentage_completed ||
                                                        0,
                                                        "sm"
                                                      )}
                                                    </div>
                                                    <div
                                                      className={`w-2 h-2 rounded-full ${
                                                        (slide.percentage_completed ||
                                                          0) >= 80
                                                          ? "bg-green-500"
                                                          : (slide.percentage_completed ||
                                                            0) > 0
                                                            ? "bg-primary-500"
                                                            : "bg-neutral-300"
                                                        }`}
                                                    />
                                                  </div>
                                                </div>
                                              )
                                            );
                                          })()}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

          {courseStructure === 2 &&
            studyLibraryData?.map((subject: SubjectType) => {
              const isSubjectOpen = openSubjects.has(subject.id);
              return (
                <Collapsible
                  key={subject.id}
                  open={isSubjectOpen}
                  onOpenChange={() => toggleSubject(subject.id)}
                >
                  <CollapsibleContent className={`pb-1 pt-2 `}>
                    <div className="space-y-1 relative">
                      {(subjectModulesMap[subject.id] ?? []).map((mod) => {
                        const isModuleOpen = openModules.has(mod.module.id);
                        return (
                          <Collapsible
                            key={mod.module.id}
                            open={isModuleOpen}
                            onOpenChange={() => toggleModule(mod.module.id)}
                          >
                            <CollapsibleContent className={`py-1`}>
                              <div className="space-y-0.5">
                                {(mod.chapters ?? []).map((ch) => {
                                  const isChapterOpen = openChapters.has(ch.id);

                                  return (
                                    <Collapsible
                                      key={ch.id}
                                      open={isChapterOpen}
                                      onOpenChange={() => {
                                        toggleChapter(ch.id);
                                        getSlidesWithChapterId(ch.id);
                                      }}
                                    >
                                      <CollapsibleContent>
                                        <div className="space-y-px pl-2 relative">
                                          {(slidesMap[ch.id] ?? []).length ===
                                            0 ? (
                                            <div className="text-xs px-2 text-neutral-400 italic bg-neutral-50/50 rounded">
                                              No slides in this chapter.
                                            </div>
                                          ) : (
                                            (slidesMap[ch.id] ?? []).map(
                                              (slide, sIdx) => (
                                                <div
                                                  key={slide.id}
                                                  className={getSlideStyling(
                                                    "sm"
                                                  )}
                                                  onClick={() => {
                                                    handleSlideNavigation(
                                                      subject.id,
                                                      mod.module.id,
                                                      ch.id,
                                                      slide.id
                                                    );
                                                  }}
                                                >
                                                  {showContentPrefixes && (
                                                    <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                      S{sIdx + 1}
                                                    </span>
                                                  )}
                                                  <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                    {getIcon(slide, "3")}
                                                  </div>
                                                  <span
                                                    className="truncate text-sm sm:text-base text-neutral-800 group-hover:text-amber-700 transition-colors"
                                                    title={slide.title}
                                                  >
                                                    {slide.title}
                                                  </span>
                                                  {(() => {
                                                    const sd = getStatusDetails(
                                                      slide.percentage_completed ||
                                                      0
                                                    );
                                                    const badgeClass =
                                                      sd.badge === "done"
                                                        ? "bg-green-50 text-green-700 border-green-200"
                                                        : sd.badge === "active"
                                                          ? "bg-primary-50 text-primary-700 border-primary-200"
                                                          : "bg-neutral-50 text-neutral-600 border-neutral-200";
                                                    return (
                                                      <Badge
                                                        variant="secondary"
                                                        className={`ml-2 hidden sm:inline align-middle text-[10px] font-medium border ${badgeClass}`}
                                                      >
                                                        {sd.label}
                                                      </Badge>
                                                    );
                                                  })()}
                                                  {/* Slide Progress and Meta */}
                                                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                    {getSlideTypeDisplay(
                                                      slide
                                                    ) && (
                                                        <Badge
                                                          variant="secondary"
                                                          className={`hidden sm:inline text-[10px] font-medium border ${getTypeBadgeClasses(
                                                            slide
                                                          )}`}
                                                        >
                                                          {getSlideTypeDisplay(
                                                            slide
                                                          )}
                                                        </Badge>
                                                      )}
                                                    {getSlideMetaText(
                                                      slide
                                                    ) && (
                                                        <Badge
                                                          variant="outline"
                                                          className="hidden sm:inline text-[10px] font-normal bg-neutral-50 text-neutral-600 border-neutral-200"
                                                        >
                                                          {getSlideMetaText(
                                                            slide
                                                          )}
                                                        </Badge>
                                                      )}
                                                    <div className="w-8 hidden sm:block">
                                                      {renderProgressBar(
                                                        slide.percentage_completed ||
                                                        0,
                                                        "sm"
                                                      )}
                                                    </div>
                                                    {/* compact status dot removed for cleaner UI */}
                                                    {/* compact status dot removed for cleaner UI */}
                                                    {/* compact status dot removed for cleaner UI */}
                                                  </div>
                                                </div>
                                              )
                                            )
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </div>
      </div>
    ),
    [TabType.CONTENT_STRUCTURE]: (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-2">
            <PresentationChart size={18} className="text-primary-600" />
            <span className="text-sm font-medium text-neutral-700">
              Content Structure
            </span>
          </div>
        </div>
        {/* Drill-down folder UI */}
        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-neutral-600 mb-2">
          <button
            type="button"
            className={`hover:text-primary-600 ${
              !selectedSubjectId && !selectedModuleId && !selectedChapterId
                ? "font-semibold text-primary-700"
                : ""
              }`}
            onClick={() => {
              setSelectedSubjectId(null);
              setSelectedModuleId(null);
              setSelectedChapterId(null);
            }}
          >
            Subjects
          </button>
          {selectedSubjectId && <span className="text-neutral-400">/</span>}
          {selectedSubjectId && (
            <button
              type="button"
              className={`hover:text-primary-600 ${
                selectedSubjectId && !selectedModuleId
                  ? "font-semibold text-primary-700"
                  : ""
                }`}
              onClick={() => {
                setSelectedModuleId(null);
                setSelectedChapterId(null);
              }}
            >
              Modules
            </button>
          )}
          {selectedModuleId && <span className="text-neutral-400">/</span>}
          {selectedModuleId && (
            <button
              type="button"
              className={`hover:text-primary-600 ${
                selectedModuleId && !selectedChapterId
                  ? "font-semibold text-primary-700"
                  : ""
                }`}
              onClick={() => {
                setSelectedChapterId(null);
              }}
            >
              Chapters
            </button>
          )}
          {selectedChapterId && <span className="text-neutral-400">/</span>}
          {selectedChapterId && (
            <span className="font-semibold text-primary-700">Slides</span>
          )}
        </div>
        {/* Starting depth adapts to courseStructure; if preselected IDs exist, skips to that depth */}
        {!isModulesLoading && !selectedSubjectId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {studyLibraryData?.map((subject) => (
              <div
                key={subject.id}
                className="h-full rounded-md border border-neutral-200 bg-white p-3 sm:p-4 shadow-sm hover:shadow cursor-pointer"
                onClick={() => {
                  setSelectedSubjectId(subject.id);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-neutral-100 flex items-center justify-center overflow-hidden">
                    {thumbUrlById[`subject:${subject.id}`] ? (
                      <img
                        src={thumbUrlById[`subject:${subject.id}`]}
                        alt={toTitleCase(subject.subject_name)}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        loading="eager"
                        onError={(e) => {
                          e.currentTarget.classList.add("border-red-400");
                        }}
                      />
                    ) : (
                      <Folder size={28} className="text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium text-neutral-800 break-words"
                      title={toTitleCase(subject.subject_name)}
                    >
                      {toTitleCase(subject.subject_name)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Modules */}
        {!isModulesLoading && selectedSubjectId && !selectedModuleId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(subjectModulesMap[selectedSubjectId] || []).map((m) => (
              <div
                key={m.module.id}
                className="rounded-md border border-neutral-200 bg-white p-3 sm:p-4 shadow-sm hover:shadow cursor-pointer"
                onClick={() => {
                  setSelectedModuleId(m.module.id);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-neutral-100 flex items-center justify-center overflow-hidden">
                    {thumbUrlById[`module:${m.module.id}`] ? (
                      <img
                        src={thumbUrlById[`module:${m.module.id}`]}
                        alt={m.module.module_name}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        loading="eager"
                        onError={(e) => {
                          e.currentTarget.classList.add("border-red-400");
                        }}
                      />
                    ) : (
                      <Folder size={28} className="text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium text-neutral-800 break-words"
                      title={m.module.module_name}
                    >
                      {m.module.module_name}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Chapters */}
        {!isModulesLoading &&
          selectedSubjectId &&
          selectedModuleId &&
          !selectedChapterId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(subjectModulesMap[selectedSubjectId] || [])
                .filter((m) => m.module.id === selectedModuleId)
                .flatMap((m) => m.chapters)
                .filter((ch) => {
                  const evaluation = chapterEvaluations[ch.id];
                  return !evaluation?.isHidden;
                })
                .map((ch) => {
                  const evaluation = chapterEvaluations[ch.id];
                  const isChapterLocked = evaluation?.isLocked ?? false;
                  return (
                    <div
                      key={ch.id}
                      className={`h-full rounded-md border border-neutral-200 bg-white p-3 sm:p-4 shadow-sm ${isChapterLocked
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:shadow cursor-pointer"
                        }`}
                      onClick={async () => {
                        if (isChapterLocked) return;
                        setSelectedChapterId(ch.id);
                        await getSlidesWithChapterId(ch.id);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-neutral-100 flex items-center justify-center overflow-hidden">
                          {thumbUrlById[`chapter:${ch.id}`] ? (
                            <img
                              src={thumbUrlById[`chapter:${ch.id}`]}
                              alt={toTitleCase(ch.chapter_name)}
                              className="w-full h-full object-cover"
                              crossOrigin="anonymous"
                              referrerPolicy="no-referrer"
                              loading="eager"
                              onError={(e) => {
                                e.currentTarget.classList.add("border-red-400");
                              }}
                            />
                          ) : (
                            <FileText size={24} className="text-neutral-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-medium text-neutral-800 break-words"
                            title={ch.chapter_name}
                          >
                            {ch.chapter_name}
                          </div>
                          {isChapterLocked && (
                            <div className="mt-1">
                              <LockedBadge size="sm" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        {/* Slides */}
        {selectedChapterId && (
          <div className="space-y-2">
            {(() => {
              const status = slidesLoadingStatus[selectedChapterId] || "idle";
              if (status === "loading") {
                return (
                  <div className="px-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2 py-1"
                      >
                        <Skeleton className="w-5 h-5 rounded" />
                        <Skeleton className="h-4 w-32" />
                        <div className="ml-auto flex items-center gap-2">
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              const chapterSlides = slidesMap[selectedChapterId] || [];
              const visibleSlides = chapterSlides.filter((sl) => {
                const evaluation = slideEvaluations[sl.id];
                return !evaluation?.isHidden;
              });
              if (status === "loaded" && visibleSlides.length === 0) {
                return (
                  <div className="text-sm text-neutral-500 italic">
                    No Slides
                  </div>
                );
              }
              return visibleSlides.map((sl, index) => {
                const evaluation = slideEvaluations[sl.id];
                const isSlideLocked = evaluation?.isLocked ?? false;
                return (
                  <div
                    key={sl.id}
                    className={`${getSlideStyling()} flex-col items-start gap-2 p-3 ${
                      isSlideLocked ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    onClick={() => {
                      if (isSlideLocked) return;
                      if (isSlideClickable()) {
                        handleSlideNavigation(
                          selectedSubjectId || "",
                          selectedModuleId || "",
                          selectedChapterId,
                          sl.id
                        );
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <div className="flex w-6 h-6 items-center justify-center rounded-md text-xs font-bold bg-gray-100 text-gray-500">
                          {index + 1}
                        </div>
                        {getIcon(sl, "4")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm break-words">
                          {sl.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 sm:mt-1">
                          {getSlideTypeDisplay(sl)}
                        </div>
                        {isSlideLocked && (
                          <div className="mt-1">
                            <LockedBadge size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    ),
    [TabType.TEACHERS]: (
      <div className="rounded-md bg-card border border-neutral-200 p-5 text-sm text-neutral-600">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <span className="font-medium text-neutral-700">
            {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}s
          </span>
        </div>
        <p className="text-neutral-500">
          {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}s content
          coming soon.
        </p>
      </div>
    ),
    [TabType.ASSESSMENT]: (
      <div className="rounded-md bg-card border border-neutral-200 p-5 text-sm text-neutral-600">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-md bg-green-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="font-medium text-neutral-700">Assessments</span>
        </div>
        <p className="text-neutral-500">Assessment content coming soon.</p>
      </div>
    ),
    [TabType.COURSE_DISCUSSION]: (
      <div className="space-y-4">
        {packageSessionId ? (
          <PackageSessionMessages packageSessionId={packageSessionId} />
        ) : (
          <div className="rounded-md bg-card border border-neutral-200 p-5 text-sm text-neutral-600">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">D</span>
              </div>
              <span className="font-medium text-neutral-700">
                Course Discussion
              </span>
            </div>
            <p className="text-neutral-500">
              Course discussion will be available once you enroll in this
              course.
            </p>
          </div>
        )}
      </div>
    ),
  };

  // Trigger module loading when session or level changes
  useEffect(() => {
    if (packageSessionId) {
      const loadModules = async () => {
        handleLoadingChange(true);
        setIsModulesLoading(true);
        try {
          const modulesMap = await fetchModules({
            subjects: getSubjectDetails(
              courseData,
              selectedSession,
              selectedLevel
            ),
          });
          setSubjectModulesMap(modulesMap);

          // Auto-expand only the first item in each level
          const subjects = getSubjectDetails(
            courseData,
            selectedSession,
            selectedLevel
          );
          const firstSubjectId = subjects[0]?.id;

          if (firstSubjectId) {
            const firstSubjectModules = modulesMap[firstSubjectId] || [];
            const firstModuleId = firstSubjectModules[0]?.module.id;
            const firstChapterId = firstSubjectModules[0]?.chapters[0]?.id;

            const openSubjectsSet = new Set<string>([firstSubjectId]);
            const openModulesSet = new Set<string>();
            const openChaptersSet = new Set<string>();

            if (firstModuleId) {
              openModulesSet.add(firstModuleId);
            }
            if (firstChapterId) {
              openChaptersSet.add(firstChapterId);
              // Automatically load slides for the first opened chapter
              getSlidesWithChapterId(firstChapterId);
            }

            setOpenSubjects(openSubjectsSet);
            setOpenModules(openModulesSet);
            setOpenChapters(openChaptersSet);
          }

          // Update module stats for parent component
          if (updateModuleStats) {
            updateModuleStats(modulesMap);
          }
        } catch {
          setSubjectModulesMap({});
        } finally {
          handleLoadingChange(false);
          setIsModulesLoading(false);
        }
      };
      loadModules();
    }
  }, [selectedSession, selectedLevel, packageSessionId, handleLoadingChange]);

  useEffect(() => {
    const studyLibraryData = getSubjectDetails(
      courseData,
      selectedSession,
      selectedLevel
    );

    setStudyLibraryData(studyLibraryData);
  }, [selectedSession, selectedLevel, courseData]);

  // Prefetch thumbnails for modules/chapters when at their depth
  useEffect(() => {
    const prefetch = async () => {
      if (selectedSubjectId && !selectedModuleId) {
        const mods = subjectModulesMap[selectedSubjectId] || [];
        for (const m of mods) {
          let fileId: string | undefined;
          if (
            m &&
            m.module &&
            typeof m.module === "object" &&
            "thumbnail_id" in m.module
          ) {
            fileId = (m.module as { thumbnail_id?: string }).thumbnail_id;
          }
          const key = `module:${m.module.id}`;
          if (fileId && !thumbUrlById[key]) {
            try {
              const url = await getPublicUrlWithoutLogin(fileId);
              setThumbUrlById((prev) => ({ ...prev, [key]: url }));
            } catch {
              // Silent error handling
            }
          }
        }
      }
      if (selectedSubjectId && selectedModuleId && !selectedChapterId) {
        const mods = subjectModulesMap[selectedSubjectId] || [];
        const mod = mods.find((mm) => mm.module.id === selectedModuleId);
        for (const ch of mod?.chapters || []) {
          const fileId = ch.file_id as string | undefined;
          const key = `chapter:${ch.id}`;
          if (fileId && !thumbUrlById[key]) {
            try {
              const url = await getPublicUrlWithoutLogin(fileId);
              setThumbUrlById((prev) => ({ ...prev, [key]: url }));
            } catch {
              // Silent error handling
            }
          }
        }
      }
    };
    prefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSubjectId,
    selectedModuleId,
    selectedChapterId,
    subjectModulesMap,
  ]);

  // Mount/unmount logs to verify which component is active

  // Global prefetch thumbnails for all subjects/modules/chapters
  useEffect(() => {
    const prefetchAll = async () => {
      try {
        const subjectsArr = studyLibraryData ?? [];
        const moduleMapKeys = Object.keys(subjectModulesMap || {});
        const hasSubjects = subjectsArr.length > 0;
        const hasModules = moduleMapKeys.length > 0;
        // Avoid work/logs when nothing to prefetch yet
        if (!hasSubjects && !hasModules) return;

        const pending: Array<{ key: string; fileId: string }> = [];

        // subjects
        for (const s of subjectsArr) {
          const key = `subject:${s.id}`;
          const fileId = getSubjectThumbnailId(s);
          if (fileId && !thumbUrlById[key]) {
            pending.push({ key, fileId });
          }
        }

        // modules + chapters
        Object.values(subjectModulesMap || {}).forEach((mods) => {
          for (const m of mods || []) {
            const moduleKey = `module:${m.module.id}`;
            const moduleFileId = getModuleThumbnailId(m.module);
            if (moduleFileId && !thumbUrlById[moduleKey]) {
              pending.push({ key: moduleKey, fileId: moduleFileId });
            }

            for (const ch of m.chapters || []) {
              const chapterKey = `chapter:${ch.id}`;
              const chapterFileId = ch.file_id ?? undefined;
              if (chapterFileId && !thumbUrlById[chapterKey]) {
                pending.push({ key: chapterKey, fileId: chapterFileId });
              }
            }
          }
        });

        if (pending.length === 0) return;
        // dedupe
        const seen = new Set<string>();
        const unique = pending.filter(({ key }) =>
          seen.has(key) ? false : (seen.add(key), true)
        );
        const results = await Promise.all(
          unique.map(async ({ key, fileId }) => {
            try {
              const url = await getPublicUrlWithoutLogin(fileId);

              return { key, url } as const;
            } catch {
              return { key, url: "" } as const;
            }
          })
        );

        const updates: Record<string, string> = {};
        for (const { key, url } of results) if (url) updates[key] = url;
        if (Object.keys(updates).length > 0) {
          setThumbUrlById((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        // ignore prefetch errors
      }
    };
    prefetchAll();
  }, [studyLibraryData, subjectModulesMap]);

  // Ensure Content Structure starts at correct depth based on courseStructure once data is ready
  useEffect(() => {
    // Do not override if user already drilled in
    if (selectedSubjectId || selectedModuleId || selectedChapterId) return;
    const subjects = studyLibraryData || [];
    if (subjects.length === 0) return;

    // Helper to pick first module/chapters safely
    const firstSubjectId = subjects[0]?.id;
    const modules = firstSubjectId
      ? subjectModulesMap[firstSubjectId] || []
      : [];
    const firstModuleId = modules[0]?.module.id;
    const firstChapterId = modules[0]?.chapters[0]?.id;

    if (courseStructure >= 5) {
      // subjects at top level - nothing to preselect
      return;
    }
    if (courseStructure === 4 && firstSubjectId) {
      setSelectedSubjectId(firstSubjectId);
      return;
    }
    if (courseStructure === 3 && firstSubjectId && firstModuleId) {
      setSelectedSubjectId(firstSubjectId);
      setSelectedModuleId(firstModuleId);
      return;
    }
    if (
      courseStructure === 2 &&
      firstSubjectId &&
      firstModuleId &&
      firstChapterId
    ) {
      setSelectedSubjectId(firstSubjectId);
      setSelectedModuleId(firstModuleId);
      setSelectedChapterId(firstChapterId);
      getSlidesWithChapterId(firstChapterId);
    }
  }, [
    courseStructure,
    studyLibraryData,
    subjectModulesMap,
    selectedSubjectId,
    selectedModuleId,
    selectedChapterId,
    getSlidesWithChapterId,
  ]);

  useEffect(() => {
    setNavHeading(
      <div className="flex items-center gap-2">
        <div>Course Details</div>
      </div>
    );
  }, [setNavHeading]);

  // Debug logging for render

  return (
    <>
      {/* Donation Dialog for Slide Access */}
      {donationDialogOpen && targetSlideDetails && (
        <DonationDialog
          open={donationDialogOpen}
          onOpenChange={setDonationDialogOpen}
          packageSessionId={packageSessionId}
          instituteId={instituteId || ""}
          token={authToken}
          courseTitle={courseData?.courseData?.title ?? "Course"}
          inviteCode="default"
          mode="slide-access"
          isUserEnrolled={isEnrolledInCourse} // Pass enrollment status
          targetSlideDetails={targetSlideDetails}
          onSlideAccessSuccess={(
            courseId,
            subjectId,
            moduleId,
            chapterId,
            slideId
          ) => {
            // Navigate to slides after successful donation or skip
            navigateTo(
              `/study-library/courses/course-details/subjects/modules/chapters/slides`,
              {
                courseId,
                subjectId,
                moduleId,
                chapterId,
                slideId,
                sessionId: packageSessionId || "",
              }
            );
            setDonationDialogOpen(false);
            setTargetSlideDetails(null);
          }}
        />
      )}

      <PullToRefreshWrapper onRefresh={refreshData}>
        <div className="flex size-full flex-col gap-4 rounded-lg bg-card pt-0 pb-4 text-neutral-700">
          <Tabs
            value={selectedStructureTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            {renderTabs.length > 1 && (
              <TabsList className="h-auto border-b border-neutral-200/80 bg-transparent p-0 flex flex-row flex-wrap items-center justify-start gap-2 overflow-x-auto w-full">
                {renderTabs.map((tab: { label: string; value: string }) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`inline-flex items-center data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-3 whitespace-nowrap 
                                    py-2 text-sm font-medium transition-all duration-200 
                                    hover:bg-primary-50/60 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1
                                    data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-primary-50/30 data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:rounded-t-lg`}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
            <TabsContent
              key={selectedStructureTab}
              value={selectedStructureTab}
              className={`${
                renderTabs.length > 1 ? "mt-4" : ""
                } rounded-lg bg-white border border-neutral-200/60 p-4`}
            >
              {tabContent[selectedStructureTab as TabType]}
            </TabsContent>
          </Tabs>
        </div>
      </PullToRefreshWrapper>
    </>
  );
};
