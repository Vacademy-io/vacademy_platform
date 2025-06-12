import { LayoutContainer } from '@/components/common/layout-container/layout-container'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRightIcon } from '@radix-ui/react-icons'
import {  useSidebar } from '@/components/ui/sidebar'
import { useEffect } from 'react'
import { truncateString } from '@/lib/reusable/truncateString'
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore'
import { CaretLeft } from 'phosphor-react'
import { SlideMaterial } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/slide-material'
import { ChapterSidebarSlides } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides'
import { getModuleName } from '@/utils/study-library/get-name-by-id/getModuleNameById'
import { getSubjectName } from '@/utils/study-library/get-name-by-id/getSubjectNameById'
import { getChapterName } from '@/utils/study-library/get-name-by-id/getChapterById'
import { useContentStore } from '@/stores/study-library/chapter-sidebar-store'
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider'
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider'
import { useSlides, Slide } from '@/hooks/study-library/use-slides'

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

 

  const subjectName = getSubjectName(subjectId);
  const moduleName = getModuleName(moduleId);
  const chapterName = getChapterName(chapterId);
  const trucatedChapterName = truncateString(chapterName || "", 9);


  const SidebarComponent = (
      <div className="flex w-full flex-col items-center">
          <div className={`flex w-full flex-col gap-6 ${open ? "px-6" : "px-6"} -mt-10`}>
              <div className="flex flex-wrap items-center gap-1 text-neutral-500">
                  <p
                      className={`cursor-pointer ${open ? "visible" : "hidden"}`}
                      onClick={handleSubjectRoute}
                  >
                      {subjectName}
                  </p>
                  <ChevronRightIcon className={`size-4 ${open ? "visible" : "hidden"}`} />
                  <p
                      className={`cursor-pointer ${open ? "visible" : "hidden"}`}
                      onClick={handleModuleRoute}
                  >
                      {moduleName}
                  </p>
                  <ChevronRightIcon className={`size-4 ${open ? "visible" : "hidden"}`} />
                  <p className="cursor-pointer text-primary-500">
                      {open ? chapterName : trucatedChapterName}
                  </p>
              </div>
              <div className="flex w-full flex-col items-center gap-6">
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
  }, []);

  return (
    <LayoutContainer sidebarComponent={SidebarComponent}>
        <InitStudyLibraryProvider>
            <ModulesWithChaptersProvider subjectId={subjectId}>
                <SlideMaterial />
            </ModulesWithChaptersProvider>
      </InitStudyLibraryProvider>
    </LayoutContainer>
  )
}
