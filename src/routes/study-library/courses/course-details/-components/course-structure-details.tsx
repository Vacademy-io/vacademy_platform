import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useMemo, useState, useCallback } from "react";
import { PullToRefreshWrapper } from "@/components/design-system/pull-to-refresh";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toTitleCase } from "@/lib/utils";
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
import {
    TabType,
    tabs,
} from "@/components/common/study-library/level-material/subject-material/-constants/constant";
import { getIcon } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { CourseDetailsFormValues } from "./course-details-schema";
import { getSubjectDetails } from "@/routes/courses/course-details/-utils/helper";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { useRouter } from "@tanstack/react-router";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
// import { CODE_CIRCLE_INSTITUTE_ID } from "@/constants/urls";
// import { getInstituteId } from "@/constants/helper";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import type { StudentCourseDetailsTabId } from "@/types/student-display-settings";
import { PackageSessionMessages } from "@/components/announcements";

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
    selectedTab,
    isEnrolledInCourse,
    onLoadingChange,
    updateModuleStats,
}: {
    selectedSession: string;
    selectedLevel: string;
    courseStructure: number;
    courseData: CourseDetailsFormValues;
    packageSessionId: string;
    selectedTab: string;
    isEnrolledInCourse?: boolean;
    onLoadingChange?: (loading: boolean) => void;
    updateModuleStats?: (modulesData: Record<string, Array<{ chapters?: Array<unknown> }>>) => void;
}) => {
    // Debug logging
    console.log('CourseStructureDetails props:', {
        selectedSession,
        selectedLevel,
        courseStructure,
        packageSessionId,
        selectedTab,
        isEnrolledInCourse
    });
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
    const formatDuration = (millis?: number | null): string => {
        if (!millis || millis <= 0) return "";
        const totalSeconds = Math.round(millis / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    // Helper: compute short meta text for a slide
    const getSlideMetaText = (slide: Slide): string => {
        // Prefer document/video/question/assignment specifics
        if (slide.document_slide) {
            const pages: number | undefined =
                (slide.document_slide as { published_document_total_pages?: number }).published_document_total_pages ??
                slide.document_slide.total_pages;
            if (typeof pages === "number" && pages > 0) return `${pages} pages`;
        }
        if (slide.video_slide) {
            const ms: number | undefined =
                (slide.video_slide as { published_video_length_in_millis?: number }).published_video_length_in_millis ??
                slide.video_slide.video_length_in_millis;
            const text = formatDuration(ms);
            if (text) return text;
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
    };
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
        ): typeof TabType[keyof typeof TabType] => {
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
                    label: t.label || tabs.find((x) => x.value === mapSettingIdToValue(t.id))?.label || t.id,
                    value: mapSettingIdToValue(t.id),
                }));

            // Check if course discussion should be shown based on student display settings
            const shouldShowCourseDiscussion = settings?.notifications?.allowBatchStream === true;
            // setShowCourseDiscussion(shouldShowCourseDiscussion);

            // Debug logs for visibility enforcement
            console.group('[Course Details Settings] Visible tabs resolved');
            console.log('Raw settings tabs:', settings?.courseDetails?.tabs);
            console.log('Mapped & ordered visible tabs:', ordered);
            console.log('Should show course discussion:', shouldShowCourseDiscussion);
            console.groupEnd();
            
            // Fallback: ensure CONTENT_STRUCTURE appears if visible in settings but mapping missed
            const hasContentStructureSetting = tabsSetting.some((t) => t.id === 'CONTENT_STRUCTURE' && t.visible !== false);
            const hasContentStructureMapped = ordered.some((t) => t.value === TabType.CONTENT_STRUCTURE);
            const finalTabs = [...ordered];
            if (hasContentStructureSetting && !hasContentStructureMapped) {
                finalTabs.push({ label: 'Content Structure', value: TabType.CONTENT_STRUCTURE });
            }
            
            // Add course discussion tab if enabled
            if (shouldShowCourseDiscussion) {
                finalTabs.push({ label: 'Course Discussion', value: TabType.COURSE_DISCUSSION });
            }
            
            console.log('[Course Details Settings] finalTabs to render:', finalTabs);
            if (finalTabs.length) setFilteredTabs(finalTabs as typeof tabs);

            // New: respect content prefix visibility
            const resolvedShowPrefixes = settings?.courseDetails?.showCourseContentPrefixes !== false;
            console.log('[Course Details Settings] showCourseContentPrefixes resolved:', resolvedShowPrefixes);
            setShowContentPrefixes(resolvedShowPrefixes);

            const defaultTabId = settings?.courseDetails?.defaultTab || "OUTLINE";
            const defaultValue = mapSettingIdToValue(defaultTabId);
            const isDefaultVisible = ordered.some((t) => t.value === defaultValue);
            const firstVisible = (ordered[0]?.value as string) || TabType.OUTLINE;
            const resolvedDefault = isDefaultVisible ? (defaultValue as string) : firstVisible;
            console.log('[Course Details Settings] Default tab resolved:', {
                configuredDefault: defaultTabId,
                mappedDefault: defaultValue,
                isDefaultVisible,
                finalDefault: resolvedDefault,
            });
            setSelectedStructureTab(resolvedDefault);
        });
    }, []);

    const renderTabs = useMemo(() => {
        const priorityOrder = [TabType.OUTLINE, TabType.CONTENT_STRUCTURE, TabType.COURSE_DISCUSSION];
        const byValue = new Map(filteredTabs.map((t) => [t.value, t]));
        const prioritized = priorityOrder
            .filter((v) => byValue.has(v))
            .map((v) => byValue.get(v)!) as { label: string; value: string }[];
        const rest = filteredTabs.filter(
            (t) => !priorityOrder.includes(t.value as TabType)
        );
        const finalArr = [...prioritized, ...rest];
        console.log('[Course Details UI] renderTabs:', finalArr);
        return finalArr;
    }, [filteredTabs]);
    const [subjectModulesMap, setSubjectModulesMap] =
        useState<SubjectModulesMap>({});
    const [slidesMap, setSlidesMap] = useState<Record<string, Slide[]>>({});
    // Drill-down state for Content Structure tab
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
    const [thumbUrlById, setThumbUrlById] = useState<Record<string, string>>({});
