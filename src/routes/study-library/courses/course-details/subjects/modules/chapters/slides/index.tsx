import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState, useCallback } from "react";
import { truncateString } from "@/lib/reusable/truncateString";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { toTitleCase } from "@/lib/utils";
import { CaretLeft, BookOpen, GraduationCap } from "phosphor-react";
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
import { MyButton } from "@/components/design-system/button";
import { FiEdit } from "react-icons/fi";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { Preferences } from "@capacitor/preferences";
import { BatchForSessionType } from "@/stores/study-library/institute-schema";
import { getPublicUrl } from "@/services/upload_file";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

    const { open } = useSidebar();
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
                    localStorage.setItem(feedbackSeenKey, 'true');
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
                const targetSlide = slidesWithFeedback.find(
                    (s) => s.id === slideId
                );
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

    const gotoSlide = useCallback((targetSlideId: string) => {
        const targetSlide = slides?.find((s: Slide) => s.id === targetSlideId);
        if (targetSlide) {
            setActiveItem(targetSlide);
            navigate({
                to: "/study-library/courses/course-details/subjects/modules/chapters/slides",
                search: { courseId, subjectId, moduleId, chapterId, slideId: targetSlideId, sessionId },
                replace: true,
            });
        }
    }, [slides, setActiveItem, navigate, courseId, subjectId, moduleId, chapterId, sessionId]);

    const [moduleName, setModuleName] = useState("");
    const [chapterName, setChapterName] = useState("");
    const [subjectName, setSubjectName] = useState("");
    const [courseName, setCourseName] = useState("");
    const [levelName, setLevelName] = useState("");
    const [instituteLogoUrl, setInstituteLogoUrl] = useState<string>("");
    const truncatedChapterName = truncateString(chapterName || "", 12);

    useEffect(() => {
        setModuleName(getModuleName(moduleId, modulesWithChaptersData));
        setChapterName(
            getChapterName(chapterId, modulesWithChaptersData) || ""
        );
        setSubjectName(getSubjectName(subjectId, studyLibraryData) || "");
    }, [chapterId, moduleId, subjectId, modulesWithChaptersData, studyLibraryData]);

    // Get course and level names, and institute logo
    useEffect(() => {
        const getCourseAndLevelInfo = async () => {
            try {
                // Get institute details first for logo
                const instituteData = await Preferences.get({ key: "InstituteDetails" });
                if (instituteData.value) {
                    const institute = JSON.parse(instituteData.value);
                    
                    // Get institute logo
                    if (institute.institute_logo_file_id) {
                        try {
                            const logoUrl = await getPublicUrl(institute.institute_logo_file_id);
                            if (logoUrl) {
                                setInstituteLogoUrl(logoUrl);
                            }
                        } catch {
                            // Silently handle logo loading error
                        }
                    }
                    
                    // Try to find course info in institute batches_for_sessions
                    if (institute.batches_for_sessions && Array.isArray(institute.batches_for_sessions)) {
                        
                        // Try multiple matching strategies
                        let matchingBatch = institute.batches_for_sessions.find((batch: BatchForSessionType) => 
                            batch.id === sessionId
                        );
                        
                        if (!matchingBatch) {
                            matchingBatch = institute.batches_for_sessions.find((batch: BatchForSessionType) => 
                                batch.package_dto?.id === courseId
                            );
                        }
                        
                        // If still no match, use the first available batch
                        if (!matchingBatch && institute.batches_for_sessions.length > 0) {
                            matchingBatch = institute.batches_for_sessions[0];
                        }
                        
                        if (matchingBatch) {
                            const courseNameFromBatch = matchingBatch.package_dto?.package_name || "";
                            const levelNameFromBatch = matchingBatch.level?.level_name || "";
                            setCourseName(courseNameFromBatch);
                            setLevelName(levelNameFromBatch);
                        }
                    }
                }
                
                // Also try sessionList as fallback
                const sessionListData = await Preferences.get({ key: "sessionList" });
                if (sessionListData.value && !courseName && !levelName) {
                    const sessionData = JSON.parse(sessionListData.value);
                    const sessions = Array.isArray(sessionData) ? sessionData : [sessionData];
                    
                    if (sessions.length > 0) {
                        const firstSession = sessions[0];
                        setCourseName(firstSession.package_dto?.package_name || "");
                        setLevelName(firstSession.level?.level_name || "");
                    }
                }
                
            } catch {
                // Silently handle errors
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
            setFeedbackVisible(
                s?.courseDetails?.slidesView?.feedbackVisible ?? true
            );
        });
    }, []);

    const SidebarComponent = (
        <div className="relative w-full max-w-full h-full">
            <div className="relative h-full bg-white">
                {/* Header */}
                <div
                    className="absolute top-0 left-0 right-0 z-20 bg-white border-b border-gray-100"
                    id="slides-side-header"
                >
                    <div
                        className={`${
                            open
                                ? "px-2 sm:px-3 md:px-4"
                                : "px-1 sm:px-2 md:px-3"
                        } py-2 sm:py-3`}
                    >
                        <div className="relative group overflow-hidden animate-fade-in-down">
                            {showLearningPath && (
                                <div className="flex items-center space-x-1 sm:space-x-2 mb-1 sm:mb-2">
                                    <div className="p-0.5 sm:p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-md shadow-sm">
                                        <BookOpen
                                            size={12}
                                            className="sm:w-3.5 sm:h-3.5 text-primary-600"
                                            weight="duotone"
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700">
                                        Learning Path
                                    </span>
                                </div>
                            )}
                            {showLearningPath && (
                                <>
                                    {/* Mobile: only last node with popover to show full path + slides */}
                                    <div className="flex items-center sm:hidden" id="slides-breadcrumb-row-mobile">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-md inline-flex items-center gap-1 truncate max-w-[75%]">
                                                    <span className="truncate">{toTitleCase(chapterName || "Chapter")}</span>
                                                    <ChevronDownIcon className="w-3 h-3 text-primary-600" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[90vw] max-w-sm p-3" sideOffset={6} align="start">
                                                <div className="space-y-3">
                                                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Learning Path</div>
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <button className="px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 truncate" onClick={handleSubjectRoute}>
                                                            {toTitleCase(subjectName || "Subject")}
                                                        </button>
                                                        <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                                                        <button className="px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 truncate" onClick={handleModuleRoute}>
                                                            {toTitleCase(moduleName || "Module")}
                                                        </button>
                                                        <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                                                        <span className="px-2 py-1 rounded-md bg-primary-50 text-primary-700 font-semibold truncate">
                                                            {toTitleCase(chapterName || "Chapter")}
                                                        </span>
                                                    </div>
                                                    {slides && slides.length > 0 && (
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Slides</div>
                                                            <div className="max-h-64 overflow-auto divide-y divide-gray-100 rounded-md border border-gray-100">
                                                                {slides.map((s: Slide, idx: number) => (
                                                                    <button
                                                                        key={s.id}
                                                                        className={`w-full text-left px-2 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 ${activeItem?.id === s.id ? "bg-primary-50 text-primary-700" : "text-gray-700"}`}
                                                                        onClick={() => gotoSlide(s.id)}
                                                                    >
                                                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold ${activeItem?.id === s.id ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600"}`}>{idx + 1}</span>
                                                                        <span className="truncate flex-1">{s.title || "Untitled"}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Desktop/Tablet: full breadcrumb */}
                                    <div
                                        className="hidden sm:flex flex-wrap items-center gap-0.5 sm:gap-1 text-gray-600"
                                        id="slides-breadcrumb-row"
                                    >
                                        <button
                                            className={`text-xs font-medium hover:text-primary-600 ${
                                                open ? "block" : "hidden sm:block"
                                            }`}
                                            onClick={handleSubjectRoute}
                                        >
                                            {truncateString(
                                                toTitleCase(subjectName),
                                                open
                                                    ? window.innerWidth < 640
                                                        ? 20
                                                        : 15
                                                    : 8
                                            )}
                                        </button>
                                        <ChevronRightIcon className="w-2 h-2 sm:w-3 sm:h-3 text-gray-400" />
                                        <button
                                            className={`text-xs font-medium hover:text-primary-600 ${
                                                open ? "block" : "hidden sm:block"
                                            }`}
                                            onClick={handleModuleRoute}
                                        >
                                            {truncateString(
                                                toTitleCase(moduleName),
                                                open
                                                    ? window.innerWidth < 640
                                                        ? 20
                                                        : 15
                                                    : 8
                                            )}
                                        </button>
                                        <ChevronRightIcon className="w-2 h-2 sm:w-3 sm:h-3 text-gray-400" />
                                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-1 sm:px-2 py-0.5 rounded-lg">
                                            {open
                                                ? window.innerWidth < 640
                                                    ? toTitleCase(chapterName)
                                                    : truncatedChapterName
                                                : truncatedChapterName}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section Title */}
                <div
                    className={`absolute ${showLearningPath ? "top-[70px] sm:top-[85px]" : "top-[10px] sm:top-[12px]"} left-0 right-0 z-20 flex items-center space-x-1 sm:space-x-2 p-2 sm:p-3 md:p-4 border-b border-gray-100 bg-gray-50`}
                >
                    <div className="p-1 sm:p-1.5 bg-primary-100 rounded-lg flex items-center justify-center min-w-[28px] min-h-[28px] sm:min-w-[32px] sm:min-h-[32px]">
                        {instituteLogoUrl ? (
                            <img
                                src={instituteLogoUrl}
                                alt="Institute Logo"
                                className="max-w-full max-h-full object-contain"
                                style={{ width: 'auto', height: 'auto', maxWidth: '24px', maxHeight: '24px' }}
                            />
                        ) : (
                            <GraduationCap
                                size={14}
                                className="sm:w-4 sm:h-4 text-primary-600"
                                weight="duotone"
                            />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {courseName ? toTitleCase(courseName) : "Loading Course..."}
                        </h3>
                        {levelName && levelName.toLowerCase() !== "default" && (
                            <p className="text-xs text-gray-600">
                                {toTitleCase(levelName)}
                            </p>
                        )}
                        {!levelName && (
                            <p className="text-xs text-gray-600">
                                Loading Level...
                            </p>
                        )}
                    </div>
                </div>

                {/* Scrollable Slides List */}
                <div
                    className={`absolute ${showLearningPath ? "top-[145px]" : "top-[70px]"} bottom-[85px] left-0 right-0 overflow-y-auto`}
                >
                    <div className="relative bg-white transition-all duration-300 group min-h-full">
                        <div className="relative p-2 sm:p-3 animate-fade-in-up">
                            <ChapterSidebarSlides />
                        </div>
                    </div>
                </div>

                {/* Feedback + Progress */}
                {slides && slides.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100">
                        <div
                            className={`${open ? "px-3 sm:px-4" : "px-2 sm:px-3"} pt-3`}
                        >
                            {/* Feedback Button */}
                            {feedbackVisible && (
                                <MyButton
                                    buttonType="text"
                                    scale="medium"
                                    layoutVariant="default"
                                    onClick={() => {
                                        const feedbackSlide: Slide = {
                                            id: "feedback-slide",
                                            title: "Feedback",
                                            source_type: "FEEDBACK",
                                            source_id: "",
                                            image_file_id: "",
                                            description:
                                                "Provide feedback for this chapter",
                                            status: "ACTIVE",
                                            slide_order: slides?.length
                                                ? slides.length + 1
                                                : 1,
                                            percentage_completed: 0,
                                            is_loaded: true,
                                            new_slide: false,
                                            progress_marker: 0,
                                        };
                                        setActiveItem(feedbackSlide);
                                    }}
                                    className={`
                  w-full 
                  mb-3 
                  flex 
                  items-center 
                  justify-start 
                  gap-2 
                  !bg-transparent 
                  !border-none 
                  !text-left 
                  transition-all 
                  duration-200 
                  hover:!bg-primary-100 
                  ${activeItem?.id === "feedback-slide" ? "!bg-primary-50" : ""}
                `}
                                >
                                    <FiEdit className="w-4 h-4" />
                                    <span className="text-sm">Feedback</span>
                                </MyButton>
                            )}

                            {/* Progress */}
                            <div className="relative p-3 border border-gray-200 rounded-lg bg-gray-50">
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                        <span className="text-xs font-semibold text-gray-700">
                                            Progress
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 rounded-full"
                                                style={{
                                                    width: `${calculateOverallCompletion(slides)}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-primary-600 min-w-[30px]">
                                            {calculateOverallCompletion(slides)}
                                            %
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
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
                                className="max-w-full max-h-full object-contain"
                                style={{ width: 'auto', height: 'auto', maxWidth: '28px', maxHeight: '28px' }}
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
                                <PopoverContent className="w-[90vw] max-w-sm p-2" sideOffset={6} align="start">
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Learning Path</div>
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
    }, [setNavHeading, subjectName, moduleName, chapterName, instituteLogoUrl, handleSubjectRoute, handleModuleRoute]);

    // Enforce display settings in slides side view
    useEffect(() => {
        getStudentDisplaySettings(false).then((s) => {
            const showLearningPath =
                s?.courseDetails?.slidesView?.showLearningPath ?? true;
            const feedbackVisible =
                s?.courseDetails?.slidesView?.feedbackVisible ?? true;

            const breadcrumbRow = document.getElementById(
                "slides-breadcrumb-row"
            );
            if (breadcrumbRow) {
                breadcrumbRow.style.display = showLearningPath
                    ? "flex"
                    : "none";
            }
            const feedbackButtons =
                document.querySelectorAll<HTMLButtonElement>(
                    "button:has(> span:text('Feedback'))"
                );
            if (!feedbackVisible) {
                // hide feedback section by skipping setting activeItem to feedback and hiding button
                if (feedbackButtons && feedbackButtons.length) {
                    feedbackButtons.forEach((b) => (b.style.display = "none"));
                }
            }
        });
    }, []);

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
