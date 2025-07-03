import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState } from "react";
import { PullToRefreshWrapper } from "@/components/design-system/pull-to-refresh";
import { fetchStudyLibraryDetails } from "@/services/study-library/getStudyLibraryDetails";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    CaretDown,
    CaretRight,
    Folder,
    FileText,
    PresentationChart,
    TreeStructure,
    FolderOpen,
} from "phosphor-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { fetchModulesWithChaptersPublic } from "@/services/study-library/getModulesWithChapters";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import { useMutation } from "@tanstack/react-query";
import {
    fetchSlidesByChapterId,
    Slide,
} from "@/hooks/study-library/use-slides";
import { Button } from "@/components/ui/button";
import {
    TabType,
    tabs,
} from "@/components/common/study-library/level-material/subject-material/-constants/constant";
import { getIcon } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { getSubjectDetails } from "../-utils/helper";
import { CourseDetailsFormValues } from "./course-details-schema";

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
    chapters: Chapter[];
}
export type SubjectModulesMap = { [subjectId: string]: ModuleWithChapters[] };

export const CourseStructureDetails = ({
    selectedSession,
    selectedLevel,
    courseStructure,
    courseData,
    packageSessionId,
}: {
    selectedSession: string;
    selectedLevel: string;
    courseStructure: number;
    courseData: CourseDetailsFormValues;
    packageSessionId: string;
}) => {
    console.log(courseStructure);
    const { setNavHeading } = useNavHeadingStore();

    const [studyLibraryData, setStudyLibraryData] = useState<SubjectType[]>([]);

    const [selectedTab, setSelectedTab] = useState<string>(TabType.OUTLINE);
    const handleTabChange = (value: string) => setSelectedTab(value);
    const [subjectModulesMap, setSubjectModulesMap] =
        useState<SubjectModulesMap>({});
    const [slidesMap, setSlidesMap] = useState<Record<string, Slide[]>>({});

    const getSlidesWithChapterId = async (chapterId: string) => {
        // Avoid duplicate fetch
        if (slidesMap[chapterId]) return;

        try {
            const slides = await fetchSlidesByChapterId(chapterId);
            setSlidesMap((prev) => ({ ...prev, [chapterId]: slides }));
        } catch (err) {
            console.log(err);
        }
    };

    const useModulesMutation = () => {
        return useMutation({
            mutationFn: async ({
                subjects: currentSubjects,
            }: {
                subjects: SubjectType[];
            }) => {
                const results = await Promise.all(
                    currentSubjects?.map(async (subject) => {
                        const res = await fetchModulesWithChaptersPublic(
                            subject.id,
                            packageSessionId
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

    const refreshData = async () => {
        const data = await fetchStudyLibraryDetails(packageSessionId);
        setStudyLibraryData(data);
    };

    const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
    const [openModules, setOpenModules] = useState<Set<string>>(new Set());
    const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

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
                    // Load slides for each chapter
                    getSlidesWithChapterId(ch.id);
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
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                    <div className="flex items-center gap-2">
                        <TreeStructure size={18} className="text-primary-600" />
                        <span className="text-sm font-medium text-neutral-700">
                            Course Structure
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
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
                </div>
                <div className="max-w-2xl space-y-1.5">
                    {courseStructure === 5 &&
                        studyLibraryData?.map(
                            (subject: SubjectType, idx: number) => {
                                const isSubjectOpen = openSubjects.has(
                                    subject.id
                                );
                                const baseIndent =
                                    "pl-[calc(18px+0.5rem+18px+0.5rem)]";
                                const subjectContentIndent = `${baseIndent} pl-[1.5rem]`;

                                return (
                                    <Collapsible
                                        key={subject.id}
                                        open={isSubjectOpen}
                                        onOpenChange={() =>
                                            toggleSubject(subject.id)
                                        }
                                    >
                                        <CollapsibleTrigger className="group flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-neutral-700 transition-all duration-200 hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 hover:border-primary-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
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
                                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-bold shrink-0">
                                                    {isSubjectOpen ? (
                                                        <FolderOpen size={12} />
                                                    ) : (
                                                        <Folder size={12} />
                                                    )}
                                                </div>
                                                <span className="w-7 shrink-0 text-center font-mono text-xs font-semibold text-neutral-500 bg-neutral-100 rounded px-1 py-0.5">
                                                    S{idx + 1}
                                                </span>
                                                <span
                                                    className="truncate font-medium group-hover:text-primary-700 transition-colors"
                                                    title={subject.subject_name}
                                                >
                                                    {subject.subject_name}
                                                </span>
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent
                                            className={`pb-1 pt-2 ${subjectContentIndent}`}
                                        >
                                            <div className="space-y-1 border-l-2 border-gradient-to-b from-primary-200/60 to-neutral-200/40 pl-3 relative">
                                                <div className="absolute left-0 top-0 w-0.5 h-full bg-gradient-to-b from-primary-300/80 to-transparent"></div>
                                                {(
                                                    subjectModulesMap[
                                                        subject.id
                                                    ] ?? []
                                                ).map((mod, modIdx) => {
                                                    const isModuleOpen =
                                                        openModules.has(
                                                            mod.module.id
                                                        );
                                                    const moduleContentIndent = `pl-[calc(16px+0.5rem+16px+0.5rem+1.5rem)]`;
                                                    return (
                                                        <Collapsible
                                                            key={mod.module.id}
                                                            open={isModuleOpen}
                                                            onOpenChange={() =>
                                                                toggleModule(
                                                                    mod.module
                                                                        .id
                                                                )
                                                            }
                                                        >
                                                            <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-neutral-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/70 hover:to-indigo-50/50 hover:border-blue-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1">
                                                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                    {isModuleOpen ? (
                                                                        <CaretDown
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                                                        />
                                                                    ) : (
                                                                        <CaretRight
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                                                        />
                                                                    )}
                                                                    <div className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                                                        <FileText
                                                                            size={
                                                                                12
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <span className="w-6 shrink-0 text-center font-mono text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1">
                                                                        M
                                                                        {modIdx +
                                                                            1}
                                                                    </span>
                                                                    <span
                                                                        className="truncate group-hover:text-blue-700 transition-colors"
                                                                        title={
                                                                            mod
                                                                                .module
                                                                                .module_name
                                                                        }
                                                                    >
                                                                        {
                                                                            mod
                                                                                .module
                                                                                .module_name
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </CollapsibleTrigger>

                                                            <CollapsibleContent
                                                                className={`py-1 ${moduleContentIndent}`}
                                                            >
                                                                <div className="space-y-0.5 border-l-2 border-blue-200/40 pl-2.5 relative">
                                                                    <div className="absolute left-0 top-0 w-0.5 h-full bg-gradient-to-b from-blue-300/60 to-transparent"></div>
                                                                    {(
                                                                        mod.chapters ??
                                                                        []
                                                                    ).map(
                                                                        (
                                                                            ch,
                                                                            chIdx
                                                                        ) => {
                                                                            const isChapterOpen =
                                                                                openChapters.has(
                                                                                    ch.id
                                                                                );

                                                                            return (
                                                                                <Collapsible
                                                                                    key={
                                                                                        ch.id
                                                                                    }
                                                                                    open={
                                                                                        isChapterOpen
                                                                                    }
                                                                                    onOpenChange={() => {
                                                                                        toggleChapter(
                                                                                            ch.id
                                                                                        );
                                                                                        getSlidesWithChapterId(
                                                                                            ch.id
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-neutral-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-green-50/70 hover:to-emerald-50/50 hover:border-green-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1">
                                                                                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                                            {isChapterOpen ? (
                                                                                                <CaretDown
                                                                                                    size={
                                                                                                        14
                                                                                                    }
                                                                                                    className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                                                                                />
                                                                                            ) : (
                                                                                                <CaretRight
                                                                                                    size={
                                                                                                        14
                                                                                                    }
                                                                                                    className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                                                                                />
                                                                                            )}
                                                                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-gradient-to-br from-green-500 to-green-600 text-white">
                                                                                                <PresentationChart
                                                                                                    size={
                                                                                                        10
                                                                                                    }
                                                                                                />
                                                                                            </div>
                                                                                            <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                                                                C
                                                                                                {chIdx +
                                                                                                    1}
                                                                                            </span>
                                                                                            <span
                                                                                                className="truncate group-hover:text-green-700 transition-colors text-xs"
                                                                                                title={
                                                                                                    ch.chapter_name
                                                                                                }
                                                                                            >
                                                                                                {
                                                                                                    ch.chapter_name
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                    </CollapsibleTrigger>
                                                                                    <CollapsibleContent>
                                                                                        <div className="space-y-px ml-5 border-l border-green-200/50 py-1 pl-2 relative">
                                                                                            <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-green-300/50 to-transparent"></div>
                                                                                            {(
                                                                                                slidesMap[
                                                                                                    ch
                                                                                                        .id
                                                                                                ] ??
                                                                                                []
                                                                                            )
                                                                                                .length ===
                                                                                            0 ? (
                                                                                                <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                                                                    No
                                                                                                    slides
                                                                                                    in
                                                                                                    this
                                                                                                    chapter.
                                                                                                </div>
                                                                                            ) : (
                                                                                                (
                                                                                                    slidesMap[
                                                                                                        ch
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
                                                                                                            className="group flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs text-neutral-500 rounded hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/40 hover:border-amber-200/40 border border-transparent transition-all duration-200"
                                                                                                        >
                                                                                                            <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                                S
                                                                                                                {sIdx +
                                                                                                                    1}
                                                                                                            </span>
                                                                                                            <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                                {getIcon(
                                                                                                                    slide,
                                                                                                                    "3"
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <span
                                                                                                                className="truncate group-hover:text-amber-700 transition-colors"
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
                                                })}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                );
                            }
                        )}
                    {courseStructure === 4 &&
                        studyLibraryData?.map((subject: SubjectType) => {
                            const isSubjectOpen = openSubjects.has(subject.id);
                            return (
                                <Collapsible
                                    key={subject.id}
                                    open={isSubjectOpen}
                                    onOpenChange={() =>
                                        toggleSubject(subject.id)
                                    }
                                >
                                    <CollapsibleContent
                                        className={`pb-1 pt-2 `}
                                    >
                                        <div className="space-y-1 relative">
                                            {(
                                                subjectModulesMap[subject.id] ??
                                                []
                                            ).map((mod, modIdx) => {
                                                const isModuleOpen =
                                                    openModules.has(
                                                        mod.module.id
                                                    );
                                                const moduleContentIndent = `pl-[calc(16px+0.5rem+16px+0.5rem+1.5rem)]`;
                                                return (
                                                    <Collapsible
                                                        key={mod.module.id}
                                                        open={isModuleOpen}
                                                        onOpenChange={() =>
                                                            toggleModule(
                                                                mod.module.id
                                                            )
                                                        }
                                                    >
                                                        <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-neutral-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/70 hover:to-indigo-50/50 hover:border-blue-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1">
                                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                {isModuleOpen ? (
                                                                    <CaretDown
                                                                        size={
                                                                            16
                                                                        }
                                                                        className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                                                    />
                                                                ) : (
                                                                    <CaretRight
                                                                        size={
                                                                            16
                                                                        }
                                                                        className="shrink-0 text-neutral-500 group-hover:text-blue-600 transition-colors"
                                                                    />
                                                                )}
                                                                <div className="flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                                                                    <FileText
                                                                        size={
                                                                            12
                                                                        }
                                                                    />
                                                                </div>
                                                                <span className="w-6 shrink-0 text-center font-mono text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1">
                                                                    M
                                                                    {modIdx + 1}
                                                                </span>
                                                                <span
                                                                    className="truncate group-hover:text-blue-700 transition-colors"
                                                                    title={
                                                                        mod
                                                                            .module
                                                                            .module_name
                                                                    }
                                                                >
                                                                    {
                                                                        mod
                                                                            .module
                                                                            .module_name
                                                                    }
                                                                </span>
                                                            </div>
                                                        </CollapsibleTrigger>

                                                        <CollapsibleContent
                                                            className={`py-1 ${moduleContentIndent}`}
                                                        >
                                                            <div className="space-y-0.5 border-l-2 border-blue-200/40 pl-2.5 relative">
                                                                <div className="absolute left-0 top-0 w-0.5 h-full bg-gradient-to-b from-blue-300/60 to-transparent"></div>
                                                                {(
                                                                    mod.chapters ??
                                                                    []
                                                                ).map(
                                                                    (
                                                                        ch,
                                                                        chIdx
                                                                    ) => {
                                                                        const isChapterOpen =
                                                                            openChapters.has(
                                                                                ch.id
                                                                            );

                                                                        return (
                                                                            <Collapsible
                                                                                key={
                                                                                    ch.id
                                                                                }
                                                                                open={
                                                                                    isChapterOpen
                                                                                }
                                                                                onOpenChange={() => {
                                                                                    toggleChapter(
                                                                                        ch.id
                                                                                    );
                                                                                    getSlidesWithChapterId(
                                                                                        ch.id
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-neutral-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-green-50/70 hover:to-emerald-50/50 hover:border-green-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1">
                                                                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                                        {isChapterOpen ? (
                                                                                            <CaretDown
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                                                                            />
                                                                                        ) : (
                                                                                            <CaretRight
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                                                                            />
                                                                                        )}
                                                                                        <div className="flex items-center justify-center w-4 h-4 rounded bg-gradient-to-br from-green-500 to-green-600 text-white">
                                                                                            <PresentationChart
                                                                                                size={
                                                                                                    10
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                        <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                                                            C
                                                                                            {chIdx +
                                                                                                1}
                                                                                        </span>
                                                                                        <span
                                                                                            className="truncate group-hover:text-green-700 transition-colors text-xs"
                                                                                            title={
                                                                                                ch.chapter_name
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                ch.chapter_name
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                </CollapsibleTrigger>
                                                                                <CollapsibleContent>
                                                                                    <div className="space-y-px ml-5 border-l border-green-200/50 py-1 pl-2 relative">
                                                                                        <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-green-300/50 to-transparent"></div>
                                                                                        {(
                                                                                            slidesMap[
                                                                                                ch
                                                                                                    .id
                                                                                            ] ??
                                                                                            []
                                                                                        )
                                                                                            .length ===
                                                                                        0 ? (
                                                                                            <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                                                                No
                                                                                                slides
                                                                                                in
                                                                                                this
                                                                                                chapter.
                                                                                            </div>
                                                                                        ) : (
                                                                                            (
                                                                                                slidesMap[
                                                                                                    ch
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
                                                                                                        className="group flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs text-neutral-500 rounded hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/40 hover:border-amber-200/40 border border-transparent transition-all duration-200"
                                                                                                    >
                                                                                                        <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                            S
                                                                                                            {sIdx +
                                                                                                                1}
                                                                                                        </span>
                                                                                                        <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                            {getIcon(
                                                                                                                slide,
                                                                                                                "3"
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <span
                                                                                                            className="truncate group-hover:text-amber-700 transition-colors"
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
                                            })}
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
                                    onOpenChange={() =>
                                        toggleSubject(subject.id)
                                    }
                                >
                                    <CollapsibleContent
                                        className={`pb-1 pt-2 `}
                                    >
                                        <div className="space-y-1 relative">
                                            {(
                                                subjectModulesMap[subject.id] ??
                                                []
                                            ).map((mod) => {
                                                const isModuleOpen =
                                                    openModules.has(
                                                        mod.module.id
                                                    );
                                                return (
                                                    <Collapsible
                                                        key={mod.module.id}
                                                        open={isModuleOpen}
                                                        onOpenChange={() =>
                                                            toggleModule(
                                                                mod.module.id
                                                            )
                                                        }
                                                    >
                                                        <CollapsibleContent
                                                            className={`py-1`}
                                                        >
                                                            <div className="space-y-0.5">
                                                                {(
                                                                    mod.chapters ??
                                                                    []
                                                                ).map(
                                                                    (
                                                                        ch,
                                                                        chIdx
                                                                    ) => {
                                                                        const isChapterOpen =
                                                                            openChapters.has(
                                                                                ch.id
                                                                            );

                                                                        return (
                                                                            <Collapsible
                                                                                key={
                                                                                    ch.id
                                                                                }
                                                                                open={
                                                                                    isChapterOpen
                                                                                }
                                                                                onOpenChange={() => {
                                                                                    toggleChapter(
                                                                                        ch.id
                                                                                    );
                                                                                    getSlidesWithChapterId(
                                                                                        ch.id
                                                                                    );
                                                                                }}
                                                                            >
                                                                                <CollapsibleTrigger className="group flex w-full items-center rounded-md px-2 py-1 text-left text-sm text-neutral-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-green-50/70 hover:to-emerald-50/50 hover:border-green-200/60 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-1">
                                                                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                                        {isChapterOpen ? (
                                                                                            <CaretDown
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                                                                            />
                                                                                        ) : (
                                                                                            <CaretRight
                                                                                                size={
                                                                                                    14
                                                                                                }
                                                                                                className="shrink-0 text-neutral-500 group-hover:text-green-600 transition-colors"
                                                                                            />
                                                                                        )}
                                                                                        <div className="flex items-center justify-center w-4 h-4 rounded bg-gradient-to-br from-green-500 to-green-600 text-white">
                                                                                            <PresentationChart
                                                                                                size={
                                                                                                    10
                                                                                                }
                                                                                            />
                                                                                        </div>
                                                                                        <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                                                            C
                                                                                            {chIdx +
                                                                                                1}
                                                                                        </span>
                                                                                        <span
                                                                                            className="truncate group-hover:text-green-700 transition-colors text-xs"
                                                                                            title={
                                                                                                ch.chapter_name
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                ch.chapter_name
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                </CollapsibleTrigger>
                                                                                <CollapsibleContent>
                                                                                    <div className="space-y-px ml-5 border-l border-green-200/50 py-1 pl-2 relative">
                                                                                        <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-green-300/50 to-transparent"></div>
                                                                                        {(
                                                                                            slidesMap[
                                                                                                ch
                                                                                                    .id
                                                                                            ] ??
                                                                                            []
                                                                                        )
                                                                                            .length ===
                                                                                        0 ? (
                                                                                            <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                                                                No
                                                                                                slides
                                                                                                in
                                                                                                this
                                                                                                chapter.
                                                                                            </div>
                                                                                        ) : (
                                                                                            (
                                                                                                slidesMap[
                                                                                                    ch
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
                                                                                                        className="group flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs text-neutral-500 rounded hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/40 hover:border-amber-200/40 border border-transparent transition-all duration-200"
                                                                                                    >
                                                                                                        <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                            S
                                                                                                            {sIdx +
                                                                                                                1}
                                                                                                        </span>
                                                                                                        <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                            {getIcon(
                                                                                                                slide,
                                                                                                                "3"
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <span
                                                                                                            className="truncate group-hover:text-amber-700 transition-colors"
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
                                    onOpenChange={() =>
                                        toggleSubject(subject.id)
                                    }
                                >
                                    <CollapsibleContent
                                        className={`pb-1 pt-2 `}
                                    >
                                        <div className="space-y-1 relative">
                                            {(
                                                subjectModulesMap[subject.id] ??
                                                []
                                            ).map((mod) => {
                                                const isModuleOpen =
                                                    openModules.has(
                                                        mod.module.id
                                                    );
                                                return (
                                                    <Collapsible
                                                        key={mod.module.id}
                                                        open={isModuleOpen}
                                                        onOpenChange={() =>
                                                            toggleModule(
                                                                mod.module.id
                                                            )
                                                        }
                                                    >
                                                        <CollapsibleContent
                                                            className={`py-1`}
                                                        >
                                                            <div className="space-y-0.5">
                                                                {(
                                                                    mod.chapters ??
                                                                    []
                                                                ).map((ch) => {
                                                                    const isChapterOpen =
                                                                        openChapters.has(
                                                                            ch.id
                                                                        );

                                                                    return (
                                                                        <Collapsible
                                                                            key={
                                                                                ch.id
                                                                            }
                                                                            open={
                                                                                isChapterOpen
                                                                            }
                                                                            onOpenChange={() => {
                                                                                toggleChapter(
                                                                                    ch.id
                                                                                );
                                                                                getSlidesWithChapterId(
                                                                                    ch.id
                                                                                );
                                                                            }}
                                                                        >
                                                                            <CollapsibleContent>
                                                                                <div className="space-y-px pl-2 relative">
                                                                                    {(
                                                                                        slidesMap[
                                                                                            ch
                                                                                                .id
                                                                                        ] ??
                                                                                        []
                                                                                    )
                                                                                        .length ===
                                                                                    0 ? (
                                                                                        <div className="text-xs px-2 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                                                            No
                                                                                            slides
                                                                                            in
                                                                                            this
                                                                                            chapter.
                                                                                        </div>
                                                                                    ) : (
                                                                                        (
                                                                                            slidesMap[
                                                                                                ch
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
                                                                                                    className="group flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs text-neutral-500 rounded hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/40 hover:border-amber-200/40 border border-transparent transition-all duration-200"
                                                                                                >
                                                                                                    <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                        S
                                                                                                        {sIdx +
                                                                                                            1}
                                                                                                    </span>
                                                                                                    <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                        {getIcon(
                                                                                                            slide,
                                                                                                            "3"
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <span
                                                                                                        className="truncate group-hover:text-amber-700 transition-colors"
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
        [TabType.TEACHERS]: (
            <div className="rounded-lg bg-gradient-to-br from-white to-neutral-50/50 border border-neutral-200 p-6 text-sm text-neutral-600">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">T</span>
                    </div>
                    <span className="font-medium text-neutral-700">
                        Teachers
                    </span>
                </div>
                <p className="text-neutral-500">
                    Teachers content coming soon.
                </p>
            </div>
        ),
        [TabType.ASSESSMENT]: (
            <div className="rounded-lg bg-gradient-to-br from-white to-neutral-50/50 border border-neutral-200 p-6 text-sm text-neutral-600">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">A</span>
                    </div>
                    <span className="font-medium text-neutral-700">
                        Assessments
                    </span>
                </div>
                <p className="text-neutral-500">
                    Assessment content coming soon.
                </p>
            </div>
        ),
    };

    useEffect(() => {
        const loadModules = async () => {
            try {
                const modulesMap = await fetchModules({
                    subjects: getSubjectDetails(
                        courseData,
                        selectedSession,
                        selectedLevel
                    ),
                });
                setSubjectModulesMap(modulesMap);

                // Auto-expand all sections by default
                const allSubjectIds = new Set<string>(
                    getSubjectDetails(
                        courseData,
                        selectedSession,
                        selectedLevel
                    ).map((s: SubjectType) => s.id)
                );
                const allModuleIds = new Set<string>();
                const allChapterIds = new Set<string>();

                Object.values(modulesMap).forEach((modules) => {
                    modules.forEach((mod) => {
                        allModuleIds.add(mod.module.id);
                        mod.chapters.forEach((ch) => {
                            allChapterIds.add(ch.id);
                            // Load slides for each chapter
                            getSlidesWithChapterId(ch.id);
                        });
                    });
                });

                setOpenSubjects(allSubjectIds);
                setOpenModules(allModuleIds);
                setOpenChapters(allChapterIds);
            } catch (error) {
                console.error("Failed to fetch modules:", error);
                setSubjectModulesMap({});
            }
        };
        loadModules();
    }, [studyLibraryData, packageSessionId, fetchModules]);

    useEffect(() => {
        setStudyLibraryData(
            getSubjectDetails(courseData, selectedSession, selectedLevel)
        );
    }, [selectedSession, selectedLevel]);

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <div>Study Materials</div>
            </div>
        );
    }, []);

    return (
        <PullToRefreshWrapper onRefresh={refreshData}>
            <div className="flex size-full flex-col gap-4 rounded-lg bg-gradient-to-br from-neutral-50/50 to-white p-3 text-neutral-700 md:p-4">
                <Tabs
                    value={selectedTab}
                    onValueChange={handleTabChange}
                    className="w-full overflow-scroll"
                >
                    <TabsList className="h-auto border-b border-neutral-200/80 bg-transparent p-0">
                        {tabs.map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={`data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-3 
                                py-2 text-sm font-medium transition-all duration-200 
                                hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1
                                data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-primary-50/30 data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:rounded-t-lg`}
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent
                        key={selectedTab}
                        value={selectedTab}
                        className="mt-4 rounded-lg bg-white border border-neutral-200/60 p-4"
                    >
                        {tabContent[selectedTab as TabType]}
                    </TabsContent>
                </Tabs>
            </div>
        </PullToRefreshWrapper>
    );
};
