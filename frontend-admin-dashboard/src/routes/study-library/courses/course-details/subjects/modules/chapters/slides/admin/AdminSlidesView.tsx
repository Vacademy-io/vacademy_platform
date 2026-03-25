import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { ChapterSidebarAddButton } from '../-components/slides-sidebar/slides-sidebar-add-button';
import { ChapterSidebarSlides } from '../-components/slides-sidebar/slides-sidebar-slides';
import { ChapterNavigator } from '../-components/chapter-navigator';
import '../slides-sidebar-scrollbar.css';
// import { studyLibrarySteps } from '@/constants/intro/steps';
// import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
import {
    Slide,
    slideOrderPayloadType,
    useSlidesMutations,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';
// import useIntroJsTour from '@/hooks/use-intro';
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider';
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useChapterName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getChapterNameById';
import { getModuleName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getModuleNameById';
import { getSubjectName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getSubjectNameById';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { CaretLeft } from '@phosphor-icons/react';
import React, { useEffect, useRef, useState, useMemo, useCallback, Suspense } from 'react';
import { SaveDraftProvider } from '../-context/saveDraftContext';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';
import { SidebarProvider } from '@/components/ui/sidebar';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useLearnerViewStore } from '../-stores/learner-view-store';
import { Eye, UserGear } from '@phosphor-icons/react';

const SlideMaterial = React.lazy(() =>
    import(
        '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-material'
    ).then((module) => ({ default: module.SlideMaterial }))
);

interface AdminSlidesViewProps {
    courseId: string;
    levelId: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
    sessionId: string;
    timestamp?: number;
    currentPage?: number;
}

export function AdminSlidesView({
    chapterId,
    courseId,
    levelId,
    subjectId,
    moduleId,
    sessionId,
}: AdminSlidesViewProps) {
    const navigate = useNavigate();
    const { studyLibraryData } = useStudyLibraryStore();
    const { modulesWithChaptersData } = useModulesWithChaptersStore();
    const [subjectName, setSubjectName] = useState('');
    const [moduleName, setModuleName] = useState('');
    const chapterName = useChapterName(chapterId);
    const { updateSlideOrder } = useSlidesMutations(chapterId);
    const { setNavHeading } = useNavHeadingStore();

    // useIntroJsTour({
    //     key: StudyLibraryIntroKey.addSlidesStep,
    //     steps: studyLibrarySteps.addSlidesStep,
    // });

    const handleSubjectRoute = useCallback(() => {
        navigate({
            to: '/study-library/courses/course-details/subjects/modules',
            params: {},
            search: {
                courseId: courseId,
                levelId: levelId,
                subjectId: subjectId,
                sessionId: sessionId,
            },
            hash: '',
        });
    }, [courseId, levelId, subjectId, sessionId, navigate]);

    const handleModuleRoute = useCallback(() => {
        navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters',
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
    }, [courseId, levelId, subjectId, moduleId, sessionId, navigate]);

    const handleSlideOrderChange = useCallback(
        async (slideOrderPayload: slideOrderPayloadType) => {
            try {
                await updateSlideOrder({
                    chapterId: chapterId,
                    slideOrderPayload: slideOrderPayload,
                });
            } catch (error) {
                console.log('error updating slide order: ', error);
            }
        },
        [chapterId, updateSlideOrder]
    );

    useEffect(() => {
        setSubjectName(getSubjectName(subjectId || ''));
        setModuleName(getModuleName(moduleId || ''));
    }, [studyLibraryData, modulesWithChaptersData, subjectId, moduleId]);

    const heading = useMemo(
        () => (
            <div className="flex items-center gap-4">
                <CaretLeft onClick={() => window.history.back()} className="cursor-pointer" />
                <div>{`${chapterName || ''} ${getTerminology(
                    ContentTerms.Slides,
                    SystemTerms.Slides
                )}s`}</div>
            </div>
        ),
        [chapterName]
    );

    // Learner View Toggle Switch Component
    const LearnerViewToggle = () => {
        const { isLearnerView, toggleLearnerView } = useLearnerViewStore();

        return (
            <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-neutral-600">
                    <UserGear className="size-4" />
                </span>

                <button
                    onClick={toggleLearnerView}
                    className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                        ${isLearnerView ? 'bg-primary-500' : 'bg-neutral-300'}
                    `}
                    title={isLearnerView ? 'Switch to Instructor View' : 'Switch to Learner View'}
                >
                    <span
                        className={`
                            flex size-4 items-center justify-center rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out
                            ${isLearnerView ? 'translate-x-6' : 'translate-x-1'}
                        `}
                    >
                        {isLearnerView ? (
                            <Eye className="size-2.5 text-primary-600" />
                        ) : (
                            <UserGear className="size-2.5 text-neutral-600" />
                        )}
                    </span>
                </button>

                <span className="text-xs font-medium text-neutral-600">
                    <Eye className="size-4" />
                </span>
            </div>
        );
    };

    const { isLearnerView } = useLearnerViewStore();

    const SidebarComponent = useMemo(
        () => (
            <div className="flex size-full flex-col items-center">
                {/* Unified Header Section with Learner View Toggle and Breadcrumb */}
                <div className="to-primary-25 -mt-10 flex w-full flex-col border-b border-primary-100 bg-gradient-to-b from-primary-50 shadow-sm">
                    {/* Learner View Toggle */}
                    <div className="flex w-full justify-center px-3 pb-2 pt-3">
                        <LearnerViewToggle />
                    </div>

                    {/* Enhanced Breadcrumb */}
                    {(() => {
                        const isSubjectDefault =
                            subjectName?.toLowerCase() === 'default' || !subjectName;
                        const isModuleDefault =
                            moduleName?.toLowerCase() === 'default' || !moduleName;
                        const isChapterDefault =
                            chapterName?.toLowerCase() === 'default' || !chapterName;

                        // Don't show breadcrumb if all three are default
                        if (isSubjectDefault && isModuleDefault && isChapterDefault) {
                            return null;
                        }

                        const breadcrumbItems = [];

                        // Add subject if not default
                        if (!isSubjectDefault) {
                            breadcrumbItems.push(
                                <div
                                    key="subject"
                                    onClick={handleSubjectRoute}
                                    className="group flex cursor-pointer items-center"
                                >
                                    <span className="truncate text-sm font-medium text-neutral-600 transition-colors duration-200 group-hover:text-primary-600">
                                        {subjectName}
                                    </span>
                                </div>
                            );
                        }

                        // Add first chevron if subject is not default and module is not default
                        if (!isSubjectDefault && !isModuleDefault) {
                            breadcrumbItems.push(
                                <ChevronRight
                                    key="chevron1"
                                    className="size-3.5 shrink-0 text-neutral-400"
                                />
                            );
                        }

                        // Add module if not default
                        if (!isModuleDefault) {
                            breadcrumbItems.push(
                                <div
                                    key="module"
                                    onClick={handleModuleRoute}
                                    className="group flex cursor-pointer items-center"
                                >
                                    <span className="truncate text-sm font-medium text-neutral-600 transition-colors duration-200 group-hover:text-primary-600">
                                        {moduleName}
                                    </span>
                                </div>
                            );
                        }

                        // Add second chevron if module is not default and chapter is not default
                        if (!isModuleDefault && !isChapterDefault) {
                            breadcrumbItems.push(
                                <ChevronRight
                                    key="chevron2"
                                    className="size-3.5 shrink-0 text-neutral-400"
                                />
                            );
                        }

                        // Add chapter if not default
                        if (!isChapterDefault) {
                            breadcrumbItems.push(
                                <div key="chapter" className="flex items-center">
                                    <span className="truncate rounded-md bg-primary-100/50 px-2 py-1 text-sm font-semibold text-primary-700">
                                        {chapterName}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div className="flex w-full px-3 pb-3">
                                <div className="flex w-full flex-wrap items-center gap-2">
                                    {breadcrumbItems}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Chapter Navigator */}
                <div className="w-full border-b border-primary-100 bg-white/50 p-2">
                    <ChapterNavigator
                        currentChapterId={chapterId}
                        currentModuleId={moduleId}
                        courseId={courseId}
                        levelId={levelId}
                        subjectId={subjectId}
                        sessionId={sessionId}
                    />
                </div>

                <div className={`flex w-full flex-1 flex-col gap-4 px-3 pb-3 pt-4`}>
                    <div className="flex w-full flex-col items-center gap-6 pb-10">
                        <ChapterSidebarSlides handleSlideOrderChange={handleSlideOrderChange} />
                    </div>
                </div>
                {!isLearnerView && (
                    <div className="fixed bottom-0 flex w-[280px] items-center justify-center bg-primary-50 pb-3">
                        <ChapterSidebarAddButton />
                    </div>
                )}
            </div>
        ),
        [
            subjectName,
            moduleName,
            chapterName,
            handleSubjectRoute,
            handleModuleRoute,
            handleSlideOrderChange,
            isLearnerView,
            chapterId,
            moduleId,
            courseId,
            levelId,
            subjectId,
            sessionId,
        ]
    );

    useEffect(() => {
        setNavHeading(heading);
    }, [heading, setNavHeading]);

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
                <InitStudyLibraryProvider courseId={courseId}>
                    <ModulesWithChaptersProvider>
                        <SidebarProvider defaultOpen={false}>
                            <Suspense
                                fallback={<div className="size-full animate-pulse bg-gray-100" />}
                            >
                                <SlideMaterial
                                    setGetCurrentEditorHTMLContent={(fn) =>
                                        (getCurrentEditorHTMLContentRef.current = fn)
                                    }
                                    setSaveDraft={(fn) => (saveDraftRef.current = fn)}
                                    isLearnerView={isLearnerView}
                                    hidePublishButtons={false}
                                    // No customSaveFunction - use default admin behavior
                                />
                            </Suspense>
                        </SidebarProvider>
                    </ModulesWithChaptersProvider>
                </InitStudyLibraryProvider>
            </LayoutContainer>
        </SaveDraftProvider>
    );
}
