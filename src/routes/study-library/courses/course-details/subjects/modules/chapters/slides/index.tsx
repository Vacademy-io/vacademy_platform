import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
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
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { getStudentDisplaySettings } from "@/services/student-display-settings";

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
    const { courseId, subjectId, moduleId, chapterId, slideId } =
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

            // Automatically go to feedback page if course is 100% completed
            if (completion === 100) {
                setActiveItem(feedbackSlide);
                return;
            }

            if (slideId) {
                const targetSlide = slidesWithFeedback.find(
                    (s) => s.id === slideId
                );
                if (targetSlide) {
                    setActiveItem(targetSlide);
                    return;
                }
            }

            setActiveItem(slidesWithFeedback[0]);
        }
    }, [slides, slideId]);

    const handleSubjectRoute = () => {
        navigate({
            to: "/study-library/courses/course-details/subjects/modules",
            search: { courseId, subjectId, moduleId },
        });
    };

    const handleModuleRoute = () => {
        navigate({
            to: "/study-library/courses/course-details/subjects/modules/chapters",
            search: { courseId, subjectId, moduleId, chapterId },
        });
    };

    const [moduleName, setModuleName] = useState("");
    const [chapterName, setChapterName] = useState("");
    const [subjectName, setSubjectName] = useState("");
    const truncatedChapterName = truncateString(chapterName || "", 12);

    useEffect(() => {
        setModuleName(getModuleName(moduleId, modulesWithChaptersData));
        setChapterName(
            getChapterName(chapterId, modulesWithChaptersData) || ""
        );
        setSubjectName(getSubjectName(subjectId, studyLibraryData) || "");
    }, [modulesWithChaptersData, studyLibraryData]);

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
            <div className="relative h-full bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20">
                {/* Header */}
                <div
                    className="absolute top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 shadow-sm"
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
                                <div
                                    className="flex flex-wrap items-center gap-0.5 sm:gap-1 text-gray-600"
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
                                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-1 sm:px-2 py-0.5 rounded-md">
                                        {open
                                            ? window.innerWidth < 640
                                                ? toTitleCase(chapterName)
                                                : truncatedChapterName
                                            : truncatedChapterName}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Section Title */}
                <div
                    className={`absolute ${showLearningPath ? "top-[70px] sm:top-[85px]" : "top-[10px] sm:top-[12px]"} left-0 right-0 z-20 flex items-center space-x-1 sm:space-x-2 p-2 sm:p-3 md:p-4 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 to-white/80`}
                >
                    <div className="p-1 sm:p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-md shadow-sm">
                        <GraduationCap
                            size={14}
                            className="sm:w-4 sm:h-4 text-primary-600"
                            weight="duotone"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {getTerminology(
                                ContentTerms.Chapters,
                                SystemTerms.Chapters
                            ).toLocaleLowerCase()}{" "}
                            {getTerminology(
                                ContentTerms.Slides,
                                SystemTerms.Slides
                            ).toLocaleLowerCase()}
                        </h3>
                        <p className="text-xs text-gray-600">
                            Interactive learning materials
                        </p>
                    </div>
                </div>

                {/* Scrollable Slides List */}
                <div
                    className={`absolute ${showLearningPath ? "top-[145px]" : "top-[70px]"} bottom-[85px] left-0 right-0 overflow-y-auto`}
                >
                    <div className="relative bg-white transition-all duration-300 group min-h-full">
                        <div className="relative p-3 sm:p-4 animate-fade-in-up">
                            <ChapterSidebarSlides />
                        </div>
                    </div>
                </div>

                {/* Feedback + Progress */}
                {slides && slides.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 shadow-sm">
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
                            <div className="relative p-3 border border-gray-200/60 rounded-md shadow-sm animate-fade-in-up">
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                        <span className="text-xs font-semibold text-gray-700">
                                            {getTerminology(
                                                ContentTerms.Chapters,
                                                SystemTerms.Chapters
                                            ).toLocaleLowerCase()}
                                            Progress
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
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
    const heading = (
        <div className="flex items-center gap-2 sm:gap-3 w-full min-w-0">
            <button
                onClick={() => window.history.back()}
                className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0"
            >
                <CaretLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
            <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1">
                <div className="p-0.5 sm:p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-md shadow-sm flex-shrink-0">
                    <BookOpen
                        size={12}
                        className="sm:w-3.5 sm:h-3.5 text-primary-600"
                        weight="duotone"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    {/* Mobile: Stack vertically, Desktop: Single line */}
                    <div className="block sm:hidden">
                        <h1 className="text-xs font-bold text-gray-900 truncate mb-0.5">
                            {truncateString(
                                toTitleCase(chapterName || "Study Materials"),
                                25
                            )}
                        </h1>
                        <p className="text-xs text-gray-600 truncate">
                            {subjectName && moduleName
                                ? `${truncateString(
                                      toTitleCase(subjectName),
                                      15
                                  )} • ${truncateString(toTitleCase(moduleName), 15)}`
                                : "Learning Path"}
                        </p>
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
                                : "Study Materials"}
                        </h1>
                    </div>
                </div>
            </div>
        </div>
    );

    useEffect(() => {
        setNavHeading(heading);
    }, [subjectName, moduleName, chapterName]);

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
            // Fallback: hide the first MyButton in footer if selector unsupported
            const footer = document.getElementById("slides-side-footer");
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