// const [thumbUrlById, setThumbUrlById] = useState<Record<string, string>>({});

    // Helpers to safely extract optional thumbnail IDs without using any
    const getSubjectThumbnailId = (subject: SubjectType): string | undefined => {
        return (subject as unknown as { thumbnail_id?: string | null })
            .thumbnail_id || undefined;
    };
    const getModuleThumbnailId = (mod: Module): string | undefined => {
        return (mod as unknown as { thumbnail_id?: string | null })
            .thumbnail_id || undefined;
    };

    // Ensure subject thumbnails are fetched for Content Structure top level
    useEffect(() => {
        const prefetchTopLevelSubjects = async () => {
            if (selectedSubjectId) return; // already drilled down
            const subjects = studyLibraryData ?? [];
            if (subjects.length === 0) return;

            const pending = subjects
                .map((s) => ({ key: `subject:${s.id}`, fileId: getSubjectThumbnailId(s) }))
                .filter(({ key, fileId }) => Boolean(fileId) && !thumbUrlById[key]) as Array<{ key: string; fileId: string }>;
            if (pending.length === 0) return;

            const results = await Promise.all(
                pending.map(async ({ key, fileId }) => {
                    try {
                        const url = await getPublicUrlWithoutLogin(fileId);
                        return { key, url } as const;
                    } catch {
                        return { key, url: '' } as const;
                    }
                })
            );
            const updates: Record<string, string> = {};
            for (const { key, url } of results) if (url) updates[key] = url;
            if (Object.keys(updates).length > 0) setThumbUrlById((prev) => ({ ...prev, ...updates }));
        };
        prefetchTopLevelSubjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSubjectId, studyLibraryData, thumbUrlById]);

    const handleSlideNavigation = (
        subjectId: string,
        moduleId: string,
        chapterId: string,
        slideId: string
    ) => {
        // Allow navigation if user is enrolled in the course OR if it's PROGRESS/COMPLETED tabs
        if (isEnrolledInCourse || selectedTab === "PROGRESS" || selectedTab === "COMPLETED") {
            navigateTo(
                `/study-library/courses/course-details/subjects/modules/chapters/slides`,
                {
                    courseId: searchParams.courseId,
                    subjectId,
                    moduleId,
                    chapterId,
                    slideId,
                }
            );
        }
        // For ALL tab when not enrolled, do nothing (view-only mode)
    };

    // Helper function to determine if slides should be clickable
    const isSlideClickable = () => {
        return isEnrolledInCourse || selectedTab === "PROGRESS" || selectedTab === "COMPLETED";
    };

    // Helper function to get slide styling based on clickability
    const getSlideStyling = (textSize: "xs" | "sm" = "xs") => {
        const sizeClass = textSize === "sm" ? "text-sm" : "text-xs";
        if (isSlideClickable()) {
            return `group flex cursor-pointer items-center gap-1.5 px-2 py-1 ${sizeClass} text-neutral-500 rounded hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/40 hover:border-amber-200/40 border border-transparent transition-all duration-200`;
        } else {
            return `group flex items-center gap-1.5 px-2 py-1 ${sizeClass} text-neutral-400 rounded bg-neutral-50/50 border border-transparent`;
        }
    };

    const getSlidesWithChapterId = async (chapterId: string) => {
        // Avoid duplicate fetch
        if (slidesMap[chapterId]) {
            console.log('[Slides Debug] Skipping fetch, slides already loaded for chapter:', chapterId, 'count:', (slidesMap[chapterId] || []).length);
            return;
        }

        try {
            const slides = await fetchSlidesByChapterId(chapterId);
            console.log('[Slides Debug] Fetched slides for chapter:', chapterId, 'count:', slides?.length || 0);
            setSlidesMap((prev) => ({ ...prev, [chapterId]: slides }));
        } catch (err) {
            console.error(
                `Error fetching slides for chapter ${chapterId}:`,
                err
            );
        }
    };

    const useModulesMutation = () => {
        return useMutation({
            mutationFn: async ({
                subjects: currentSubjects,
            }: {
                subjects: SubjectType[];
            }) => {
                // Ensure packageSessionId is available for all course depths
                if (!packageSessionId) {
                    console.warn(
                        "packageSessionId is not available for course depth:",
                        courseStructure
                    );
                    throw new Error(
                        "Package session ID is required for fetching modules"
                    );
                }

                const results = await Promise.all(
                    currentSubjects?.map(async (subject) => {
                        // For depth 5 courses, try using the public endpoint first
                        let res;
                        if (courseStructure === 5) {
                            try {
                                res = await fetchModulesWithChaptersPublic(
                                    subject.id,
                                    packageSessionId
                                );
                            } catch {
                                res = await fetchModulesWithChapters(
                                    subject.id,
                                    packageSessionId
                                );
                            }
                        } else {
                            res = await fetchModulesWithChapters(
                                subject.id,
                                packageSessionId
                            );
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
    const handleLoadingChange = useCallback((loading: boolean) => {
        if (onLoadingChange) {
            onLoadingChange(loading);
        }
    }, [onLoadingChange]);

    const refreshData = async () => {
        if (!packageSessionId) {
            console.warn(
                "packageSessionId is not available for refreshing study library data"
            );
            return;
        }
        // Refresh by reloading modules
        try {
            const modulesMap = await fetchModules({
                subjects: getSubjectDetails(
                    courseData,
                    selectedSession,
                    selectedLevel
                ),
            });
            setSubjectModulesMap(modulesMap);

            // Update module stats for parent component
            if (updateModuleStats) {
                updateModuleStats(modulesMap);
            }
        } catch (error) {
            console.error("Failed to refresh data:", error);
        }
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
                            {getTerminology(
                                ContentTerms.Course,
                                SystemTerms.Course
                            )}{" "}
                            Structure
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
                <div className="w-full space-y-1.5">
                    {(() => {
                        const subjects = studyLibraryData || [];
                        const summary = subjects.map((subject) => {
                            const modules = subjectModulesMap[subject.id] || [];
                            const chapters = modules.flatMap((m) => m.chapters || []);
                            const slidesCounts = chapters.map((ch) => (slidesMap[ch.id] || []).length);
                            const totalSlides = slidesCounts.reduce((a, b) => a + b, 0);
                            return { subjectId: subject.id, modules: modules.length, chapters: chapters.length, totalSlides };
                        });
                        console.log('[Slides Debug] subject summary:', summary);
                        return null;
                    })()}
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
                                                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-bold shrink-0">
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
                                                        onLoad={() => console.log('[thumb] (study-library) subject img load', { id: subject.id })}
                                                        onError={(e) => {
                                                            console.warn('[thumb] (study-library) subject img error', { id: subject.id, src: e.currentTarget.src });
                                                            e.currentTarget.classList.add('border-red-400');
                                                        }}
                                                    />
                                                )}
                                                {showContentPrefixes && (
                                                    <span className="w-7 shrink-0 text-center font-mono text-xs font-semibold text-neutral-500 bg-neutral-100 rounded px-1 py-0.5">
                                                        S{idx + 1}
                                                    </span>
                                                )}
                                                <span
                                                    className="truncate font-medium group-hover:text-primary-700 transition-colors"
                                                    title={toTitleCase(
                                                        subject.subject_name
                                                    )}
                                                >
                                                    {toTitleCase(
                                                        subject.subject_name
                                                    )}
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
                                                                    {thumbUrlById[`module:${mod.module.id}`] && (
                                                                        <img
                                                                            src={thumbUrlById[`module:${mod.module.id}`]}
                                                                            alt={mod.module.module_name}
                                                                            className="w-5 h-5 rounded-sm object-cover border border-neutral-200"
                                                                            crossOrigin="anonymous"
                                                                            referrerPolicy="no-referrer"
                                                                            loading="eager"
                                                                            onLoad={() => console.log('[thumb] (study-library) module img load', { id: mod.module.id })}
                                                                            onError={(e) => {
                                                                                console.warn('[thumb] (study-library) module img error', { id: mod.module.id, src: e.currentTarget.src });
                                                                                e.currentTarget.classList.add('border-red-400');
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {showContentPrefixes && (
                                                                        <span className="w-6 shrink-0 text-center font-mono text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1">
                                                                            M
                                                                            {modIdx + 1}
                                                                        </span>
                                                                    )}
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
                                                                                            {thumbUrlById[`chapter:${ch.id}`] && (
                                                                                                <img
                                                                                                    src={thumbUrlById[`chapter:${ch.id}`]}
                                                                                                    alt={toTitleCase(ch.chapter_name)}
                                                                                                    className="w-4 h-4 rounded-sm object-cover border border-neutral-200"
                                                                                                    crossOrigin="anonymous"
                                                                                                    referrerPolicy="no-referrer"
                                                                                                    loading="eager"
                                                                                                    onLoad={() => console.log('[thumb] (study-library) chapter img load', { id: ch.id })}
                                                                                                    onError={(e) => {
                                                                                                        console.warn('[thumb] (study-library) chapter img error', { id: ch.id, src: e.currentTarget.src });
                                                                                                        e.currentTarget.classList.add('border-red-400');
                                                                                                    }}
                                                                                                />
                                                                                            )}
                                                                                            {showContentPrefixes && (
                                                                                                <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                                                                    C
                                                                                                    {chIdx + 1}
                                                                                                </span>
                                                                                            )}
                                                                                            <span
                                                                                                className="truncate group-hover:text-green-700 transition-colors text-xs"
                                                                                                title={toTitleCase(
                                                                                                    ch.chapter_name
                                                                                                )}
                                                                                            >
                                                                                                {toTitleCase(
                                                                                                    ch.chapter_name
                                                                                                )}
                                                                                            </span>
                                                                                        </div>
                                                                                    </CollapsibleTrigger>
                                                                                    <CollapsibleContent>
                                                                                        <div
                                                                                            className={`space-y-px ml-5 border-l border-green-200/50 py-1 pl-2 relative `}
                                                                                        >
                                                                                            <div className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-green-300/50 to-transparent"></div>
                                                                                            {(() => {
                                                                                                const slidesForChapter =
                                                                                                    slidesMap[
                                                                                                        ch
                                                                                                            .id
                                                                                                    ] ??
                                                                                                    [];
                                                                                                return slidesForChapter.length ===
                                                                                                    0 ? (
                                                                                                    <div className="text-xs px-2 py-1 text-neutral-400 italic bg-neutral-50/50 rounded">
                                                                                                        No
                                                                                                        slides
                                                                                                        in
                                                                                                        this
                                                                                                        chapter.
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    slidesForChapter.map(
                                                                                                        (
                                                                                                            slide,
                                                                                                            sIdx
                                                                                                        ) => (
                                                                                                            <div
                                                                                                                key={
                                                                                                                    slide.id
                                                                                                                }
                                                                                                                className={getSlideStyling()}
                                                                                                                onClick={isSlideClickable() ? () => {
                                                                                                                    handleSlideNavigation(
                                                                                                                        subject.id,
                                                                                                                        mod
                                                                                                                            .module
                                                                                                                            .id,
                                                                                                                        ch.id,
                                                                                                                        slide.id
                                                                                                                    );
                                                                                                                } : undefined}
                                                                                                            >
                                                                                                                {showContentPrefixes && (
                                                                                                                    <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                                        S
                                                                                                                        {sIdx + 1}
                                                                                                                    </span>
                                                                                                                )}
                                                                                                                <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                                    {getIcon(
                                                                                                                        slide,
                                                                                                                        "3"
                                                                                                                    )}
                                                                                                                </div>
                                                                                                                <span
                                                                                                                    className="truncate group-hover:text-amber-700 transition-colors"
                                                                                                                    title={slide.title}
                                                                                                                >
                                                                                                                    {slide.title}
                                                                                                                </span>
                                                                                                                {(() => {
                                                                                                                    const meta = getSlideMetaText(slide);
                                                                                                                    return meta ? (
                                                                                                                        <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                                                                                            {meta}
                                                                                                                        </span>
                                                                                                                    ) : null;
                                                                                                                })()}
                                                                                                            </div>
                                                                                                        )
                                                                                                    )
                                                                                                );
                                                                                            })()}
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
                                                                {showContentPrefixes && (
                                                                    <span className="w-6 shrink-0 text-center font-mono text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-1">
                                                                        M
                                                                        {modIdx + 1}
                                                                    </span>
                                                                )}
                                                                <span
                                                                    className="truncate group-hover:text-blue-700 transition-colors"
                                                                    title={toTitleCase(
                                                                        mod
                                                                            .module
                                                                            .module_name
                                                                    )}
                                                                >
                                                                    {toTitleCase(
                                                                        mod
                                                                            .module
                                                                            .module_name
                                                                    )}
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
                                                                                        {showContentPrefixes && (
                                                                                            <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                                                                C
                                                                                                {chIdx + 1}
                                                                                            </span>
                                                                                        )}
                                                                                        <span
                                                                                            className="truncate group-hover:text-green-700 transition-colors text-xs"
                                                                                            title={toTitleCase(
                                                                                                ch.chapter_name
                                                                                            )}
                                                                                        >
                                                                                            {toTitleCase(
                                                                                                ch.chapter_name
                                                                                            )}
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
                                                                                                        className={getSlideStyling()}
                                                                                                        onClick={isSlideClickable() ? () => {
                                                                                                            handleSlideNavigation(
                                                                                                                subject.id,
                                                                                                                mod
                                                                                                                    .module
                                                                                                                    .id,
                                                                                                                ch.id,
                                                                                                                slide.id
                                                                                                            );
                                                                                                        } : undefined}
                                                                                                    >
                                                                                                        {showContentPrefixes && (
                                                                                                            <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                                S
                                                                                                                {sIdx + 1}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                            {getIcon(
                                                                                                                slide,
                                                                                                                "3"
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <span
                                                                                                            className="truncate group-hover:text-amber-700 transition-colors"
                                                                                                            title={slide.title}
                                                                                                        >
                                                                                                            {slide.title}
                                                                                                        </span>
                                                                                                        {(() => {
                                                                                                            const meta = getSlideMetaText(slide);
                                                                                                            return meta ? (
                                                                                                                <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                                                                                    {meta}
                                                                                                                </span>
                                                                                                            ) : null;
                                                                                                        })()}
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
                                                                                        {showContentPrefixes && (
                                                                                            <span className="text-xs w-5 shrink-0 text-center font-mono text-neutral-500 bg-neutral-100 rounded px-0.5">
                                                                                                C
                                                                                                {chIdx + 1}
                                                                                            </span>
                                                                                        )}
                                                                                        <span
                                                                                            className="truncate group-hover:text-green-700 transition-colors text-sm"
                                                                                            title={toTitleCase(
                                                                                                ch.chapter_name
                                                                                            )}
                                                                                        >
                                                                                            {toTitleCase(
                                                                                                ch.chapter_name
                                                                                            )}
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
                                                                                                        className={getSlideStyling()}
                                                                                                        onClick={isSlideClickable() ? () => {
                                                                                                            handleSlideNavigation(
                                                                                                                subject.id,
                                                                                                                mod
                                                                                                                    .module
                                                                                                                    .id,
                                                                                                                ch.id,
                                                                                                                slide.id
                                                                                                            );
                                                                                                        } : undefined}
                                                                                                    >
                                                                                                        {showContentPrefixes && (
                                                                                                            <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                                S
                                                                                                                {sIdx + 1}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                            {getIcon(
                                                                                                                slide,
                                                                                                                "3"
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <span
                                                                                                            className="truncate group-hover:text-amber-700 transition-colors"
                                                                                                            title={slide.title}
                                                                                                        >
                                                                                                            {slide.title}
                                                                                                        </span>
                                                                                                        {(() => {
                                                                                                            const meta = getSlideMetaText(slide);
                                                                                                            return meta ? (
                                                                                                                <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                                                                                    {meta}
                                                                                                                </span>
                                                                                                            ) : null;
                                                                                                        })()}
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
                                                                                                    className={`group flex items-center gap-1.5 px-2 py-1 text-sm text-neutral-500 rounded border border-transparent transition-all duration-200 ${
                                                                                                        selectedTab ===
                                                                                                            "PROGRESS" ||
                                                                                                        selectedTab ===
                                                                                                            "COMPLETED"
                                                                                                            ? "cursor-pointer hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/40 hover:border-amber-200/40"
                                                                                                            : "cursor-default opacity-60"
                                                                                                    }`}
                                                                                                    onClick={() => {
                                                                                                        handleSlideNavigation(
                                                                                                            subject.id,
                                                                                                            mod
                                                                                                                .module
                                                                                                                .id,
                                                                                                            ch.id,
                                                                                                            slide.id
                                                                                                        );
                                                                                                    }}
                                                                                                >
                                                                                                    {showContentPrefixes && (
                                                                                                        <span className="w-5 shrink-0 text-center font-mono text-neutral-400 bg-neutral-100 rounded px-0.5 text-xs">
                                                                                                            S
                                                                                                            {sIdx + 1}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    <div className="shrink-0 group-hover:scale-110 transition-transform">
                                                                                                        {getIcon(
                                                                                                            slide,
                                                                                                            "3"
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <span
                                                                                                        className="truncate group-hover:text-amber-700 transition-colors"
                                                                                                        title={slide.title}
                                                                                                    >
                                                                                                        {slide.title}
                                                                                                    </span>
                                                                                                    {(() => {
                                                                                                        const meta = getSlideMetaText(slide);
                                                                                                        return meta ? (
                                                                                                            <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                                                                                {meta}
                                                                                                            </span>
                                                                                                        ) : null;
                                                                                                    })()}
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
                        <span className="text-sm font-medium text-neutral-700">Content Structure</span>
                    </div>
                </div>
                {/* Drill-down folder UI */}
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-neutral-600 mb-2">
                    <button type="button" className={`hover:text-primary-600 ${!selectedSubjectId && !selectedModuleId && !selectedChapterId ? "font-semibold text-primary-700" : ""}`} onClick={() => { setSelectedSubjectId(null); setSelectedModuleId(null); setSelectedChapterId(null); }}>Subjects</button>
                    {(selectedSubjectId) && <span className="text-neutral-400">/</span>}
                    {(selectedSubjectId) && (
                        <button type="button" className={`hover:text-primary-600 ${selectedSubjectId && !selectedModuleId ? "font-semibold text-primary-700" : ""}`} onClick={() => { setSelectedModuleId(null); setSelectedChapterId(null); }}>Modules</button>
                    )}
                    {(selectedModuleId) && <span className="text-neutral-400">/</span>}
                    {(selectedModuleId) && (
                        <button type="button" className={`hover:text-primary-600 ${selectedModuleId && !selectedChapterId ? "font-semibold text-primary-700" : ""}`} onClick={() => { setSelectedChapterId(null); }}>Chapters</button>
                    )}
                    {(selectedChapterId) && <span className="text-neutral-400">/</span>}
                    {(selectedChapterId) && (
                        <span className="font-semibold text-primary-700">Slides</span>
                    )}
                </div>
                {/* Starting depth adapts to courseStructure; if preselected IDs exist, skips to that depth */}
                {!selectedSubjectId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {studyLibraryData?.map((subject) => (
                            <div key={subject.id} className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm hover:shadow cursor-pointer" onClick={() => { setSelectedSubjectId(subject.id); }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-md bg-neutral-100 flex items-center justify-center overflow-hidden">
                                        {thumbUrlById[`subject:${subject.id}`] ? (
                                            <img
                                                src={thumbUrlById[`subject:${subject.id}`]}
                                                alt={toTitleCase(subject.subject_name)}
                                                className="w-full h-full object-cover"
                                                crossOrigin="anonymous"
                                                referrerPolicy="no-referrer"
                                                loading="eager"
                                                onLoad={() => console.log('[thumb] (study-library) subject grid img load', { id: subject.id })}
                                                onError={(e) => {
                                                    console.warn('[thumb] (study-library) subject grid img error', { id: subject.id, src: e.currentTarget.src });
                                                    e.currentTarget.classList.add('border-red-400');
                                                }}
                                            />
                                        ) : (
                                            <Folder size={20} className="text-neutral-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-neutral-800 truncate" title={toTitleCase(subject.subject_name)}>{toTitleCase(subject.subject_name)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Modules */}
                {selectedSubjectId && !selectedModuleId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(subjectModulesMap[selectedSubjectId] || []).map((m) => (
                            <div key={m.module.id} className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm hover:shadow cursor-pointer" onClick={() => { setSelectedModuleId(m.module.id); }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-md bg-neutral-100 flex items-center justify-center overflow-hidden">
                                        {thumbUrlById[`module:${m.module.id}`] ? (
                                            <img
                                                src={thumbUrlById[`module:${m.module.id}`]}
                                                alt={m.module.module_name}
                                                className="w-full h-full object-cover"
                                                crossOrigin="anonymous"
                                                referrerPolicy="no-referrer"
                                                loading="eager"
                                                onLoad={() => console.log('[thumb] (study-library) module grid img load', { id: m.module.id })}
                                                onError={(e) => {
                                                    console.warn('[thumb] (study-library) module grid img error', { id: m.module.id, src: e.currentTarget.src });
                                                    e.currentTarget.classList.add('border-red-400');
                                                }}
                                            />
                                        ) : (
                                            <Folder size={20} className="text-neutral-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-neutral-800 truncate" title={m.module.module_name}>{m.module.module_name}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {/* Chapters */}
                {selectedSubjectId && selectedModuleId && !selectedChapterId && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(subjectModulesMap[selectedSubjectId] || [])
                            .filter((m) => m.module.id === selectedModuleId)
                            .flatMap((m) => m.chapters)
                            .map((ch) => (
                                <div key={ch.id} className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm hover:shadow cursor-pointer" onClick={async () => { setSelectedChapterId(ch.id); await getSlidesWithChapterId(ch.id); }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-md bg-neutral-100 flex items-center justify-center overflow-hidden">
                                            {thumbUrlById[`chapter:${ch.id}`] ? (
                                                <img
                                                    src={thumbUrlById[`chapter:${ch.id}`]}
                                                    alt={toTitleCase(ch.chapter_name)}
                                                    className="w-full h-full object-cover"
                                                    crossOrigin="anonymous"
                                                    referrerPolicy="no-referrer"
                                                    loading="eager"
                                                    onLoad={() => console.log('[thumb] (study-library) chapter grid img load', { id: ch.id })}
                                                    onError={(e) => {
                                                        console.warn('[thumb] (study-library) chapter grid img error', { id: ch.id, src: e.currentTarget.src });
                                                        e.currentTarget.classList.add('border-red-400');
                                                    }}
                                                />
                                            ) : (
                                                <FileText size={18} className="text-neutral-500" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-neutral-800 truncate" title={ch.chapter_name}>{ch.chapter_name}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
                {/* Slides */}
                {selectedChapterId && (
                    <div className="space-y-1">
                        {(slidesMap[selectedChapterId] || []).map((sl) => (
                            <div
                                key={sl.id}
                                className={getSlideStyling()}
                                onClick={() =>
                                    isSlideClickable() &&
                                    handleSlideNavigation(
                                        selectedSubjectId || "",
                                        selectedModuleId || "",
                                        selectedChapterId,
                                        sl.id
                                    )
                                }
                            >
                                {getIcon(sl)}
                                <span className="truncate">{sl.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ),
        [TabType.TEACHERS]: (
            <div className="rounded-md bg-gradient-to-br from-white to-neutral-50/50 border border-neutral-200 p-5 text-sm text-neutral-600">
                <div className="flex items-center gap-3 mb-3">
                   <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">T</span>
                    </div>
                    <span className="font-medium text-neutral-700">
                        {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}
                        s
                    </span>
                </div>
                <p className="text-neutral-500">
                    {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}s
                    content coming soon.
                </p>
            </div>
        ),
        [TabType.ASSESSMENT]: (
            <div className="rounded-md bg-gradient-to-br from-white to-neutral-50/50 border border-neutral-200 p-5 text-sm text-neutral-600">
                <div className="flex items-center gap-3 mb-3">
                   <div className="w-8 h-8 rounded-md bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
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
        [TabType.COURSE_DISCUSSION]: (
            <div className="space-y-4">
                {packageSessionId ? (
                    <PackageSessionMessages
                        packageSessionId={packageSessionId}
                    />
                ) : (
                    <div className="rounded-md bg-gradient-to-br from-white to-neutral-50/50 border border-neutral-200 p-5 text-sm text-neutral-600">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">D</span>
                            </div>
                            <span className="font-medium text-neutral-700">
                                Course Discussion
                            </span>
                        </div>
                        <p className="text-neutral-500">
                            Course discussion will be available once you enroll in this course.
                        </p>
                    </div>
                )}
            </div>
        ),
    };

    // Removed institute-based override so settings decide visible tabs exclusively

    useEffect(() => {
        const loadModules = async () => {
            // Debug logging
            console.log('Loading modules with packageSessionId:', packageSessionId);
            console.log('Course data:', courseData);
            console.log('Selected session:', selectedSession);
            console.log('Selected level:', selectedLevel);
            
            // Ensure packageSessionId is available before making API calls
            if (!packageSessionId) {
                console.warn(
                    "packageSessionId is not available, skipping module loading for course depth:",
                    courseStructure
                );
                return;
            }

            handleLoadingChange(true);

            try {
                const subjects = getSubjectDetails(
                    courseData,
                    selectedSession,
                    selectedLevel
                );
                console.log('Subjects to fetch modules for:', subjects);
                
                const modulesMap = await fetchModules({
                    subjects: subjects,
                });
                console.log('Modules map result:', modulesMap);
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
                            // Load slides for each chapter (same as expandAll function)
                            getSlidesWithChapterId(ch.id);
                        });
                    });
                });

                setOpenSubjects(allSubjectIds);
                setOpenModules(allModuleIds);
                setOpenChapters(allChapterIds);

                // Update module stats for parent component
                if (updateModuleStats) {
                    updateModuleStats(modulesMap);
                }
            } catch (error) {
                console.error(
                    "Failed to fetch modules or study library details:",
                    error
                );
                setSubjectModulesMap({});
            } finally {
                handleLoadingChange(false);
            }
        };
        loadModules();
    }, [packageSessionId, fetchModules, handleLoadingChange]);

    // Trigger module loading when session or level changes
    useEffect(() => {
        if (packageSessionId) {
            const loadModules = async () => {
                handleLoadingChange(true);
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
                                // Load slides for each chapter (same as expandAll function)
                                getSlidesWithChapterId(ch.id);
                            });
                        });
                    });

                                    setOpenSubjects(allSubjectIds);
                setOpenModules(allModuleIds);
                setOpenChapters(allChapterIds);

                // Update module stats for parent component
                if (updateModuleStats) {
                    updateModuleStats(modulesMap);
                }
            } catch (error) {
                console.error(
                    "Failed to fetch modules or study library details:",
                    error
                );
                setSubjectModulesMap({});
            } finally {
                handleLoadingChange(false);
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
        console.log('Study library data:', studyLibraryData);
        setStudyLibraryData(studyLibraryData);
    }, [selectedSession, selectedLevel, courseData]);

    // Prefetch thumbnails for modules/chapters when at their depth
    useEffect(() => {
        const prefetch = async () => {
            if (selectedSubjectId && !selectedModuleId) {
                const mods = subjectModulesMap[selectedSubjectId] || [];
                for (const m of mods) {
                    let fileId: string | undefined;
                    if (m && m.module && typeof m.module === 'object' && 'thumbnail_id' in m.module) {
                        fileId = (m.module as { thumbnail_id?: string }).thumbnail_id;
                    }
                    const key = `module:${m.module.id}`;
                        if (fileId && !thumbUrlById[key]) {
                        try {
                            const url = await getPublicUrlWithoutLogin(fileId);
                            setThumbUrlById((prev) => ({ ...prev, [key]: url }));
                        } catch (err) {
                            console.debug('prefetch module thumbnail failed', err);
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
                        } catch (err) {
                            console.debug('prefetch chapter thumbnail failed', err);
                        }
                    }
                }
            }
        };
        prefetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSubjectId, selectedModuleId, selectedChapterId, subjectModulesMap]);

    // Mount/unmount logs to verify which component is active
    useEffect(() => {
        console.log('[thumb] CourseStructureDetails (study-library) mounted');
        return () => {
            console.log('[thumb] CourseStructureDetails (study-library) unmounted');
        };
    }, []);

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

                console.log('[thumb] (study-library) prefetch start', {
                    subjects: subjectsArr.map((s) => ({ id: s.id, thumbnail_id: getSubjectThumbnailId(s) })),
                    subjectModulesMapKeys: moduleMapKeys,
                });

                const pending: Array<{ key: string; fileId: string }> = [];

                // subjects
                for (const s of subjectsArr) {
                    const key = `subject:${s.id}`;
                    const fileId = getSubjectThumbnailId(s);
                    if (fileId && !thumbUrlById[key]) {
                        console.log('[thumb] (study-library) subject candidate', { key, fileId, hasUrl: Boolean(thumbUrlById[key]) });
                        pending.push({ key, fileId });
                    }
                }

                // modules + chapters
                Object.values(subjectModulesMap || {}).forEach((mods) => {
                    for (const m of mods || []) {
                        const moduleKey = `module:${m.module.id}`;
                        const moduleFileId = getModuleThumbnailId(m.module);
                        if (moduleFileId && !thumbUrlById[moduleKey]) {
                            console.log('[thumb] (study-library) module candidate', { moduleKey, moduleFileId, hasUrl: Boolean(thumbUrlById[moduleKey]) });
                            pending.push({ key: moduleKey, fileId: moduleFileId });
                        }

                        for (const ch of m.chapters || []) {
                            const chapterKey = `chapter:${ch.id}`;
                            const chapterFileId = ch.file_id ?? undefined;
                            if (chapterFileId && !thumbUrlById[chapterKey]) {
                                console.log('[thumb] (study-library) chapter candidate', { chapterKey, chapterFileId, hasUrl: Boolean(thumbUrlById[chapterKey]) });
                                pending.push({ key: chapterKey, fileId: chapterFileId });
                            }
                        }
                    }
                });

                if (pending.length === 0) return;
                // dedupe
                const seen = new Set<string>();
                const unique = pending.filter(({ key }) => (seen.has(key) ? false : (seen.add(key), true)));
                const results = await Promise.all(
                    unique.map(async ({ key, fileId }) => {
                        try {
                            const url = await getPublicUrlWithoutLogin(fileId);
                            console.log('[thumb] (study-library) fetched', { key, fileId, url });
                            return { key, url } as const;
                        } catch (err) {
                            console.debug('[thumb] (study-library) fetch failed', { key, fileId, err });
                            return { key, url: '' } as const;
                        }
                    })
                );

                const updates: Record<string, string> = {};
                for (const { key, url } of results) if (url) updates[key] = url;
                if (Object.keys(updates).length > 0) {
                    console.log('[thumb] (study-library) applying', updates);
                    setThumbUrlById((prev) => ({ ...prev, ...updates }));
                }
            } catch (err) {
                console.debug('[thumb] (study-library) unexpected error', err);
            }
        };
        prefetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studyLibraryData, subjectModulesMap]);

  // Ensure Content Structure starts at correct depth based on courseStructure once data is ready
  useEffect(() => {
    // Do not override if user already drilled in
    if (selectedSubjectId || selectedModuleId || selectedChapterId) return;
    const subjects = studyLibraryData || [];
    if (subjects.length === 0) return;

    // Helper to pick first module/chapters safely
    const firstSubjectId = subjects[0]?.id;
    const modules = firstSubjectId ? (subjectModulesMap[firstSubjectId] || []) : [];
    const firstModuleId = modules[0]?.module.id;
    const firstChapterId = modules[0]?.chapters[0]?.id;

    console.log('[ContentStructure] init depth', { courseStructure, firstSubjectId, firstModuleId, firstChapterId });

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
    if (courseStructure === 2 && firstSubjectId && firstModuleId && firstChapterId) {
      setSelectedSubjectId(firstSubjectId);
      setSelectedModuleId(firstModuleId);
      setSelectedChapterId(firstChapterId);
      getSlidesWithChapterId(firstChapterId);
    }
  }, [courseStructure, studyLibraryData, subjectModulesMap, selectedSubjectId, selectedModuleId, selectedChapterId, getSlidesWithChapterId]);

    useEffect(() => {
        setNavHeading(
            <div className="flex items-center gap-2">
                <div>Study Materials</div>
            </div>
        );
    }, []);

    // Debug logging for render
    console.log('Rendering CourseStructureDetails with:', {
        studyLibraryData,
        subjectModulesMap,
        filteredTabs,
        selectedStructureTab
    });

    return (
        <PullToRefreshWrapper onRefresh={refreshData}>
            <div className="flex size-full flex-col gap-4 rounded-lg bg-gradient-to-br from-neutral-50/50 to-white pt-0 pb-4 text-neutral-700">
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
                                    hover:bg-gradient-to-r hover:from-primary-50/60 hover:to-blue-50/40 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1
                                    data-[state=active]:rounded-t-lg data-[state=active]:border-b-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-white data-[state=active]:to-primary-50/30 data-[state=inactive]:text-neutral-500 data-[state=inactive]:hover:rounded-t-lg`}
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    )}
                    <TabsContent
                        key={selectedStructureTab}
                        value={selectedStructureTab}
                        className={`${renderTabs.length > 1 ? 'mt-4' : ''} rounded-lg bg-white border border-neutral-200/60 p-4`}
                    >
                        {tabContent[selectedStructureTab as TabType]}
                    </TabsContent>
                </Tabs>
            </div>
        </PullToRefreshWrapper>
    );
};
