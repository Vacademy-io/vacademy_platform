import { LayoutContainer } from '@/components/common/layout-container/layout-container'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import {  SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { useEffect, useState } from 'react'
import { truncateString } from '@/lib/reusable/truncateString'
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore'
import { CaretLeft, CaretRight } from 'phosphor-react'
import { BookOpenText, Notebook, FileText, ChartBar } from '@phosphor-icons/react'
import { SlideMaterial } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/slide-material'
import { ChapterSidebarSlides, calculateOverallCompletion } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides'
import { getModuleName } from '@/utils/study-library/get-name-by-id/getModuleNameById'
import { getSubjectName } from '@/utils/study-library/get-name-by-id/getSubjectNameById'
import { getChapterName } from '@/utils/study-library/get-name-by-id/getChapterById'
import { useContentStore } from '@/stores/study-library/chapter-sidebar-store'
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider'
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider'
import { useSlides, Slide } from '@/hooks/study-library/use-slides'
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store'
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store'

interface ChapterSearchParams {
  subjectId: string
  moduleId: string
  chapterId: string
  slideId: string
}

export const Route = createFileRoute(
  '/study-library/courses/levels/subjects/modules/chapters/slides/',
)({
  component: Slides,
  validateSearch: (search: Record<string, unknown>): ChapterSearchParams => {
    return {
      subjectId: search.subjectId as string,
      moduleId: search.moduleId as string,
      chapterId: search.chapterId as string,
      slideId: search.slideId as string,
    }
  },
})

function Slides() {
  const {subjectId, moduleId, chapterId, slideId} = Route.useSearch();
  const { open,  } = useSidebar();
  const navigate = useNavigate();
  const { setItems, activeItem, setActiveItem } = useContentStore();
  const { slides } = useSlides(chapterId || "");
  const {studyLibraryData} = useStudyLibraryStore();
  const {modulesWithChaptersData} = useModulesWithChaptersStore();

  // Calculate overall completion percentage
  const overallCompletion = calculateOverallCompletion(slides || []);

  useEffect(() => {
    if (slides?.length) {
        setItems(slides);

        // If we have a slideId in URL, find that slide
        if (slideId) {
            const targetSlide: Slide | null = slides.find(
                (slide: Slide) => slide.id === slideId,
            );
            if (targetSlide) {
                setActiveItem(targetSlide);
                return;
            }
        }

        // If no slideId or slide not found, set first slide as active
        setActiveItem(slides[0]);
    }
}, [slides, slideId]);

  const handleSubjectRoute = () => {
      navigate({
          to: "/study-library/courses/levels/subjects/modules",
          params: {},
          search: {
              subjectId: subjectId,
          },
          hash: "",
      });
  };

  const handleModuleRoute = () => {
      navigate({
          to: "/study-library/courses/levels/subjects/modules/chapters",
          params: {},
          search: {
              subjectId: subjectId,
              moduleId: moduleId,
          },
          hash: "",
      });
  };

 const [moduleName, setModuleName] = useState("");
 const [chapterName, setChapterName] = useState("");
 const [subjectName, setSubjectName] = useState("");

  const trucatedChapterName = truncateString(chapterName || "", 9);

  useEffect(()=>{
    setModuleName(getModuleName(moduleId, modulesWithChaptersData));
    setChapterName(getChapterName(chapterId, modulesWithChaptersData) || "");
    setSubjectName(getSubjectName(subjectId, studyLibraryData) || "");
  }, [modulesWithChaptersData, studyLibraryData])


  const SidebarComponent = (
      <div className="flex w-full flex-col">
          <div className="flex w-full flex-col gap-2 px-1">
              {/* Modern Breadcrumb Navigation */}
              <div className="pt-2 pb-2 border-b border-gray-100/80 bg-gradient-to-r from-gray-50/50 to-white/50 -mx-1 px-2 rounded-t-lg">
                  <div className="flex flex-col gap-2">
                      {/* Header */}
                      <div className="flex items-center gap-1">
                          <div className="p-0.5 bg-primary-100 rounded">
                              <FileText className="w-2.5 h-2.5 text-primary-600" weight="duotone" />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">Navigation</span>
                      </div>
                      
                      {/* Breadcrumb Trail */}
                      <div className={`flex items-center gap-0.5 transition-all duration-300 ${open ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
                          {/* Subject */}
                          <button
                              onClick={handleSubjectRoute}
                              className="group flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/60 border border-gray-200/60 hover:bg-primary-50 hover:border-primary-200 transition-all duration-200 text-xs font-medium text-gray-700 hover:text-primary-700 max-w-[70px]"
                          >
                              <BookOpenText className="w-2.5 h-2.5 flex-shrink-0" weight="duotone" />
                              <span className="truncate">{subjectName}</span>
                          </button>

                          {/* Separator */}
                          <CaretRight className="w-2.5 h-2.5 text-gray-400" weight="bold" />

                          {/* Module */}
                          <button
                              onClick={handleModuleRoute}
                              className="group flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/60 border border-gray-200/60 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200 text-xs font-medium text-gray-700 hover:text-blue-700 max-w-[70px]"
                          >
                              <Notebook className="w-2.5 h-2.5 flex-shrink-0" weight="duotone" />
                              <span className="truncate">{moduleName}</span>
                          </button>

                          {/* Separator */}
                          <CaretRight className="w-2.5 h-2.5 text-gray-400" weight="bold" />

                          {/* Chapter (Current) */}
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-primary-100 to-primary-200 border border-primary-300/50 text-xs font-semibold text-primary-800 max-w-[90px]">
                              <FileText className="w-2.5 h-2.5 flex-shrink-0" weight="duotone" />
                              <span className="truncate">{chapterName}</span>
                          </div>
                      </div>

                      {/* Collapsed breadcrumb for closed sidebar */}
                      <div className={`flex items-center justify-center transition-all duration-300 ${!open ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-primary-100 to-primary-200 border border-primary-300/50">
                              <FileText className="w-2.5 h-2.5 text-primary-600" weight="duotone" />
                              <span className="text-xs font-semibold text-primary-800 truncate max-w-[50px]">
                                  {trucatedChapterName}
                              </span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Compact Chapter Progress */}
              {slides && slides.length > 0 && (
                  <div className="px-2 -mx-1">
                      <div className="bg-gradient-to-r from-slate-50/30 to-white/30 border border-slate-200/40 rounded-lg p-2">
                          <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                  <div className="p-0.5 bg-primary-100/60 rounded">
                                      <ChartBar className="w-2 h-2 text-primary-600" weight="duotone" />
                                  </div>
                                  <span className="text-xs font-medium text-slate-600">Progress</span>
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                  <div className="flex-1 relative h-1 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${
                                              overallCompletion >= 80
                                                  ? "bg-gradient-to-r from-green-400 to-green-500"
                                                  : overallCompletion >= 50
                                                      ? "bg-gradient-to-r from-primary-400 to-primary-600"
                                                      : "bg-gradient-to-r from-blue-400 to-blue-500"
                                          }`}
                                          style={{
                                              width: `${Math.min(overallCompletion, 100)}%`,
                                          }}
                                      />
                                  </div>
                                  <span className={`text-xs font-bold min-w-[28px] text-right ${
                                      overallCompletion >= 80 
                                          ? "text-green-600" 
                                          : overallCompletion >= 50 
                                              ? "text-primary-600" 
                                              : "text-slate-600"
                                  }`}>
                                      {overallCompletion}%
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
              
              {/* Slides Container */}
              <div className="flex w-full flex-col">
                  <ChapterSidebarSlides />
              </div>
          </div>
      </div>
  );

  const { setNavHeading } = useNavHeadingStore();

  useEffect(() => {
    navigate({
        to: "/study-library/courses/levels/subjects/modules/chapters/slides",
        search: {
            subjectId,
            moduleId,
            chapterId,
            slideId: activeItem?.id || "",
        },
        replace: true,
    });
}, [activeItem]);


  const handleBackClick = () => {
      navigate({
          to: `/study-library/courses/levels/subjects/modules/chapters`,
          search: {
              subjectId,
              moduleId,
          },
      });
  };

  const heading = (
      <div className="flex items-center gap-4">
          <CaretLeft onClick={handleBackClick} className="cursor-pointer" />
          <div>{`${subjectName}`}</div>
      </div>
  );

  useEffect(() => {
      setNavHeading(heading);
  }, [subjectName]);

  return (
    <LayoutContainer sidebarComponent={SidebarComponent} className='md:my-0 md:mx-6'>
        <InitStudyLibraryProvider>
            <ModulesWithChaptersProvider subjectId={subjectId}>
                <SidebarProvider defaultOpen={false}>
                    <SlideMaterial />
                </SidebarProvider>
            </ModulesWithChaptersProvider>
      </InitStudyLibraryProvider>
    </LayoutContainer>
  )
}
