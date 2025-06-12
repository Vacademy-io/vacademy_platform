// class-study-material.tsx
import { useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
// Assuming AddSubjectButton, Subjects are correctly handling their own styling including roundness
import { AddSubjectButton } from './add-subject.tsx/add-subject-button';
import { Subjects } from './add-subject.tsx/subjects';
import { useEffect, useState } from 'react';
import { SubjectType, useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useAddSubject } from '@/routes/study-library/courses/levels/subjects/-services/addSubject';
import { useUpdateSubject } from '@/routes/study-library/courses/levels/subjects/-services/updateSubject';
import { useDeleteSubject } from '@/routes/study-library/courses/levels/subjects/-services/deleteSubject';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getCourseSubjects } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getSubjects';
import { useGetPackageSessionId } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionId';
import { useUpdateSubjectOrder } from '@/routes/study-library/courses/levels/subjects/-services/updateSubjectOrder';
import { orderSubjectPayloadType } from '@/routes/study-library/courses/-types/order-payload';
import useIntroJsTour from '@/hooks/use-intro';
import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
import { studyLibrarySteps } from '@/constants/intro/steps';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { tabs, TabType } from '../-constants/constant';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { fetchModulesWithChapters } from '../../../-services/getModulesWithChapters';
import {
    UseSlidesFromModulesInput,
    fetchChaptersWithSlides,
    ChapterWithSlides,
    Slide,
} from '../../../-services/getAllSlides';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';
import { DropdownValueType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { DropdownItemType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { useAddModule } from '@/routes/study-library/courses/levels/subjects/modules/-services/add-module';
// Assuming AddModulesButton and AddChapterButton handle their own styling including roundness
import { AddModulesButton } from '../modules/-components/add-modules.tsx/add-modules-button';
import { AddChapterButton } from '../modules/chapters/-components/chapter-material/add-chapters/add-chapter-button';
import {
    CaretDown,
    CaretRight,
    Plus,
    ArrowSquareOut,
    Folder,
    FileText,
    PresentationChart,
} from 'phosphor-react';
import { getIcon } from '../modules/chapters/slides/-components/slides-sidebar/slides-sidebar-slides';
import { MyButton } from '@/components/design-system/button';
import { useContentStore } from '../modules/chapters/slides/-stores/chapter-sidebar-store';

// Interfaces (assuming these are unchanged)
export interface Chapter {
    id: string;
    chapter_name: string;
    status: string;
    description: string;
    file_id: string | null;
    chapter_order: number;
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
    chapters: ChapterMetadata[];
}
export type SubjectModulesMap = { [subjectId: string]: ModuleWithChapters[] };

export const SubjectMaterial = () => {
    const router = useRouter();
    const searchParams = router.state.location.search;
    const { getSessionFromPackage } = useInstituteDetailsStore();
    const { studyLibraryData } = useStudyLibraryStore();
    const { setActiveItem } = useContentStore();

    const courseId: string = searchParams.courseId || '';
    const levelId: string = searchParams.levelId || '';

    const [sessionList, setSessionList] = useState<DropdownItemType[]>(
        searchParams.courseId ? getSessionFromPackage({ courseId: courseId, levelId: levelId }) : []
    );
    const initialSession: DropdownItemType | undefined = {
        id: sessionList[0]?.id || '',
        name: sessionList[0]?.name || '',
    };

    const [currentSession, setCurrentSession] = useState<DropdownItemType | undefined>(
        () => initialSession
    );

    useEffect(() => {
        setSessionList(
            searchParams.courseId
                ? getSessionFromPackage({ courseId: courseId, levelId: searchParams.levelId })
                : []
        );
    }, [searchParams.courseId, searchParams.levelId, getSessionFromPackage]);

    useEffect(() => {
        setCurrentSession({ id: sessionList[0]?.id || '', name: sessionList[0]?.name || '' });
    }, [sessionList]);

    const handleSessionChange = (value: DropdownValueType) => {
        if (value && typeof value === 'object' && 'id' in value && 'name' in value) {
            setCurrentSession(value as DropdownItemType);
        }
    };

    const [selectedTab, setSelectedTab] = useState<string>(TabType.OUTLINE);
    const handleTabChange = (value: string) => setSelectedTab(value);

    const [subjectModulesMap, setSubjectModulesMap] = useState<SubjectModulesMap>({});
    const [chapterSlidesMap, setChapterSlidesMap] = useState<{ [chapterId: string]: Slide[] }>({});

    const addModuleMutation = useAddModule();
    const addSubjectMutation = useAddSubject();
    const updateSubjectMutation = useUpdateSubject();
    const deleteSubjectMutation = useDeleteSubject();
    const updateSubjectOrderMutation = useUpdateSubjectOrder();

    useIntroJsTour({
        key: StudyLibraryIntroKey.addSubjectStep,
        steps: studyLibrarySteps.addSubjectStep,
    });

    const initialSubjects = getCourseSubjects(courseId, currentSession?.id ?? '', levelId);
    const [subjects, setSubjects] = useState(initialSubjects);

    useEffect(() => {
        const newSubjects = getCourseSubjects(courseId, currentSession?.id ?? '', levelId);
        setSubjects(newSubjects);
    }, [currentSession, studyLibraryData, courseId, levelId]);

    const packageSessionIds =
        useGetPackageSessionId(courseId, currentSession?.id ?? '', levelId) || '';

    const useSlidesByChapterMutation = () => {
        return useMutation({
            mutationFn: async ({ modules, packageSessionId }: UseSlidesFromModulesInput) => {
                const chapterSlidesMapUpdate: { [chapterId: string]: Slide[] } = {};
                await Promise.all(
                    modules.map(async (module) => {
                        const chaptersWithSlides = await fetchChaptersWithSlides(
                            module.id,
                            packageSessionId
                        );
                        chaptersWithSlides.forEach((chapterWithSlides: ChapterWithSlides) => {
                            chapterSlidesMapUpdate[chapterWithSlides.chapter.id] =
                                chapterWithSlides.slides;
                        });
                    })
                );
                return chapterSlidesMapUpdate;
            },
        });
    };
    const { mutateAsync: fetchSlides } = useSlidesByChapterMutation();

    const useModulesMutation = () => {
        return useMutation({
            mutationFn: async ({
                subjects: currentSubjects,
                packageSessionIds: currentPackageSessionIds,
            }: {
                subjects: SubjectType[];
                packageSessionIds: string;
            }) => {
                const results = await Promise.all(
                    currentSubjects.map(async (subject) => {
                        const res = await fetchModulesWithChapters(
                            subject.id,
                            currentPackageSessionIds
                        );
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

    const handleAddModule = (subjectId: string, module: Module) => {
        addModuleMutation.mutate(
            { subjectId, module },
            {
                onSuccess: async () => {
                    const updatedSubjects = getCourseSubjects(
                        courseId,
                        currentSession?.id ?? '',
                        levelId
                    );
                    if (updatedSubjects.length > 0 && packageSessionIds) {
                        const updatedModulesMap = await fetchModules({
                            subjects: updatedSubjects,
                            packageSessionIds,
                        });
                        setSubjectModulesMap(updatedModulesMap);
                    }
                    setSubjects(updatedSubjects);
                },
            }
        );
    };

    useEffect(() => {
        const loadModules = async () => {
            if (subjects.length > 0 && packageSessionIds) {
                try {
                    const modulesMap = await fetchModules({ subjects, packageSessionIds });
                    setSubjectModulesMap(modulesMap);
                } catch (error) {
                    console.error('Failed to fetch modules:', error);
                    setSubjectModulesMap({});
                }
            } else {
                setSubjectModulesMap({});
            }
        };
        loadModules();
    }, [subjects, packageSessionIds, fetchModules]);

    useEffect(() => {
        const loadSlides = async () => {
            const allModules: { id: string }[] = Object.values(subjectModulesMap)
                .flat()
                .map((m) => ({ id: m.module.id }));
            if (allModules.length > 0 && packageSessionIds) {
                try {
                    const slideMap = await fetchSlides({
                        modules: allModules,
                        packageSessionId: packageSessionIds,
                    });
                    setChapterSlidesMap(slideMap);
                } catch (error) {
                    console.error('Failed to fetch slides:', error);
                    setChapterSlidesMap({});
                }
            } else {
                setChapterSlidesMap({});
            }
        };
        if (Object.keys(subjectModulesMap).length > 0 && packageSessionIds) {
            loadSlides();
        } else {
            setChapterSlidesMap({});
        }
    }, [subjectModulesMap, packageSessionIds, fetchSlides]);

    const handleAddSubject = async (newSubject: SubjectType) => {
        if (!packageSessionIds) {
            console.error('No package session IDs found');
            return;
        }
        addSubjectMutation.mutate({ subject: newSubject, packageSessionIds });
    };
    const handleDeleteSubject = (subjectId: string) => deleteSubjectMutation.mutate(subjectId);
    const handleEditSubject = (subjectId: string, updatedSubject: SubjectType) =>
        updateSubjectMutation.mutate({ subjectId, updatedSubject });
    const handleSubjectOrderChange = (updatedOrder: orderSubjectPayloadType[]) =>
        updateSubjectOrderMutation.mutate({ orderedSubjects: updatedOrder });

    const navigateTo = (pathname: string, searchParamsObj: Record<string, string | undefined>) =>
        router.navigate({ to: pathname, search: searchParamsObj });
    const handleSubjectNavigation = (subjectId: string) =>
        navigateTo(`${router.state.location.pathname}/modules`, {
            courseId,
            levelId,
            subjectId,
            sessionId: currentSession?.id,
        });
    const handleModuleNavigation = (subjectId: string, moduleId: string) =>
        navigateTo(`${router.state.location.pathname}/modules/chapters`, {
            courseId,
            levelId,
            subjectId,
            moduleId,
            sessionId: currentSession?.id,
        });
    const handleChapterNavigation = (subjectId: string, moduleId: string, chapterId: string) =>
        navigateTo(`${router.state.location.pathname}/modules/chapters/slides`, {
            courseId,
            levelId,
            subjectId,
            moduleId,
            chapterId,
            sessionId: currentSession?.id,
        });
    const handleSlideNavigation = (
        subjectId: string,
        moduleId: string,
        chapterId: string,
        slideId: string
    ) => {
        console.log('slideId: ', slideId);
        setActiveItem({
            id: slideId,
            source_id: '',
            source_type: '',
            title: '',
            image_file_id: '',
            description: '',
            status: '',
            slide_order: 0,
            video_slide: null,
            document_slide: null,
            question_slide: null,
            assignment_slide: null,
            is_loaded: false,
            new_slide: false,
        });

        navigateTo(`${router.state.location.pathname}/modules/chapters/slides`, {
            courseId,
            levelId,
            subjectId,
            moduleId,
            chapterId,
            sessionId: currentSession?.id,
            slideId,
        });
    };

    const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
    const [openModules, setOpenModules] = useState<Set<string>>(new Set());
    const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

    const toggleOpenState = (
        id: string,
        setter: React.Dispatch<React.SetStateAction<Set<string>>>
    ) => {
        setter((prev) => {
            const u = new Set(prev);
            u.has(id) ? u.delete(id) : u.add(id);
            return u;
        });
    };
    const toggleSubject = (id: string) => toggleOpenState(id, setOpenSubjects);
    const toggleModule = (id: string) => toggleOpenState(id, setOpenModules);
    const toggleChapter = (id: string) => toggleOpenState(id, setOpenChapters);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const tabContent: Record<TabType, React.ReactNode> = {
        [TabType.OUTLINE]: (
            <div className="space-y-3">
                <div className="w-full max-w-[260px]">
                    <MyDropdown
                        currentValue={currentSession ?? undefined}
                        dropdownList={sessionList}
                        placeholder="Select Session"
                        handleChange={handleSessionChange}
                    />
                </div>
                <div className="max-w-2xl space-y-2">
                    <AddSubjectButton isTextButton onAddSubject={handleAddSubject} />

                    {subjects.map((subject, idx) => {
                        const isSubjectOpen = openSubjects.has(subject.id);
                        const baseIndent = 'pl-[calc(18px+0.5rem+18px+0.5rem)]';
                        const subjectContentIndent = `${baseIndent} pl-[1.5rem]`;

                        return (
                            <Collapsible
                                key={subject.id}
                                open={isSubjectOpen}
                                onOpenChange={() => toggleSubject(subject.id)}
                            >
                                <CollapsibleTrigger className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {isSubjectOpen ? (
                                            <CaretDown
                                                size={18}
                                                weight="bold"
                                                className="shrink-0 text-gray-500"
                                            />
                                        ) : (
                                            <CaretRight
                                                size={18}
                                                weight="bold"
                                                className="shrink-0 text-gray-500"
                                            />
                                        )}
                                        <Folder size={18} className="text-primary shrink-0" />
                                        <span className="w-6 shrink-0 text-center font-mono text-xs text-gray-500">
                                            S{idx + 1}
                                        </span>
                                        <span className="truncate" title={subject.subject_name}>
                                            {subject.subject_name}
                                        </span>
                                    </div>
                                    <ArrowSquareOut
                                        size={18}
                                        className="hover:text-primary ml-1.5 shrink-0 cursor-pointer text-gray-400"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSubjectNavigation(subject.id);
                                        }}
                                    />
                                </CollapsibleTrigger>
                                <CollapsibleContent
                                    className={`pb-0.5 pt-1 ${subjectContentIndent}`}
                                >
                                    <div className="space-y-1 border-l border-gray-200 pl-2.5">
                                        <AddModulesButton
                                            isTextButton
                                            subjectId={subject.id}
                                            onAddModuleBySubjectId={handleAddModule}
                                        />
                                        {(subjectModulesMap[subject.id] ?? []).map(
                                            (mod, modIdx) => {
                                                const isModuleOpen = openModules.has(mod.module.id);
                                                const moduleContentIndent = `pl-[calc(16px+0.5rem+16px+0.5rem+1.5rem)]`;

                                                return (
                                                    <Collapsible
                                                        key={mod.module.id}
                                                        open={isModuleOpen}
                                                        onOpenChange={() =>
                                                            toggleModule(mod.module.id)
                                                        }
                                                    >
                                                        <CollapsibleTrigger className="flex w-full items-center rounded-md px-2 py-1 text-left text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                {isModuleOpen ? (
                                                                    <CaretDown
                                                                        size={16}
                                                                        className="shrink-0 text-gray-500"
                                                                    />
                                                                ) : (
                                                                    <CaretRight
                                                                        size={16}
                                                                        className="shrink-0 text-gray-500"
                                                                    />
                                                                )}
                                                                <FileText
                                                                    size={16}
                                                                    className="shrink-0 text-blue-600"
                                                                />
                                                                <span className="w-6 shrink-0 text-center font-mono text-xs text-gray-500">
                                                                    M{modIdx + 1}
                                                                </span>
                                                                <span
                                                                    className="truncate"
                                                                    title={mod.module.module_name}
                                                                >
                                                                    {mod.module.module_name}
                                                                </span>
                                                            </div>
                                                            <ArrowSquareOut
                                                                size={16}
                                                                className="hover:text-primary ml-1.5 shrink-0 cursor-pointer text-gray-400"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleModuleNavigation(
                                                                        subject.id,
                                                                        mod.module.id
                                                                    );
                                                                }}
                                                            />
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent
                                                            className={`py-0.5 ${moduleContentIndent}`}
                                                        >
                                                            <div className="space-y-0.5 border-l border-gray-200 pl-2">
                                                                <AddChapterButton
                                                                    moduleId={mod.module.id}
                                                                    sessionId={currentSession?.id}
                                                                    isTextButton
                                                                />
                                                                {(mod.chapters ?? []).map(
                                                                    (ch, chIdx) => {
                                                                        const isChapterOpen =
                                                                            openChapters.has(
                                                                                ch.chapter.id
                                                                            );
                                                                        const chapterContentIndent = `pl-[calc(14px+0.375rem+14px+0.375rem+1.25rem)]`;
                                                                        return (
                                                                            <Collapsible
                                                                                key={ch.chapter.id}
                                                                                open={isChapterOpen}
                                                                                onOpenChange={() =>
                                                                                    toggleChapter(
                                                                                        ch.chapter
                                                                                            .id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <CollapsibleTrigger className="flex w-full items-center rounded-md px-1.5 py-0.5 text-left text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                                                                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                                        {isChapterOpen ? (
                                                                                            <CaretDown
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                className="shrink-0 text-gray-500"
                                                                                            />
                                                                                        ) : (
                                                                                            <CaretRight
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                className="shrink-0 text-gray-500"
                                                                                            />
                                                                                        )}
                                                                                        <PresentationChart
                                                                                            size={
                                                                                                14
                                                                                            }
                                                                                            className="shrink-0 text-green-600"
                                                                                        />
                                                                                        <span className="text-2xs w-5 shrink-0 text-center font-mono text-gray-500">
                                                                                            C
                                                                                            {chIdx +
                                                                                                1}
                                                                                        </span>
                                                                                        <span
                                                                                            className="truncate"
                                                                                            title={
                                                                                                ch
                                                                                                    .chapter
                                                                                                    .chapter_name
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                ch
                                                                                                    .chapter
                                                                                                    .chapter_name
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                    <ArrowSquareOut
                                                                                        size={14}
                                                                                        className="hover:text-primary ml-1 shrink-0 cursor-pointer text-gray-400"
                                                                                        onClick={(
                                                                                            e
                                                                                        ) => {
                                                                                            e.stopPropagation();
                                                                                            handleChapterNavigation(
                                                                                                subject.id,
                                                                                                mod
                                                                                                    .module
                                                                                                    .id,
                                                                                                ch
                                                                                                    .chapter
                                                                                                    .id
                                                                                            );
                                                                                        }}
                                                                                    />
                                                                                </CollapsibleTrigger>
                                                                                <CollapsibleContent
                                                                                    className={`py-0.5 ${chapterContentIndent}`}
                                                                                >
                                                                                    <div className="space-y-px border-l border-gray-200 py-1 pl-1.5">
                                                                                        <MyButton
                                                                                            buttonType="text"
                                                                                            onClick={(
                                                                                                e
                                                                                            ) => {
                                                                                                e.stopPropagation();
                                                                                                handleChapterNavigation(
                                                                                                    subject.id,
                                                                                                    mod
                                                                                                        .module
                                                                                                        .id,
                                                                                                    ch
                                                                                                        .chapter
                                                                                                        .id
                                                                                                );
                                                                                            }}
                                                                                            className="!m-0 flex w-fit cursor-pointer flex-row items-center justify-start gap-2 px-0 pl-2 text-primary-500"
                                                                                        >
                                                                                            <Plus
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                weight="bold"
                                                                                                className="text-primary-600 group-hover:text-primary-700"
                                                                                            />
                                                                                            <span className="font-medium">
                                                                                                Add
                                                                                                Slide
                                                                                            </span>
                                                                                        </MyButton>

                                                                                        {(
                                                                                            chapterSlidesMap[
                                                                                                ch
                                                                                                    .chapter
                                                                                                    .id
                                                                                            ] ?? []
                                                                                        ).length ===
                                                                                        0 ? (
                                                                                            <div className="text-2xs px-1 py-0.5 text-gray-400">
                                                                                                No
                                                                                                slides
                                                                                                in
                                                                                                this
                                                                                                chapter.
                                                                                            </div>
                                                                                        ) : (
                                                                                            (
                                                                                                chapterSlidesMap[
                                                                                                    ch
                                                                                                        .chapter
                                                                                                        .id
                                                                                                ] ??
                                                                                                []
                                                                                            ).map(
                                                                                                (
                                                                                                    slide,
                                                                                                    sIdx
                                                                                                ) => (
                                                                                                    <div
                                                                                                        key={
                                                                                                            slide.id
                                                                                                        }
                                                                                                        className="flex cursor-pointer items-center gap-1 px-1 py-px text-xs text-gray-500"
                                                                                                        onClick={() => {
                                                                                                            handleSlideNavigation(
                                                                                                                subject.id,
                                                                                                                mod
                                                                                                                    .module
                                                                                                                    .id,
                                                                                                                ch
                                                                                                                    .chapter
                                                                                                                    .id,
                                                                                                                slide.id
                                                                                                            );
                                                                                                        }}
                                                                                                    >
                                                                                                        <span className="w-5 shrink-0 text-center font-mono text-gray-400">
                                                                                                            S
                                                                                                            {sIdx +
                                                                                                                1}
                                                                                                        </span>
                                                                                                        {getIcon(
                                                                                                            slide.source_type,
                                                                                                            slide
                                                                                                                .document_slide
                                                                                                                ?.type,
                                                                                                            '3'
                                                                                                        )}
                                                                                                        <span
                                                                                                            className="truncate"
                                                                                                            title={
                                                                                                                slide.title
                                                                                                            }
                                                                                                        >
                                                                                                            {
                                                                                                                slide.title
                                                                                                            }
                                                                                                        </span>
                                                                                                    </div>
                                                                                                )
                                                                                            )
                                                                                        )}
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
                                            }
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                    {subjects.length === 0 && (
                        <div className="rounded-md bg-gray-100 py-4 text-center text-sm text-gray-500">
                            No subjects available. Start by adding a subject.
                        </div>
                    )}
                </div>
            </div>
        ),
        [TabType.SUBJECTS]: (
            <div className="space-y-3">
                <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
                    <div className="flex-1">
                        <h2 className="text-md font-semibold text-gray-800">
                            Manage Batch Subjects
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Explore, manage, and organize resources for the batch.
                        </p>
                    </div>
                    <AddSubjectButton onAddSubject={handleAddSubject} />
                </div>
                <div className="w-full max-w-[260px]">
                    <MyDropdown
                        currentValue={currentSession ?? undefined}
                        dropdownList={sessionList}
                        placeholder="Select Session"
                        handleChange={handleSessionChange}
                    />
                </div>
                <Subjects
                    subjects={subjects}
                    onDeleteSubject={handleDeleteSubject}
                    onEditSubject={handleEditSubject}
                    packageSessionIds={packageSessionIds}
                    onOrderChange={handleSubjectOrderChange}
                />
            </div>
        ),
        [TabType.STUDENT]: (
            <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
                Student content coming soon.
            </div>
        ),
        [TabType.TEACHERS]: (
            <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
                Teachers content coming soon.
            </div>
        ),
        [TabType.ASSESSMENT]: (
            <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
                Assessment content coming soon.
            </div>
        ),
    };

    if (courseId === '' || levelId === '') {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
                    <h2 className="mb-1.5 text-lg font-semibold text-red-600">
                        Missing Information
                    </h2>
                    <p className="text-sm text-gray-600">
                        Course ID or Level ID is missing. Please ensure these are provided to
                        proceed.
                    </p>
                </div>
            </div>
        );
    }

    const isLoading =
        addSubjectMutation.isPending ||
        deleteSubjectMutation.isPending ||
        updateSubjectMutation.isPending ||
        updateSubjectOrderMutation.isPending;

    return isLoading ? (
        <DashboardLoader />
    ) : (
        <div className="flex size-full flex-col gap-3 rounded-lg bg-gray-100 p-2 text-neutral-700 md:p-3">
            <Tabs value={selectedTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="h-auto border-b border-gray-200 bg-transparent p-0">
                    {tabs.map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className={`data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-2.5
                                py-1.5 text-xs font-medium transition-all duration-150
                                hover:bg-gray-50/70 focus-visible:ring-1 focus-visible:ring-primary-300 focus-visible:ring-offset-1
                                data-[state=active]:rounded-t-md data-[state=active]:border-b-2 data-[state=active]:bg-white data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:rounded-t-md`}
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                <TabsContent
                    key={selectedTab}
                    value={selectedTab}
                    className="mt-3 rounded-r-md bg-white p-3 shadow-sm"
                >
                    {tabContent[selectedTab as TabType]}
                </TabsContent>
            </Tabs>
        </div>
    );
};
