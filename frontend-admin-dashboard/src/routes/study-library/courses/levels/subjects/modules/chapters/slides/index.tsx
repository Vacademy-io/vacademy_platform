import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { SlideMaterial } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-components/slide-material';
import { ChapterSidebarAddButton } from './-components/slides-sidebar/slides-sidebar-add-button';
import { ChapterSidebarSlides } from './-components/slides-sidebar/slides-sidebar-slides';
import { studyLibrarySteps } from '@/constants/intro/steps';
import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
import {
    Slide,
    slideOrderPayloadType,
    useSlides,
} from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides';
import useIntroJsTour from '@/hooks/use-intro';
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider';
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { useChapterName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getChapterNameById';
import { getModuleName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getModuleNameById';
import { getSubjectName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getSubjectNameById';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useNavigate } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { CaretLeft } from 'phosphor-react';
import { useEffect, useRef, useState } from 'react';
import { SaveDraftProvider } from './-context/saveDraftContext';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';

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
    '/study-library/courses/levels/subjects/modules/chapters/slides/'
)({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): ChapterSearchParams => {
        return {
            courseId: search.courseId as string,
            levelId: search.levelId as string,
            subjectId: search.subjectId as string,
            moduleId: search.moduleId as string,
            chapterId: search.chapterId as string,
            slideId: search.slideId as string,
            sessionId: search.sessionId as string,
        };
    },
});

function RouteComponent() {
    const { courseId, subjectId, levelId, moduleId, chapterId, sessionId } = Route.useSearch();
    const { studyLibraryData } = useStudyLibraryStore();
    const { modulesWithChaptersData } = useModulesWithChaptersStore();
    const navigate = useNavigate();
    const { activeItem } = useContentStore();
    const [subjectName, setSubjectName] = useState('');
    const [moduleName, setModuleName] = useState('');
    const chapterName = useChapterName(chapterId);
    const { updateSlideOrder } = useSlides(chapterId);

    useIntroJsTour({
        key: StudyLibraryIntroKey.addSlidesStep,
        steps: studyLibrarySteps.addSlidesStep,
    });

    const handleSubjectRoute = () => {
        navigate({
            to: '/study-library/courses/levels/subjects/modules',
            params: {},
            search: {
                courseId: courseId,
                levelId: levelId,
                subjectId: subjectId,
                sessionId: sessionId,
            },
            hash: '',
        });
    };

    const handleModuleRoute = () => {
        navigate({
            to: '/study-library/courses/levels/subjects/modules/chapters',
            params: {},
            search: {
                courseId: courseId,
                levelId: levelId,
                subjectId: subjectId,
                moduleId: moduleId,
                sessionId: sessionId,
            },
            hash: '',
        });
    };

    const handleSlideOrderChange = async (slideOrderPayload: slideOrderPayloadType) => {
        try {
            await updateSlideOrder({
                chapterId: chapterId,
                slideOrderPayload: slideOrderPayload,
            });
        } catch (error) {
            console.log('error updating slide order: ', error);
        }
    };

    useEffect(() => {
        setSubjectName(getSubjectName(subjectId || ''));
        setModuleName(getModuleName(moduleId || ''));
    }, [studyLibraryData, modulesWithChaptersData]);

    const SidebarComponent = (
        <div className="flex w-full flex-col items-center">
            <div className={`flex w-full flex-col gap-6 px-3 pb-3 `}>
                <div className="flex flex-wrap items-center gap-1 text-neutral-500">
                    <p onClick={handleSubjectRoute}>{subjectName}</p>
                    <ChevronRightIcon className={`size-4 `} />
                    <p onClick={handleModuleRoute}>{moduleName}</p>
                    <ChevronRightIcon className={`size-4 `} />
                    <p className="cursor-pointer text-primary-500">{chapterName}</p>
                </div>
                <div className="flex w-full flex-col items-center gap-6 pb-10">
                    <ChapterSidebarSlides handleSlideOrderChange={handleSlideOrderChange} />
                </div>
            </div>
            <div className="fixed bottom-0 flex w-[280px] items-center justify-center bg-primary-50 pb-3">
                <ChapterSidebarAddButton />
            </div>
        </div>
    );

    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        navigate({
            to: '/study-library/courses/levels/subjects/modules/chapters/slides',
            search: {
                courseId,
                levelId,
                subjectId,
                moduleId,
                chapterId,
                slideId: activeItem?.id || '',
                sessionId: sessionId,
            },
            replace: true,
        });
    }, [activeItem]);

    const handleBackClick = () => {
        navigate({
            to: `/study-library/courses/levels/subjects/modules/chapters`,
            search: {
                courseId,
                levelId,
                subjectId,
                moduleId,
                sessionId: sessionId,
            },
        });
    };

    const heading = (
        <div className="flex items-center gap-4">
            <CaretLeft onClick={handleBackClick} className="cursor-pointer" />
            <div>{`${chapterName || ''} Slides`}</div>
        </div>
    );

    useEffect(() => {
        setNavHeading(heading);
    }, []);

    const getCurrentEditorHTMLContentRef = useRef<() => string>(() => '');
    const saveDraftRef = useRef(async (slide: Slide) => {
        console.log('slide for saving draft: ', slide);
    });

    return (
        <SaveDraftProvider
            getCurrentEditorHTMLContent={() => getCurrentEditorHTMLContentRef.current()}
            saveDraft={(slide) => saveDraftRef.current(slide)}
        >
            <LayoutContainer
                internalSidebarComponent={SidebarComponent}
                hasInternalSidebarComponent={true}
            >
                <InitStudyLibraryProvider>
                    <ModulesWithChaptersProvider>
                        <SlideMaterial
                            setGetCurrentEditorHTMLContent={(fn) =>
                                (getCurrentEditorHTMLContentRef.current = fn)
                            }
                            setSaveDraft={(fn) => (saveDraftRef.current = fn)}
                        />
                    </ModulesWithChaptersProvider>
                </InitStudyLibraryProvider>
            </LayoutContainer>
        </SaveDraftProvider>
    );
}
