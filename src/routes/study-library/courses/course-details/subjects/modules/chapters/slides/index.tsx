import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { truncateString } from "@/lib/reusable/truncateString";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
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

interface ChapterSearchParams {
  courseId: string;
  levelId: string;
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
    levelId: search.levelId as string,
    subjectId: search.subjectId as string,
    moduleId: search.moduleId as string,
    chapterId: search.chapterId as string,
    slideId: search.slideId as string,
    sessionId: search.sessionId as string,
  }),
});

function Slides() {
  const {
    courseId,
    levelId,
    subjectId,
    moduleId,
    chapterId,
    slideId,
    sessionId,
  } = Route.useSearch();

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
        source_type: "FEEDBACK" as any,
        percentage_completed: null,
      };

      const slidesWithFeedback = [...slides, feedbackSlide];
      setItems(slidesWithFeedback);

      if (slideId) {
        const targetSlide = slidesWithFeedback.find((s) => s.id === slideId);
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
      search: { courseId, levelId, subjectId, sessionId },
    });
  };

  const handleModuleRoute = () => {
    navigate({
      to: "/study-library/courses/course-details/subjects/modules/chapters",
      search: { courseId, levelId, subjectId, moduleId, sessionId },
    });
  };

  const [moduleName, setModuleName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const truncatedChapterName = truncateString(chapterName || "", 12);

  useEffect(() => {
    setModuleName(getModuleName(moduleId, modulesWithChaptersData));
    setChapterName(getChapterName(chapterId, modulesWithChaptersData) || "");
    setSubjectName(getSubjectName(subjectId, studyLibraryData) || "");
  }, [modulesWithChaptersData, studyLibraryData]);

  const SidebarComponent = (
    <div className="relative w-full max-w-full h-full">
      <div className="relative h-full bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200/60 shadow-sm">
          <div className={`${open ? "px-3 sm:px-4" : "px-2 sm:px-3"} py-3`}>
            <div className="relative group overflow-hidden animate-fade-in-down">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                  <BookOpen
                    size={14}
                    className="text-primary-600"
                    weight="duotone"
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700">
                  Learning Path
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-gray-600">
                <button
                  className={`text-xs font-medium hover:text-primary-600 ${
                    open ? "block" : "hidden"
                  }`}
                  onClick={handleSubjectRoute}
                >
                  {truncateString(subjectName, open ? 15 : 8)}
                </button>
                <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                <button
                  className={`text-xs font-medium hover:text-primary-600 ${
                    open ? "block" : "hidden"
                  }`}
                  onClick={handleModuleRoute}
                >
                  {truncateString(moduleName, open ? 15 : 8)}
                </button>
                <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                  {open ? chapterName : truncatedChapterName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Title */}
        <div className="absolute top-[85px] left-0 right-0 z-20 flex items-center space-x-2 p-3 sm:p-4 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 to-white/80">
          <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
            <GraduationCap size={16} className="text-primary-600" weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">Chapter Slides</h3>
            <p className="text-xs text-gray-600">Interactive learning materials</p>
          </div>
        </div>

        {/* Scrollable Slides List */}
        <div className="absolute top-[145px] bottom-[85px] left-0 right-0 overflow-y-auto">
          <div className="relative bg-white/80 backdrop-blur-sm transition-all duration-500 group min-h-full">
            <div className="relative p-3 sm:p-4 animate-fade-in-up">
              <ChapterSidebarSlides />
            </div>
          </div>
        </div>

        {/* Feedback + Progress */}
        {slides && slides.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-sm border-t border-gray-200/60 shadow-sm">
            <div className={`${open ? "px-3 sm:px-4" : "px-2 sm:px-3"} pt-3`}>
              {/* Feedback Button */}
              <MyButton
                buttonType="text"
                scale="medium"
                layoutVariant="default"
                onClick={() =>
                  setActiveItem({
                    id: "feedback-slide",
                    title: "Feedback",
                    source_type: "FEEDBACK" as any,
                    percentage_completed: null,
                  })
                }
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

              {/* Progress */}
              <div className="relative p-3 border border-gray-200/60 rounded-lg shadow-sm animate-fade-in-up">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-gray-700">Chapter Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                        style={{ width: `${calculateOverallCompletion(slides)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-primary-600 min-w-[30px]">
                      {calculateOverallCompletion(slides)}%
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
    <div className="flex items-center gap-3">
      <button onClick={() => window.history.back()} className="p-1.5 rounded-lg hover:bg-gray-100">
        <CaretLeft className="w-5 h-5 text-gray-600" />
      </button>
      <div className="flex items-center space-x-2 min-w-0">
        <div className="p-1 bg-gradient-to-br from-primary-100 to-primary-200 rounded-md shadow-sm">
          <BookOpen size={14} className="text-primary-600" weight="duotone" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-gray-900 truncate">
            {subjectName && moduleName && chapterName
              ? `${truncateString(subjectName, 12)} • ${truncateString(moduleName, 12)} • ${truncateString(chapterName, 15)}`
              : "Study Materials"}
          </h1>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    setNavHeading(heading);
  }, [subjectName, moduleName, chapterName]);

  return (
    <LayoutContainer sidebarComponent={SidebarComponent} className="md:my-0 md:mx-3 lg:mx-4">
      <InitStudyLibraryProvider>
        <ModulesWithChaptersProvider subjectId={subjectId}>
          <SidebarProvider defaultOpen={false}>
            {activeItem?.id === "feedback-slide" ? <FeedbackPage /> : <SlideMaterial />}
          </SidebarProvider>
        </ModulesWithChaptersProvider>
      </InitStudyLibraryProvider>
    </LayoutContainer>
  );
}
