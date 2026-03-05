import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
// class-study-material.tsx
import { useRouter } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SubjectType, useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useStudyLibraryContext } from '@/providers/study-library/init-study-library-provider';
import { getCourseSubjects } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getSubjects';
import { useGetPackageSessionId } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionId';
import { useGetPackageSessionIdFromCourseInit } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionIdFromCourseInit';
// import useIntroJsTour from '@/hooks/use-intro';
// import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
// import { studyLibrarySteps } from '@/constants/intro/steps';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type CourseDetailsTabId,
    type DisplaySettingsData,
} from '@/types/display-settings';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { DropdownItemType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import {
    CaretDown,
    CaretRight,
    Plus,
    Folder,
    FileText,
    PresentationChart,
    Trash,
    ArrowsOut,
    ArrowsIn,
    PencilSimple,
    DotsThree,
    Info,
    DotsSixVertical,
} from 'phosphor-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCourseSettings, saveCourseSettings } from '@/services/course-settings';
import { MyButton } from '@/components/design-system/button';
import AddTeachers from '@/routes/dashboard/-components/AddTeachers';
import { AddSubjectButton } from '../subjects/-components/add-subject.tsx/add-subject-button';
import { useAddSubject } from '../subjects/-services/addSubject';
import { useUpdateSubject } from '../subjects/-services/updateSubject';
import { useDeleteSubject } from '../subjects/-services/deleteSubject';
import { useUpdateSubjectOrder } from '../subjects/-services/updateSubjectOrder';
import { useUpdateModule } from '../subjects/modules/-services/update-module';
import { useUpdateChapter } from '../subjects/modules/chapters/-services/update-chapter';
import { Chapter } from '@/stores/study-library/use-modules-with-chapters-store';
import { ChapterWithSlides as ChapterWithSlidesStore } from '@/stores/study-library/use-modules-with-chapters-store';
import { ChapterWithSlides } from '../../-services/getAllSlides';
import { TabType, tabs } from '../subjects/-constants/constant';
import { useDeleteModule } from '../subjects/modules/-services/delete-module';
import { useDeleteChapter } from '../subjects/modules/chapters/-services/delete-chapter';
import { useUpdateModuleOrder } from '../subjects/modules/-services/update-modules-order';
import { useUpdateChapterOrder } from '../subjects/modules/chapters/-services/update-chapter-order';
import { fetchModulesWithChapters } from '../../-services/getModulesWithChapters';
import { Sortable, SortableItem, SortableDragHandle } from '@/components/ui/sortable';
import { rectSortingStrategy } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import {
    UseSlidesFromModulesInput,
    fetchChaptersWithSlides,
    Slide,
    fetchDirectSlides,
} from '../../-services/getAllSlides';
import { useAddModule } from '../subjects/modules/-services/add-module';
import { AddModulesButton } from '../subjects/modules/-components/add-modules.tsx/add-modules-button';
import { AddChapterButton } from '../subjects/modules/chapters/-components/chapter-material/add-chapters/add-chapter-button';
import Students from '../subjects/-components/student-list';
import Assessments from '../subjects/-components/assessment-list';
import { getIcon } from '../subjects/modules/chapters/slides/-components/slides-sidebar/slides-sidebar-slides';
import { useContentStore } from '../subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { TeachersList } from '../subjects/-components/teacher-list';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useFileUpload } from '@/hooks/use-file-upload';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { getRolesForCurrentInstitute } from '@/lib/auth/instituteUtils';
import { TokenKey, Authority } from '@/constants/auth/tokens';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { useCourseSettings } from '@/hooks/useCourseSettings';
import { ChapterDripConditionDialog } from './ChapterDripConditionDialog';
import { AddSubjectForm } from '../subjects/-components/add-subject.tsx/add-subject-form';
import { AddModulesForm } from '../subjects/modules/-components/add-modules.tsx/add-modules-form';
import { AddChapterForm } from '../subjects/modules/chapters/-components/chapter-material/add-chapters/add-chapter-form';
import { MyDialog } from '@/components/design-system/dialog';
import Planning from '../subjects/-components/planning';
import Activity from '../subjects/-components/activity';

// Map between DisplaySettings ids and UI tab values
const mapDisplayIdToUiValue = (id: CourseDetailsTabId): string => {
    switch (id) {
        case 'LEARNER':
            return 'STUDENT';
        case 'TEACHER':
            return 'TEACHERS';
        default:
            return id;
    }
};

// Chapter Header Actions Component
const ChapterHeaderActions = ({
    submitFn,
    isPending,
}: {
    submitFn: (() => void) | null;
    isPending: boolean;
}) => {
    return (
        <>
            <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                onClick={() => submitFn?.()}
                disabled={isPending || !submitFn}
                className="min-w-[120px]"
            >
                {isPending ? 'Updating...' : 'Save Changes'}
            </MyButton>
        </>
    );
};

// Interfaces (assuming these are unchanged)
// Chapter interface imported from store
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

// Thumbnail Image Component
const ThumbnailImage = ({
    thumbnailId,
    fallbackIcon,
    fallbackColor,
}: {
    thumbnailId: string | null;
    fallbackIcon: React.ReactNode;
    fallbackColor: string;
}) => {
    const { getPublicUrl } = useFileUpload();
    const [imageUrl, setImageUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!thumbnailId) {
            setImageUrl('');
            setIsLoading(false);
            return;
        }

        // If a full URL is provided, use it directly
        if (typeof thumbnailId === 'string' && /^(https?:)?\/\//.test(thumbnailId)) {
            setImageUrl(thumbnailId);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        getPublicUrl(thumbnailId)
            .then((url) => {
                setImageUrl(url || '');
            })
            .catch((error) => {
                console.error('Failed to get thumbnail URL:', error);
                setImageUrl('');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [thumbnailId, getPublicUrl]);

    if (isLoading) {
        return (
            <div
                className={`mb-2 flex aspect-[16/9] items-center justify-center rounded-lg ${fallbackColor}`}
            >
                <div className="size-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            </div>
        );
    }

    if (imageUrl && thumbnailId) {
        return (
            <div className="mb-2 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg">
                <img src={imageUrl} alt="Thumbnail" className="size-full object-cover" />
            </div>
        );
    }

    return (
        <div
            className={`mb-2 flex aspect-[16/9] items-center justify-center rounded-lg ${fallbackColor}`}
        >
            {fallbackIcon}
        </div>
    );
};

export const CourseStructureDetails = ({
    selectedSession,
    selectedLevel,
    courseStructure,
    isReadOnly,
    selectedBatchId,
}: {
    selectedSession: string;
    selectedLevel: string;
    courseStructure: number;
    isReadOnly?: boolean;
    /**
     * Selected Batch/Subgroup id (package_session_id). When provided, Outline and
     * Content Structure should load chapters/slides for this batch; otherwise
     * fall back to session+level mapped packageSessionId.
     */
    selectedBatchId?: string;
}) => {
    const router = useRouter();
    const searchParams = router.state.location.search;
    const { getSessionFromPackage, getPackageSessionId, instituteDetails } = useInstituteDetailsStore();
    const { studyLibraryData } = useStudyLibraryStore();
    const { setActiveItem } = useContentStore();
    const { isInitLoading } = useStudyLibraryContext();
    const {
        settings: courseSettings,
        loading: settingsLoading,
        error: settingsError,
    } = useCourseSettings();

    // Check user permissions for editing
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const isAdmin =
        tokenData?.authorities &&
        Object.values(tokenData.authorities).some(
            (auth: Authority) => Array.isArray(auth?.roles) && auth.roles.includes('ADMIN')
        );
    const currentUserId = tokenData?.user;

    // Get course status from study library data
    const courseData = studyLibraryData?.find((item) => item.course.id === searchParams.courseId);
    const courseStatus = courseData?.course?.status;
    const courseCreatedBy = courseData?.course?.createdByUserId;
    const isOwnCourse = courseCreatedBy === currentUserId;

    // Determine if user can edit structure
    // For draft courses, allow editing if:
    // 1. User is admin, OR
    // 2. User is the course creator and course is in DRAFT status, OR
    // 3. If createdByUserId is not available, allow editing for DRAFT status (fallback for authored courses)
    const canEditStructure =
        isAdmin ||
        (isOwnCourse && courseStatus === 'DRAFT') ||
        (!courseCreatedBy && courseStatus === 'DRAFT');
    const isPublishedCourse = courseStatus === 'ACTIVE';
    const isInReviewCourse = courseStatus === 'IN_REVIEW';

    const courseId: string = searchParams.courseId || '';
    const readOnly = Boolean(isReadOnly);
    // Role Display Settings (course details tabs)
    const [roleDisplay, setRoleDisplay] = useState<DisplaySettingsData | null>(null);
    useEffect(() => {
        try {
            // Use current institute's roles only (not all institutes) so that e.g. a user
            // with TEACHER+STUDENT in this institute gets Teacher display settings and
            // sees the tabs they enabled in Teacher settings.
            const rolesInner = getRolesForCurrentInstitute();
            const isAdminRoleInner = rolesInner.includes('ADMIN');
            const roleKeyInner = isAdminRoleInner
                ? ADMIN_DISPLAY_SETTINGS_KEY
                : TEACHER_DISPLAY_SETTINGS_KEY;
            const cached = getDisplaySettingsFromCache(roleKeyInner);
            if (cached) {
                setRoleDisplay(cached);
            } else {
                getDisplaySettings(roleKeyInner)
                    .then(setRoleDisplay)
                    .catch(() => setRoleDisplay(null));
            }
        } catch {
            setRoleDisplay(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const levelId: string = selectedLevel || '';

    const [sessionList, setSessionList] = useState<DropdownItemType[]>(
        searchParams.courseId ? getSessionFromPackage({ courseId: courseId, levelId: levelId }) : []
    );
    const initialSession: DropdownItemType | undefined = {
        id: selectedSession || '',
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
        if (selectedSession) {
            // Find the session name from sessionList based on selectedSession ID
            const foundSession = sessionList.find((session) => session.id === selectedSession);
            setCurrentSession({
                id: selectedSession,
                name: foundSession?.name || '',
            });
        } else {
            // Fallback to first session if no selectedSession
            setCurrentSession({ id: sessionList[0]?.id || '', name: sessionList[0]?.name || '' });
        }
    }, [sessionList, selectedSession]);

    // Use localStorage to persist selected tab across re-renders and page refreshes
    const getStorageKey = () => `course-structure-tab-${courseId}`;

    const [selectedTab, setSelectedTab] = useState<string>(() => {
        // Initialize from localStorage first
        const stored = localStorage.getItem(getStorageKey());
        if (stored) return stored;

        // If settings are still loading or failed, use safe default
        if (settingsLoading || settingsError) {
            return TabType.OUTLINE; // Safe default - always show Outline first when settings fail
        }

        // Use current institute's roles so we load the same display settings as in the effect above
        const roles = getRolesForCurrentInstitute();
        const isAdminRole = roles.includes('ADMIN');
        const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
        const roleKey = getActiveRoleDisplaySettingsKey();
        const fromCache = getDisplaySettingsFromCache(roleKey);
        const defaultDetailsTab = fromCache?.courseDetails?.defaultTab as
            | CourseDetailsTabId
            | undefined;
        if (defaultDetailsTab) return defaultDetailsTab;

        // Fallback: course settings default view
        const defaultViewMode = courseSettings?.courseViewSettings?.defaultViewMode;
        if (defaultViewMode === 'structure') return TabType.CONTENT_STRUCTURE;
        return TabType.OUTLINE;
    });

    // Ensure selected tab is visible per role display settings; otherwise, switch to default/first visible
    useEffect(() => {
        if (!roleDisplay?.courseDetails?.tabs) return;
        const details = roleDisplay.courseDetails;
        const visibilityMap = new Map(
            details.tabs.map((t) => [
                mapDisplayIdToUiValue(t.id as CourseDetailsTabId),
                t.visible !== false,
            ])
        );
        const isCurrentVisible = visibilityMap.get(selectedTab);
        if (isCurrentVisible === false) {
            const preferred = mapDisplayIdToUiValue(details.defaultTab as CourseDetailsTabId);
            const preferredVisible = visibilityMap.get(preferred) !== false;
            const firstVisible = tabs.find((t) => visibilityMap.get(t.value) !== false)?.value;
            const next = preferredVisible ? preferred : firstVisible || 'OUTLINE';
            setSelectedTab(next);
            localStorage.setItem(getStorageKey(), next);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleDisplay, selectedTab]);

    // Effect to update tab selection when settings load
    useEffect(() => {
        // Don't override if user has already selected a tab (localStorage exists)
        const stored = localStorage.getItem(getStorageKey());
        if (stored) return;

        // Only set default tab after settings have loaded successfully
        if (!settingsLoading && !settingsError) {
            const defaultViewMode = courseSettings?.courseViewSettings?.defaultViewMode;
            if (defaultViewMode === 'structure') {
                setSelectedTab(TabType.CONTENT_STRUCTURE);
            } else {
                setSelectedTab(TabType.OUTLINE);
            }
        }
    }, [
        settingsLoading,
        settingsError,
        courseSettings?.courseViewSettings?.defaultViewMode,
        courseId,
    ]);

    const handleTabChange = (value: string) => {
        setSelectedTab(value);
        // Save to localStorage
        localStorage.setItem(getStorageKey(), value);
        // Reset navigation when switching to Content Structure tab
        if (value === TabType.CONTENT_STRUCTURE) {
            resetNavigation();
        }
    };

    const [subjectModulesMap, setSubjectModulesMap] = useState<SubjectModulesMap>({});
    const [chapterSlidesMap, setChapterSlidesMap] = useState<{ [chapterId: string]: Slide[] }>({});
    const [directSlides, setDirectSlides] = useState<Slide[]>([]); // For 2-depth courses
    const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
    const [openModules, setOpenModules] = useState<Set<string>>(new Set());
    const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        type: 'subject' | 'module' | 'chapter' | null;
        item: { id: string; name: string; subjectId?: string; moduleId?: string } | null;
    }>({ isOpen: false, type: null, item: null });

    // Edit dialog states
    const [editDialog, setEditDialog] = useState<{
        isOpen: boolean;
        type: 'subject' | 'module' | 'chapter' | null;
        item: (SubjectType | Module | (Chapter & { subjectId?: string; moduleId?: string })) | null;
    }>({ isOpen: false, type: null, item: null });

    // Chapter form state for header button
    const [chapterFormState, setChapterFormState] = useState<{
        submitFn: (() => void) | null;
        isPending: boolean;
    }>({ submitFn: null, isPending: false });

    // Chapter drip conditions state
    const [chapterDripDialog, setChapterDripDialog] = useState<{
        open: boolean;
        chapterId: string | null;
        chapterName: string | null;
        packageId: string | null;
    }>({ open: false, chapterId: null, chapterName: null, packageId: null });
    const [dripConditionsEnabled, setDripConditionsEnabled] = useState(false);
    const [dripConditions, setDripConditions] = useState<any[]>([]);
    const [loadingDripConditions, setLoadingDripConditions] = useState(false);

    // Navigation state for loose view
    const [currentNavigationLevel, setCurrentNavigationLevel] = useState<
        'subjects' | 'modules' | 'chapters' | 'slides'
    >('subjects');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedModuleId, setSelectedModuleId] = useState<string>('');
    const [navigationBreadcrumb, setNavigationBreadcrumb] = useState<
        Array<{
            level: string;
            name: string;
            id: string;
        }>
    >([]);

    const addModuleMutation = useAddModule();
    const addSubjectMutation = useAddSubject();
    const updateSubjectMutation = useUpdateSubject();
    const deleteSubjectMutation = useDeleteSubject();
    const updateSubjectOrderMutation = useUpdateSubjectOrder();
    const updateModuleOrderMutation = useUpdateModuleOrder();
    const updateChapterOrderMutation = useUpdateChapterOrder();
    const updateModuleMutation = useUpdateModule();
    const updateChapterMutation = useUpdateChapter();
    const deleteModuleMutation = useDeleteModule();
    const deleteChapterMutation = useDeleteChapter();

    // useIntroJsTour({
    //     key: StudyLibraryIntroKey.addSubjectStep,
    //     steps: studyLibrarySteps.addSubjectStep,
    // });

    const initialSubjects = getCourseSubjects(courseId, selectedSession || '', levelId);
    const [subjects, setSubjects] = useState(initialSubjects);

    useEffect(() => {
        const newSubjects = getCourseSubjects(courseId, selectedSession || '', levelId);
        setSubjects(newSubjects);
    }, [selectedSession, studyLibraryData, courseId, levelId, selectedBatchId]);

    // Try to get packageSessionId from course-init API first (new approach)
    const packageSessionIdFromCourseInit = useGetPackageSessionIdFromCourseInit(
        courseId,
        selectedSession || '',
        levelId
    );
    // Fallback to institute details if course-init doesn't have it
    const packageSessionIdFromInstitute =
        useGetPackageSessionId(courseId, selectedSession || '', levelId) || '';

    // Canonical packageSessionId used across tabs.
    // If Batch/Subgroup is selected, use it; otherwise fall back to session+level mapping.
    const contentPackageSessionId =
        selectedBatchId || packageSessionIdFromCourseInit || packageSessionIdFromInstitute;

    // Outline + Content Structure fetches use this id.
    const packageSessionIds = contentPackageSessionId;
    // Batch-oriented tabs (Teacher/Learner/Assessment/Planning/Activity) also use the same id.
    const batchPackageSessionId = contentPackageSessionId;

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
        // Ensure we have a concrete package session id for this operation.
        if (!packageSessionIds) {
            console.error(
                'Cannot add module: missing packageSessionIds (no Batch/Subgroup or session+level mapping found).'
            );
            return;
        }

        addModuleMutation.mutate(
            {
                subjectId,
                // Always use the resolved packageSessionIds so modules/chapters
                // are created under the currently selected Batch/Subgroup (or
                // the legacy session+level mapping when no batch is selected).
                packageSessionIds,
                module,
            },
            {
                onSuccess: async () => {
                    const updatedSubjects = getCourseSubjects(
                        courseId,
                        selectedSession || '',
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
                    // Clear previous data when packageSession changes to avoid showing stale structure.
                    setSubjectModulesMap({});
                    setChapterSlidesMap({});
                    const modulesMap = await fetchModules({ subjects, packageSessionIds });
                    setSubjectModulesMap(modulesMap);

                    // Expand all by default
                    const allSubjectIds = new Set(subjects.map((s) => s.id));
                    const allModuleIds = new Set<string>();
                    const allChapterIds = new Set<string>();

                    Object.values(modulesMap)
                        .flat()
                        .forEach((modWithChapters) => {
                            allModuleIds.add(modWithChapters.module.id);
                            modWithChapters.chapters.forEach((chapWithMeta) => {
                                allChapterIds.add(chapWithMeta.chapter.id);
                            });
                        });
                    setOpenSubjects(allSubjectIds);
                    setOpenModules(allModuleIds);
                    setOpenChapters(allChapterIds);
                } catch (error) {
                    console.error('Failed to fetch modules:', error);
                    setSubjectModulesMap({});
                }
            } else {
                setSubjectModulesMap({});
            }
        };
        loadModules();
    }, [subjects, packageSessionIds, fetchModules, selectedBatchId]);

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
    }, [subjectModulesMap, packageSessionIds, fetchSlides, selectedBatchId]);

    // Auto-expand items based on course settings (only for outline tab)
    useEffect(() => {
        // Only proceed if settings have loaded successfully
        if (settingsLoading || settingsError) {
            return; // Use default collapsed state if settings fail - safer fallback
        }

        const defaultState = courseSettings?.outlineSettings?.defaultState;
        if (defaultState === 'expanded' && selectedTab === TabType.OUTLINE) {
            // Expand subjects (always applicable)
            if (subjects && subjects.length > 0) {
                const allSubjectIds = new Set(subjects.map((subject) => subject.id));
                setOpenSubjects(allSubjectIds);
            }

            // Expand modules and chapters if they exist
            if (Object.keys(subjectModulesMap).length > 0) {
                // Expand all modules
                const allModuleIds = new Set<string>();
                Object.values(subjectModulesMap).forEach((moduleList) => {
                    moduleList.forEach((moduleData) => {
                        allModuleIds.add(moduleData.module.id);
                    });
                });
                setOpenModules(allModuleIds);

                // Expand all chapters
                const allChapterIds = new Set<string>();
                Object.values(subjectModulesMap).forEach((moduleList) => {
                    moduleList.forEach((moduleData) => {
                        moduleData.chapters.forEach((chapterData) => {
                            allChapterIds.add(chapterData.chapter.id);
                        });
                    });
                });
                setOpenChapters(allChapterIds);
            }
        } else if (defaultState === 'collapsed') {
            // Ensure everything is collapsed
            setOpenSubjects(new Set());
            setOpenModules(new Set());
            setOpenChapters(new Set());
        }
    }, [
        settingsLoading,
        settingsError,
        courseSettings?.outlineSettings?.defaultState,
        subjectModulesMap,
        subjects,
        selectedTab,
    ]);

    // Load direct slides for 2-depth courses
    useEffect(() => {
        const loadDirectSlides = async () => {
            if (courseStructure === 2 && packageSessionIds) {
                try {
                    const slides = await fetchDirectSlides(packageSessionIds);
                    setDirectSlides(Array.isArray(slides) ? slides : []);
                } catch (error) {
                    console.error('Failed to fetch direct slides:', error);
                    setDirectSlides([]);
                }
            } else {
                setDirectSlides([]);
            }
        };
        loadDirectSlides();
    }, [courseStructure, packageSessionIds, selectedBatchId]);

    // Load drip conditions settings
    useEffect(() => {
        const loadDripSettings = async () => {
            setLoadingDripConditions(true);
            try {
                const settings = await getCourseSettings();
                setDripConditionsEnabled(settings.dripConditions.enabled || false);
                setDripConditions(settings.dripConditions.conditions || []);
            } catch (error) {
                console.error('Failed to load drip conditions:', error);
            } finally {
                setLoadingDripConditions(false);
            }
        };
        loadDripSettings();
    }, []);

    const handleOpenChapterDripDialog = (chapterId: string, chapterName: string) => {
        setChapterDripDialog({
            open: true,
            chapterId,
            chapterName,
            packageId: searchParams?.courseId ?? '',
        });
    };

    const handleCloseChapterDripDialog = () => {
        setChapterDripDialog({ open: false, chapterId: null, chapterName: null, packageId: null });
    };

    const handleSaveChapterDripConditions = async (updatedConditions: any[]) => {
        try {
            const settings = await getCourseSettings();
            const newSettings = {
                ...settings,
                dripConditions: {
                    ...settings.dripConditions,
                    conditions: updatedConditions,
                },
            };
            await saveCourseSettings(newSettings);
            setDripConditions(updatedConditions);
        } catch (error) {
            console.error('Failed to save drip conditions:', error);
            alert('Failed to save drip conditions. Please try again.');
        }
    };

    const handleAddSubject = async (newSubject: SubjectType) => {
        if (!packageSessionIds) {
            console.error('No package session IDs found');
            return;
        }
        addSubjectMutation.mutate({ subject: newSubject, packageSessionIds });
    };

    const openDeleteConfirmation = (
        type: 'subject' | 'module' | 'chapter',
        item: { id: string; name: string; subjectId?: string; moduleId?: string }
    ) => {
        setDeleteConfirmation({ isOpen: true, type, item });
    };

    const openEditDialog = (
        type: 'subject' | 'module' | 'chapter',
        item: SubjectType | Module | (Chapter & { subjectId?: string; moduleId?: string })
    ) => {
        setEditDialog({ isOpen: true, type, item });
    };

    const closeEditDialog = () => {
        setEditDialog({ isOpen: false, type: null, item: null });
        setChapterFormState({ submitFn: null, isPending: false });
    };

    const handleChapterFormReady = (submitFn: () => void, isPending: boolean) => {
        setChapterFormState({ submitFn, isPending });
    };

    const handleEditSubject = (updatedSubject: SubjectType) => {
        // Check permissions before allowing edit
        if (!canEditStructure) {
            console.warn('User does not have permission to edit this course structure');
            return;
        }

        updateSubjectMutation.mutate(
            {
                subjectId: updatedSubject.id,
                updatedSubject,
            },
            {
                onSuccess: () => {
                    closeEditDialog();
                    // Refresh data
                    const updatedSubjects = getCourseSubjects(
                        courseId,
                        selectedSession || '',
                        levelId
                    );
                    setSubjects(updatedSubjects);
                },
            }
        );
    };

    const handleEditModule = (updatedModule: Module) => {
        // Check permissions before allowing edit
        if (!canEditStructure) {
            console.warn('User does not have permission to edit this course structure');
            return;
        }

        if (!editDialog.item || editDialog.type !== 'module') return;
        const moduleItem = editDialog.item as Module & { subjectId?: string };
        if (!moduleItem.subjectId) return;

        updateModuleMutation.mutate(
            {
                moduleId: updatedModule.id,
                module: updatedModule,
            },
            {
                onSuccess: async () => {
                    closeEditDialog();
                    // Refresh data - same as add module
                    const updatedSubjects = getCourseSubjects(
                        courseId,
                        selectedSession || '',
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

    // Removed unused handleEditChapter to satisfy linter

    // ===== REORDER HANDLERS =====

    // Handle subject reordering
    const handleSubjectReorder = (reorderedSubjects: SubjectType[]) => {
        if (!canEditStructure || !packageSessionIds?.length) {
            console.warn('Cannot reorder: missing permissions or package session IDs');
            return;
        }

        // Save previous state for rollback
        const previousSubjects = [...subjects];

        // Optimistic update
        setSubjects(reorderedSubjects);

        // Build payload for API
        const orderedSubjects = reorderedSubjects.map((subject, index) => ({
            subject_id: subject.id,
            package_session_id: packageSessionIds || '',
            subject_order: index + 1, // 1-based index
        }));

        updateSubjectOrderMutation.mutate(
            { orderedSubjects },
            {
                onError: (error) => {
                    console.error('Failed to update subject order:', error);
                    setSubjects(previousSubjects);
                    toast.error('Failed to reorder subjects. Changes have been reverted.');
                },
            }
        );
    };

    // Handle module reordering (within a subject)
    const handleModuleReorder = (
        subjectId: string,
        reorderedModules: { module: Module; chapters: ChapterWithSlidesStore[] }[]
    ) => {
        if (!canEditStructure) {
            console.warn('Cannot reorder: missing permissions');
            return;
        }

        // Save previous state for rollback
        const previousModulesMap = { ...subjectModulesMap };

        // Optimistic update
        setSubjectModulesMap((prev) => ({
            ...prev,
            [subjectId]: reorderedModules,
        }));

        // Build payload for API
        const updatedModules = reorderedModules.map((mod, index) => ({
            subject_id: subjectId,
            module_id: mod.module.id,
            module_order: index + 1, // 1-based index
        }));

        updateModuleOrderMutation.mutate(
            { updatedModules },
            {
                onError: (error) => {
                    console.error('Failed to update module order:', error);
                    setSubjectModulesMap(previousModulesMap);
                    toast.error('Failed to reorder modules. Changes have been reverted.');
                },
            }
        );
    };

    // Handle chapter reordering (within a module)
    const handleChapterReorder = (
        moduleId: string,
        reorderedChapters: ChapterWithSlidesStore[]
    ) => {
        if (!canEditStructure || !packageSessionIds?.length) {
            console.warn('Cannot reorder: missing permissions or package session IDs');
            return;
        }

        // Save previous state for rollback
        const previousModulesMap = { ...subjectModulesMap };

        // Optimistic update - find and update the correct module
        setSubjectModulesMap((prev) => {
            const updated = { ...prev };
            for (const subjectId of Object.keys(updated)) {
                const modules = updated[subjectId];
                if (modules) {
                    const moduleIndex = modules.findIndex((m) => m.module.id === moduleId);
                    if (moduleIndex !== -1) {
                        updated[subjectId] = [
                            ...modules.slice(0, moduleIndex),
                            { ...modules[moduleIndex], chapters: reorderedChapters } as any,
                            ...modules.slice(moduleIndex + 1),
                        ];
                        break;
                    }
                }
            }
            return updated;
        });

        // Build payload for API
        const orderPayload = reorderedChapters.map((ch, index) => ({
            chapter_id: ch.chapter.id,
            package_session_id: packageSessionIds || '',
            chapter_order: index + 1, // 1-based index
        }));

        updateChapterOrderMutation.mutate(orderPayload, {
            onError: (error) => {
                console.error('Failed to update chapter order:', error);
                setSubjectModulesMap(previousModulesMap);
                toast.error('Failed to reorder chapters. Changes have been reverted.');
            },
        });
    };

    const handleConfirmDelete = () => {
        if (!deleteConfirmation.item || !packageSessionIds) {
            console.error('Missing confirmation item or package session IDs');
            return;
        }

        const { type, item } = deleteConfirmation;

        switch (type) {
            case 'subject':
                deleteSubjectMutation.mutate({
                    subjectId: item.id,
                    commaSeparatedPackageSessionIds: packageSessionIds,
                });
                break;
            case 'module':
                if (item.subjectId) {
                    deleteModuleMutation.mutate(
                        {
                            subjectId: item.subjectId,
                            moduleId: item.id,
                            commaSeparatedPackageSessionIds: packageSessionIds,
                        },
                        {
                            onSuccess: async () => {
                                // Update local state after successful deletion - same as add module
                                const updatedSubjects = getCourseSubjects(
                                    courseId,
                                    selectedSession || '',
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
                }
                break;
            case 'chapter':
                if (item.subjectId && item.moduleId) {
                    deleteChapterMutation.mutate(
                        {
                            moduleId: item.moduleId,
                            subjectId: item.subjectId,
                            packageSessionIds,
                            chapterIds: [item.id],
                        },
                        {
                            onSuccess: async () => {
                                // Update local state after successful chapter deletion
                                const updatedSubjects = getCourseSubjects(
                                    courseId,
                                    selectedSession || '',
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
                }
                break;
        }

        setDeleteConfirmation({ isOpen: false, type: null, item: null });
    };

    const handleChapterNavigation = (subjectId: string, moduleId: string, chapterId: string) => {
        if (readOnly) return;
        const navigationParams = {
            courseId: router.state.location.search.courseId ?? '',
            levelId: selectedLevel,
            subjectId,
            moduleId,
            chapterId,
            slideId: '', // Empty for new slide
            sessionId: selectedSession,
        };

        router.navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: navigationParams,
        });
    };

    const handleSlideNavigation = (
        subjectId: string,
        moduleId: string,
        chapterId: string,
        slideId: string
    ) => {
        if (readOnly) return;
        const slide = chapterSlidesMap[chapterId]?.find((s) => s.id === slideId);
        if (slide) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            setActiveItem(slide);
        } else {
            // Fallback for safety, though this path should ideally not be taken
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
        }

        const navigationParams = {
            courseId: router.state.location.search.courseId ?? '',
            levelId: selectedLevel,
            subjectId,
            moduleId,
            chapterId,
            slideId,
            sessionId: selectedSession,
        };

        router.navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: navigationParams,
        });
    };

    // Navigation handler for direct slides (2-depth courses)
    const handleDirectSlideNavigation = (slideId?: string) => {
        if (readOnly) return;
        const slide = slideId ? directSlides.find((s) => s.id === slideId) : null;
        if (slide) {
            setActiveItem(slide);
        }

        // Get real subject, module, and chapter IDs for 2-depth
        const realSubjectId = subjects[0]?.id || '';
        const moduleWithChapters = subjectModulesMap[realSubjectId]?.[0];
        const realModuleId = moduleWithChapters?.module.id || '';
        const realChapterId = moduleWithChapters?.chapters?.[0]?.chapter.id || '';

        const navigationParams = {
            courseId: router.state.location.search.courseId ?? '',
            levelId: selectedLevel,
            subjectId: realSubjectId,
            moduleId: realModuleId,
            chapterId: realChapterId,
            slideId: slideId || '',
            sessionId: selectedSession,
        };

        router.navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: navigationParams,
        });
    };

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

    const expandAll = () => {
        const allSubjectIds = new Set(subjects.map((s) => s.id));
        const allModuleIds = new Set<string>();
        const allChapterIds = new Set<string>();

        Object.values(subjectModulesMap)
            .flat()
            .forEach((modWithChapters) => {
                allModuleIds.add(modWithChapters.module.id);
                modWithChapters.chapters.forEach((chapWithMeta) => {
                    allChapterIds.add(chapWithMeta.chapter.id);
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

    // Navigation functions for loose view
    const handleSubjectClick = (subjectId: string, subjectName: string) => {
        setSelectedSubjectId(subjectId);
        setCurrentNavigationLevel('modules');
        setNavigationBreadcrumb([{ level: 'Subject', name: subjectName, id: subjectId }]);
    };

    const handleModuleClick = (moduleId: string, moduleName: string) => {
        setSelectedModuleId(moduleId);
        setCurrentNavigationLevel('chapters');
        setNavigationBreadcrumb((prev) => [
            ...prev,
            { level: 'Module', name: moduleName, id: moduleId },
        ]);
    };

    const resetNavigation = () => {
        setCurrentNavigationLevel('subjects');
        setSelectedSubjectId('');
        setSelectedModuleId('');
        setNavigationBreadcrumb([]);
    };

    const navigateToLevel = (levelIndex: number) => {
        const breadcrumb = navigationBreadcrumb.slice(0, levelIndex + 1);
        setNavigationBreadcrumb(breadcrumb);

        if (levelIndex === -1) {
            resetNavigation();
        } else if (levelIndex === 0) {
            // For course structure 4, level 0 is the module, so we should navigate to subjects and clear module selection
            if (courseStructure === 4) {
                setCurrentNavigationLevel('subjects');
                setSelectedModuleId('');
            } else {
                // For course structure 5, level 0 is subject, so navigate to modules
                setCurrentNavigationLevel('modules');
                setSelectedModuleId('');
            }
        } else if (levelIndex === 1) {
            setCurrentNavigationLevel('chapters');
        }
    };
    const tabContent: Record<TabType, React.ReactNode> = {
        [TabType.OUTLINE]: (
            <div className="relative">
                {/* Sticky header with expand/collapse buttons */}
                <div className="sticky top-0 z-10 mb-3 border-b border-gray-200 bg-white px-6 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-700">Course Structure</h3>
                        {!readOnly && (
                            <div className="flex gap-2">
                                <MyButton
                                    buttonType="secondary"
                                    onClick={expandAll}
                                    className="flex items-center gap-1.5 !px-3 !py-1 text-xs"
                                >
                                    <ArrowsOut size={14} weight="bold" />
                                    Expand All
                                </MyButton>
                                <MyButton
                                    buttonType="secondary"
                                    onClick={collapseAll}
                                    className="flex items-center gap-1.5 !px-3 !py-1 text-xs"
                                >
                                    <ArrowsIn size={14} weight="bold" />
                                    Collapse All
                                </MyButton>
                            </div>
                        )}
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="px-6 pb-2">
                    <div className="max-w-3xl space-y-1 rounded-lg border border-gray-200 px-2">
                        {courseStructure === 5 && canEditStructure && (
                            <AddSubjectButton isTextButton onAddSubject={handleAddSubject} />
                        )}
                        {courseStructure === 5 && (
                            <Sortable
                                value={subjects}
                                onValueChange={handleSubjectReorder}
                                orientation="vertical"
                            >
                                {subjects.map((subject, idx) => {
                                    const isSubjectOpen = openSubjects.has(subject.id);

                                    return (
                                        <SortableItem key={subject.id} value={subject.id} asChild>
                                            <div className="group/subject-item relative">
                                                <Collapsible
                                                    open={isSubjectOpen}
                                                    onOpenChange={
                                                        readOnly
                                                            ? undefined
                                                            : () => toggleSubject(subject.id)
                                                    }
                                                    className="group"
                                                >
                                                    <CollapsibleTrigger
                                                        className={`group/subject-trigger flex w-full items-center rounded-md p-2 text-left text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${readOnly ? 'pointer-events-none' : ''}`}
                                                    >
                                                        <div className="flex flex-1 items-center gap-2.5">
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
                                                            <Folder
                                                                size={20}
                                                                weight="duotone"
                                                                className="shrink-0 text-primary-500"
                                                            />
                                                            {roleDisplay?.coursePage
                                                                ?.viewContentNumbering !==
                                                                false && (
                                                                    <span className="w-7 shrink-0 rounded-md bg-gray-100 py-0.5 text-center font-mono text-xs font-medium text-gray-600 group-hover:bg-white">
                                                                        S{idx + 1}
                                                                    </span>
                                                                )}
                                                            <span
                                                                className="truncate"
                                                                title={subject.subject_name}
                                                            >
                                                                {convertCapitalToTitleCase(
                                                                    subject.subject_name
                                                                )}
                                                            </span>
                                                        </div>
                                                        {canEditStructure && (
                                                            <div className="flex gap-1">
                                                                <SortableDragHandle className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border border-neutral-300 opacity-0 transition-opacity hover:bg-gray-100 group-hover/subject-trigger:opacity-100">
                                                                    <DotsSixVertical size={14} />
                                                                </SortableDragHandle>
                                                                <MyButton
                                                                    buttonType="secondary"
                                                                    layoutVariant="icon"
                                                                    scale="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditDialog(
                                                                            'subject',
                                                                            subject
                                                                        );
                                                                    }}
                                                                    className="opacity-0 transition-opacity hover:bg-blue-100 hover:text-blue-600 group-hover/subject-trigger:opacity-100"
                                                                >
                                                                    <PencilSimple size={16} />
                                                                </MyButton>
                                                                <MyButton
                                                                    buttonType="secondary"
                                                                    layoutVariant="icon"
                                                                    scale="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDeleteConfirmation(
                                                                            'subject',
                                                                            {
                                                                                id: subject.id,
                                                                                name: subject.subject_name,
                                                                            }
                                                                        );
                                                                    }}
                                                                    className="opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover/subject-trigger:opacity-100"
                                                                >
                                                                    <Trash size={16} />
                                                                </MyButton>
                                                            </div>
                                                        )}
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent className="py-1 pl-11">
                                                        <div className="relative space-y-1.5 border-l-2 border-dashed border-gray-200 pl-6">
                                                            <div className="absolute -left-[13px] top-0 h-full">
                                                                <div className="sticky top-0 flex h-full flex-col items-center" />
                                                            </div>

                                                            {canEditStructure && (
                                                                <AddModulesButton
                                                                    isTextButton
                                                                    subjectId={subject.id}
                                                                    onAddModuleBySubjectId={
                                                                        handleAddModule
                                                                    }
                                                                />
                                                            )}
                                                            <Sortable
                                                                value={(
                                                                    subjectModulesMap[subject.id] ??
                                                                    []
                                                                ).map((m) => ({
                                                                    ...m,
                                                                    id: m.module.id,
                                                                }))}
                                                                onValueChange={(reorderedModules) =>
                                                                    handleModuleReorder(
                                                                        subject.id,
                                                                        reorderedModules as unknown as {
                                                                            module: Module;
                                                                            chapters: ChapterWithSlidesStore[];
                                                                        }[]
                                                                    )
                                                                }
                                                                orientation="vertical"
                                                            >
                                                                {(
                                                                    subjectModulesMap[subject.id] ??
                                                                    []
                                                                ).map((mod, modIdx) => {
                                                                    const isModuleOpen =
                                                                        openModules.has(
                                                                            mod.module.id
                                                                        );

                                                                    return (
                                                                        <SortableItem
                                                                            key={mod.module.id}
                                                                            value={mod.module.id}
                                                                            asChild
                                                                        >
                                                                            <div className="group/module-item relative">
                                                                                <Collapsible
                                                                                    open={
                                                                                        isModuleOpen
                                                                                    }
                                                                                    onOpenChange={
                                                                                        readOnly
                                                                                            ? undefined
                                                                                            : () =>
                                                                                                toggleModule(
                                                                                                    mod
                                                                                                        .module
                                                                                                        .id
                                                                                                )
                                                                                    }
                                                                                    className="group/module"
                                                                                >
                                                                                    <CollapsibleTrigger
                                                                                        className={`group/module-trigger flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${readOnly ? 'pointer-events-none' : ''}`}
                                                                                    >
                                                                                        <div className="flex flex-1 items-center gap-2.5">
                                                                                            {isModuleOpen ? (
                                                                                                <CaretDown
                                                                                                    size={
                                                                                                        16
                                                                                                    }
                                                                                                    className="shrink-0 text-gray-500"
                                                                                                />
                                                                                            ) : (
                                                                                                <CaretRight
                                                                                                    size={
                                                                                                        16
                                                                                                    }
                                                                                                    className="shrink-0 text-gray-500"
                                                                                                />
                                                                                            )}
                                                                                            <FileText
                                                                                                size={
                                                                                                    18
                                                                                                }
                                                                                                weight="duotone"
                                                                                                className="shrink-0 text-blue-600"
                                                                                            />
                                                                                            {roleDisplay
                                                                                                ?.coursePage
                                                                                                ?.viewContentNumbering !==
                                                                                                false && (
                                                                                                    <span className="w-7 shrink-0 rounded-md bg-gray-100 py-0.5 text-center font-mono text-xs font-medium text-gray-500 group-hover/module:bg-white">
                                                                                                        M
                                                                                                        {modIdx +
                                                                                                            1}
                                                                                                    </span>
                                                                                                )}
                                                                                            <span
                                                                                                className="truncate"
                                                                                                title={
                                                                                                    mod
                                                                                                        .module
                                                                                                        .module_name
                                                                                                }
                                                                                            >
                                                                                                {convertCapitalToTitleCase(
                                                                                                    mod
                                                                                                        .module
                                                                                                        .module_name
                                                                                                )}
                                                                                            </span>
                                                                                        </div>
                                                                                        {canEditStructure && (
                                                                                            <div className="flex gap-1">
                                                                                                <SortableDragHandle className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border border-neutral-300 opacity-0 transition-opacity hover:bg-gray-100 group-hover/module-trigger:opacity-100">
                                                                                                    <DotsSixVertical
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </SortableDragHandle>
                                                                                                <MyButton
                                                                                                    buttonType="secondary"
                                                                                                    layoutVariant="icon"
                                                                                                    scale="small"
                                                                                                    onClick={(
                                                                                                        e
                                                                                                    ) => {
                                                                                                        e.stopPropagation();
                                                                                                        openEditDialog(
                                                                                                            'module',
                                                                                                            {
                                                                                                                ...mod.module,
                                                                                                                subjectId:
                                                                                                                    subject.id,
                                                                                                            }
                                                                                                        );
                                                                                                    }}
                                                                                                    className="opacity-0 transition-opacity hover:bg-blue-100 hover:text-blue-600 group-hover/module-trigger:opacity-100"
                                                                                                >
                                                                                                    <PencilSimple
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </MyButton>
                                                                                                <MyButton
                                                                                                    buttonType="secondary"
                                                                                                    layoutVariant="icon"
                                                                                                    scale="small"
                                                                                                    onClick={(
                                                                                                        e
                                                                                                    ) => {
                                                                                                        e.stopPropagation();
                                                                                                        openDeleteConfirmation(
                                                                                                            'module',
                                                                                                            {
                                                                                                                id: mod
                                                                                                                    .module
                                                                                                                    .id,
                                                                                                                name: mod
                                                                                                                    .module
                                                                                                                    .module_name,
                                                                                                                subjectId:
                                                                                                                    subject.id,
                                                                                                            }
                                                                                                        );
                                                                                                    }}
                                                                                                    className="opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover/module-trigger:opacity-100"
                                                                                                >
                                                                                                    <Trash
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </MyButton>
                                                                                            </div>
                                                                                        )}
                                                                                    </CollapsibleTrigger>
                                                                                    <CollapsibleContent className="py-1 pl-10">
                                                                                        <div className="relative space-y-1.5 border-l-2 border-dashed border-gray-200 pl-6">
                                                                                            <AddChapterButton
                                                                                                moduleId={
                                                                                                    mod
                                                                                                        .module
                                                                                                        .id
                                                                                                }
                                                                                                sessionId={
                                                                                                    selectedSession
                                                                                                }
                                                                                                levelId={
                                                                                                    selectedLevel
                                                                                                }
                                                                                                subjectId={
                                                                                                    subject.id
                                                                                                }
                                                                                                packageSessionId={
                                                                                                    batchPackageSessionId ??
                                                                                                    ''
                                                                                                }
                                                                                                isTextButton
                                                                                            />
                                                                                            <Sortable
                                                                                                value={(
                                                                                                    mod.chapters ??
                                                                                                    []
                                                                                                ).map(
                                                                                                    (
                                                                                                        ch
                                                                                                    ) => ({
                                                                                                        ...ch,
                                                                                                        id: ch
                                                                                                            .chapter
                                                                                                            .id,
                                                                                                    })
                                                                                                )}
                                                                                                onValueChange={(
                                                                                                    reorderedChapters
                                                                                                ) =>
                                                                                                    handleChapterReorder(
                                                                                                        mod
                                                                                                            .module
                                                                                                            .id,
                                                                                                        reorderedChapters as unknown as ChapterWithSlidesStore[]
                                                                                                    )
                                                                                                }
                                                                                                orientation="vertical"
                                                                                            >
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
                                                                                                                ch
                                                                                                                    .chapter
                                                                                                                    .id
                                                                                                            );
                                                                                                        return (
                                                                                                            <SortableItem
                                                                                                                key={
                                                                                                                    ch
                                                                                                                        .chapter
                                                                                                                        .id
                                                                                                                }
                                                                                                                value={
                                                                                                                    ch
                                                                                                                        .chapter
                                                                                                                        .id
                                                                                                                }
                                                                                                                asChild
                                                                                                            >
                                                                                                                <div className="group/chapter-item relative">
                                                                                                                    <Collapsible
                                                                                                                        key={
                                                                                                                            ch
                                                                                                                                .chapter
                                                                                                                                .id
                                                                                                                        }
                                                                                                                        open={
                                                                                                                            isChapterOpen
                                                                                                                        }
                                                                                                                        onOpenChange={() =>
                                                                                                                            toggleChapter(
                                                                                                                                ch
                                                                                                                                    .chapter
                                                                                                                                    .id
                                                                                                                            )
                                                                                                                        }
                                                                                                                        className="group/chapter"
                                                                                                                    >
                                                                                                                        <CollapsibleTrigger className="group/chapter-trigger flex w-full items-center rounded-md px-2 py-1 text-left text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                                                                                                                            <div className="flex flex-1 items-center gap-2">
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
                                                                                                                                        16
                                                                                                                                    }
                                                                                                                                    weight="duotone"
                                                                                                                                    className="shrink-0 text-green-600"
                                                                                                                                />
                                                                                                                                {roleDisplay
                                                                                                                                    ?.coursePage
                                                                                                                                    ?.viewContentNumbering !==
                                                                                                                                    false && (
                                                                                                                                        <span className="w-7 shrink-0 rounded-md bg-gray-100 py-0.5 text-center font-mono text-xs text-gray-500 group-hover/chapter:bg-white">
                                                                                                                                            C
                                                                                                                                            {chIdx +
                                                                                                                                                1}
                                                                                                                                        </span>
                                                                                                                                    )}
                                                                                                                                <span
                                                                                                                                    className="truncate"
                                                                                                                                    title={
                                                                                                                                        ch
                                                                                                                                            .chapter
                                                                                                                                            .chapter_name
                                                                                                                                    }
                                                                                                                                >
                                                                                                                                    {convertCapitalToTitleCase(
                                                                                                                                        ch
                                                                                                                                            .chapter
                                                                                                                                            .chapter_name
                                                                                                                                    )}
                                                                                                                                </span>
                                                                                                                            </div>
                                                                                                                            {!readOnly && (
                                                                                                                                <div className="flex items-center gap-1">
                                                                                                                                    {canEditStructure && (
                                                                                                                                        <SortableDragHandle className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border border-neutral-300 opacity-0 transition-opacity hover:bg-gray-100 group-hover/chapter-trigger:opacity-100">
                                                                                                                                            <DotsSixVertical
                                                                                                                                                size={
                                                                                                                                                    14
                                                                                                                                                }
                                                                                                                                            />
                                                                                                                                        </SortableDragHandle>
                                                                                                                                    )}
                                                                                                                                    <DropdownMenu>
                                                                                                                                        <DropdownMenuTrigger
                                                                                                                                            asChild
                                                                                                                                        >
                                                                                                                                            <MyButton
                                                                                                                                                buttonType="secondary"
                                                                                                                                                layoutVariant="icon"
                                                                                                                                                scale="small"
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                }}
                                                                                                                                                className="opacity-0 transition-opacity group-hover/chapter-trigger:opacity-100"
                                                                                                                                            >
                                                                                                                                                <DotsThree
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    weight="bold"
                                                                                                                                                />
                                                                                                                                            </MyButton>
                                                                                                                                        </DropdownMenuTrigger>
                                                                                                                                        <DropdownMenuContent
                                                                                                                                            align="end"
                                                                                                                                            onClick={(
                                                                                                                                                e
                                                                                                                                            ) =>
                                                                                                                                                e.stopPropagation()
                                                                                                                                            }
                                                                                                                                        >
                                                                                                                                            <DropdownMenuItem
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    openEditDialog(
                                                                                                                                                        'chapter',
                                                                                                                                                        {
                                                                                                                                                            ...ch.chapter,
                                                                                                                                                            subjectId:
                                                                                                                                                                subject.id,
                                                                                                                                                            moduleId:
                                                                                                                                                                mod
                                                                                                                                                                    .module
                                                                                                                                                                    .id,
                                                                                                                                                        }
                                                                                                                                                    );
                                                                                                                                                }}
                                                                                                                                            >
                                                                                                                                                <PencilSimple
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    className="mr-2"
                                                                                                                                                />
                                                                                                                                                Edit
                                                                                                                                            </DropdownMenuItem>
                                                                                                                                            <DropdownMenuItem
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    openDeleteConfirmation(
                                                                                                                                                        'chapter',
                                                                                                                                                        {
                                                                                                                                                            id: ch
                                                                                                                                                                .chapter
                                                                                                                                                                .id,
                                                                                                                                                            name: ch
                                                                                                                                                                .chapter
                                                                                                                                                                .chapter_name,
                                                                                                                                                            subjectId:
                                                                                                                                                                subject.id,
                                                                                                                                                            moduleId:
                                                                                                                                                                mod
                                                                                                                                                                    .module
                                                                                                                                                                    .id,
                                                                                                                                                        }
                                                                                                                                                    );
                                                                                                                                                }}
                                                                                                                                                className="text-red-600 focus:text-red-600"
                                                                                                                                            >
                                                                                                                                                <Trash
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    className="mr-2"
                                                                                                                                                />
                                                                                                                                                Delete
                                                                                                                                            </DropdownMenuItem>
                                                                                                                                            {dripConditionsEnabled && (
                                                                                                                                                <DropdownMenuItem
                                                                                                                                                    onClick={(
                                                                                                                                                        e
                                                                                                                                                    ) => {
                                                                                                                                                        e.stopPropagation();
                                                                                                                                                        handleOpenChapterDripDialog(
                                                                                                                                                            ch
                                                                                                                                                                .chapter
                                                                                                                                                                .id,
                                                                                                                                                            ch
                                                                                                                                                                .chapter
                                                                                                                                                                .chapter_name
                                                                                                                                                        );
                                                                                                                                                    }}
                                                                                                                                                >
                                                                                                                                                    <Info
                                                                                                                                                        size={
                                                                                                                                                            16
                                                                                                                                                        }
                                                                                                                                                        className="mr-2"
                                                                                                                                                    />
                                                                                                                                                    Drip
                                                                                                                                                    Condition
                                                                                                                                                </DropdownMenuItem>
                                                                                                                                            )}
                                                                                                                                        </DropdownMenuContent>
                                                                                                                                    </DropdownMenu>
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </CollapsibleTrigger>
                                                                                                                        <CollapsibleContent className="py-1 pl-9">
                                                                                                                            <div className="relative space-y-1.5 border-l-2 border-dashed border-gray-200 pl-6">
                                                                                                                                {!readOnly && (
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
                                                                                                                                            className="text-primary-400 group-hover:text-primary-500"
                                                                                                                                        />
                                                                                                                                        <span className="font-medium">
                                                                                                                                            Add{' '}
                                                                                                                                            {getTerminology(
                                                                                                                                                ContentTerms.Slides,
                                                                                                                                                SystemTerms.Slides
                                                                                                                                            )}
                                                                                                                                        </span>
                                                                                                                                    </MyButton>
                                                                                                                                )}

                                                                                                                                {(
                                                                                                                                    chapterSlidesMap[
                                                                                                                                    ch
                                                                                                                                        .chapter
                                                                                                                                        .id
                                                                                                                                    ] ??
                                                                                                                                    []
                                                                                                                                )
                                                                                                                                    .length ===
                                                                                                                                    0 ? (
                                                                                                                                    <div className="px-2 py-1 text-xs text-gray-400">
                                                                                                                                        No{' '}
                                                                                                                                        {getTerminology(
                                                                                                                                            ContentTerms.Slides,
                                                                                                                                            SystemTerms.Slides
                                                                                                                                        )}{' '}
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
                                                                                                                                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                                                                                                                                onClick={() => {
                                                                                                                                                    if (
                                                                                                                                                        readOnly
                                                                                                                                                    )
                                                                                                                                                        return;
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
                                                                                                                                                {roleDisplay
                                                                                                                                                    ?.coursePage
                                                                                                                                                    ?.viewContentNumbering !==
                                                                                                                                                    false && (
                                                                                                                                                        <span className="w-7 shrink-0 text-center font-mono text-xs text-gray-400">
                                                                                                                                                            S
                                                                                                                                                            {sIdx +
                                                                                                                                                                1}
                                                                                                                                                        </span>
                                                                                                                                                    )}
                                                                                                                                                {getIcon(
                                                                                                                                                    (
                                                                                                                                                        slide as any
                                                                                                                                                    )
                                                                                                                                                        .html_video_slide
                                                                                                                                                        ? 'HTML_VIDEO'
                                                                                                                                                        : slide.source_type,
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
                                                                                                                </div>
                                                                                                            </SortableItem>
                                                                                                        );
                                                                                                    }
                                                                                                )}
                                                                                            </Sortable>
                                                                                        </div>
                                                                                    </CollapsibleContent>
                                                                                </Collapsible>
                                                                            </div>
                                                                        </SortableItem>
                                                                    );
                                                                })}
                                                            </Sortable>
                                                        </div>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </div>
                                        </SortableItem>
                                    );
                                })}
                            </Sortable>
                        )}
                        {courseStructure === 4 && (
                            <Sortable
                                value={subjects}
                                onValueChange={handleSubjectReorder}
                                orientation="vertical"
                            >
                                {subjects.map((subject) => {
                                    const isSubjectOpen = openSubjects.has(subject.id);

                                    return (
                                        <SortableItem key={subject.id} value={subject.id} asChild>
                                            <div className="group/subject-item relative">
                                                <Collapsible
                                                    open={isSubjectOpen}
                                                    onOpenChange={
                                                        readOnly
                                                            ? undefined
                                                            : () => toggleSubject(subject.id)
                                                    }
                                                    className="group"
                                                >
                                                    <CollapsibleContent className="py-1">
                                                        <div className="relative space-y-1.5 border-gray-200">
                                                            <div className="absolute -left-[13px] top-0 h-full">
                                                                <div className="sticky top-0 flex h-full flex-col items-center" />
                                                            </div>

                                                            {canEditStructure && (
                                                                <AddModulesButton
                                                                    isTextButton
                                                                    subjectId={subject.id}
                                                                    onAddModuleBySubjectId={
                                                                        handleAddModule
                                                                    }
                                                                />
                                                            )}
                                                            <Sortable
                                                                value={(
                                                                    subjectModulesMap[subject.id] ??
                                                                    []
                                                                ).map((m) => ({
                                                                    ...m,
                                                                    id: m.module.id,
                                                                }))}
                                                                onValueChange={(reorderedModules) =>
                                                                    handleModuleReorder(
                                                                        subject.id,
                                                                        reorderedModules as unknown as {
                                                                            module: Module;
                                                                            chapters: ChapterWithSlidesStore[];
                                                                        }[]
                                                                    )
                                                                }
                                                                orientation="vertical"
                                                            >
                                                                {(
                                                                    subjectModulesMap[subject.id] ??
                                                                    []
                                                                ).map((mod, modIdx) => {
                                                                    const isModuleOpen =
                                                                        openModules.has(
                                                                            mod.module.id
                                                                        );

                                                                    return (
                                                                        <SortableItem
                                                                            key={mod.module.id}
                                                                            value={mod.module.id}
                                                                            asChild
                                                                        >
                                                                            <div className="group/module-item relative">
                                                                                <Collapsible
                                                                                    open={
                                                                                        isModuleOpen
                                                                                    }
                                                                                    onOpenChange={() =>
                                                                                        toggleModule(
                                                                                            mod
                                                                                                .module
                                                                                                .id
                                                                                        )
                                                                                    }
                                                                                    className="group/module"
                                                                                >
                                                                                    <CollapsibleTrigger className="group/module-trigger flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                                                                                        <div className="flex flex-1 items-center gap-2.5">
                                                                                            {isModuleOpen ? (
                                                                                                <CaretDown
                                                                                                    size={
                                                                                                        16
                                                                                                    }
                                                                                                    className="shrink-0 text-gray-500"
                                                                                                />
                                                                                            ) : (
                                                                                                <CaretRight
                                                                                                    size={
                                                                                                        16
                                                                                                    }
                                                                                                    className="shrink-0 text-gray-500"
                                                                                                />
                                                                                            )}
                                                                                            <FileText
                                                                                                size={
                                                                                                    18
                                                                                                }
                                                                                                weight="duotone"
                                                                                                className="shrink-0 text-blue-600"
                                                                                            />
                                                                                            {roleDisplay
                                                                                                ?.coursePage
                                                                                                ?.viewContentNumbering !==
                                                                                                false && (
                                                                                                    <span className="w-7 shrink-0 rounded-md bg-gray-100 py-0.5 text-center font-mono text-xs font-medium text-gray-500 group-hover/module:bg-white">
                                                                                                        M
                                                                                                        {modIdx +
                                                                                                            1}
                                                                                                    </span>
                                                                                                )}
                                                                                            <span
                                                                                                className="truncate"
                                                                                                title={
                                                                                                    mod
                                                                                                        .module
                                                                                                        .module_name
                                                                                                }
                                                                                            >
                                                                                                {convertCapitalToTitleCase(
                                                                                                    mod
                                                                                                        .module
                                                                                                        .module_name
                                                                                                )}
                                                                                            </span>
                                                                                        </div>
                                                                                        {canEditStructure && (
                                                                                            <div className="flex gap-1">
                                                                                                <SortableDragHandle className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border border-neutral-300 opacity-0 transition-opacity hover:bg-gray-100 group-hover/module-trigger:opacity-100">
                                                                                                    <DotsSixVertical
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </SortableDragHandle>
                                                                                                <MyButton
                                                                                                    buttonType="secondary"
                                                                                                    layoutVariant="icon"
                                                                                                    scale="small"
                                                                                                    onClick={(
                                                                                                        e
                                                                                                    ) => {
                                                                                                        e.stopPropagation();
                                                                                                        openEditDialog(
                                                                                                            'module',
                                                                                                            {
                                                                                                                ...mod.module,
                                                                                                                subjectId:
                                                                                                                    subject.id,
                                                                                                            }
                                                                                                        );
                                                                                                    }}
                                                                                                    className="opacity-0 transition-opacity hover:bg-blue-100 hover:text-blue-600 group-hover/module-trigger:opacity-100"
                                                                                                >
                                                                                                    <PencilSimple
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </MyButton>
                                                                                                <MyButton
                                                                                                    buttonType="secondary"
                                                                                                    layoutVariant="icon"
                                                                                                    scale="small"
                                                                                                    onClick={(
                                                                                                        e
                                                                                                    ) => {
                                                                                                        e.stopPropagation();
                                                                                                        openDeleteConfirmation(
                                                                                                            'module',
                                                                                                            {
                                                                                                                id: mod
                                                                                                                    .module
                                                                                                                    .id,
                                                                                                                name: mod
                                                                                                                    .module
                                                                                                                    .module_name,
                                                                                                                subjectId:
                                                                                                                    subject.id,
                                                                                                            }
                                                                                                        );
                                                                                                    }}
                                                                                                    className="opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover/module-trigger:opacity-100"
                                                                                                >
                                                                                                    <Trash
                                                                                                        size={
                                                                                                            14
                                                                                                        }
                                                                                                    />
                                                                                                </MyButton>
                                                                                            </div>
                                                                                        )}
                                                                                    </CollapsibleTrigger>
                                                                                    <CollapsibleContent className="py-1 pl-10">
                                                                                        <div className="relative space-y-1.5 border-l-2 border-dashed border-gray-200 pl-6">
                                                                                            <AddChapterButton
                                                                                                moduleId={
                                                                                                    mod
                                                                                                        .module
                                                                                                        .id
                                                                                                }
                                                                                                sessionId={
                                                                                                    selectedSession
                                                                                                }
                                                                                                levelId={
                                                                                                    selectedLevel
                                                                                                }
                                                                                                subjectId={
                                                                                                    subject.id
                                                                                                }
                                                                                                packageSessionId={
                                                                                                    batchPackageSessionId ??
                                                                                                    ''
                                                                                                }
                                                                                                isTextButton
                                                                                            />
                                                                                            <Sortable
                                                                                                value={(
                                                                                                    mod.chapters ??
                                                                                                    []
                                                                                                ).map(
                                                                                                    (
                                                                                                        ch
                                                                                                    ) => ({
                                                                                                        ...ch,
                                                                                                        id: ch
                                                                                                            .chapter
                                                                                                            .id,
                                                                                                    })
                                                                                                )}
                                                                                                onValueChange={(
                                                                                                    reorderedChapters
                                                                                                ) =>
                                                                                                    handleChapterReorder(
                                                                                                        mod
                                                                                                            .module
                                                                                                            .id,
                                                                                                        reorderedChapters as unknown as ChapterWithSlidesStore[]
                                                                                                    )
                                                                                                }
                                                                                                orientation="vertical"
                                                                                            >
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
                                                                                                                ch
                                                                                                                    .chapter
                                                                                                                    .id
                                                                                                            );
                                                                                                        return (
                                                                                                            <SortableItem
                                                                                                                key={
                                                                                                                    ch
                                                                                                                        .chapter
                                                                                                                        .id
                                                                                                                }
                                                                                                                value={
                                                                                                                    ch
                                                                                                                        .chapter
                                                                                                                        .id
                                                                                                                }
                                                                                                                asChild
                                                                                                            >
                                                                                                                <div className="group/chapter-item relative">
                                                                                                                    <Collapsible
                                                                                                                        key={
                                                                                                                            ch
                                                                                                                                .chapter
                                                                                                                                .id
                                                                                                                        }
                                                                                                                        open={
                                                                                                                            isChapterOpen
                                                                                                                        }
                                                                                                                        onOpenChange={() =>
                                                                                                                            toggleChapter(
                                                                                                                                ch
                                                                                                                                    .chapter
                                                                                                                                    .id
                                                                                                                            )
                                                                                                                        }
                                                                                                                        className="group/chapter"
                                                                                                                    >
                                                                                                                        <CollapsibleTrigger className="group/chapter-trigger flex w-full items-center rounded-md px-2 py-1 text-left text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                                                                                                                            <div className="flex flex-1 items-center gap-2">
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
                                                                                                                                        16
                                                                                                                                    }
                                                                                                                                    weight="duotone"
                                                                                                                                    className="shrink-0 text-green-600"
                                                                                                                                />
                                                                                                                                {roleDisplay
                                                                                                                                    ?.coursePage
                                                                                                                                    ?.viewContentNumbering !==
                                                                                                                                    false && (
                                                                                                                                        <span className="w-7 shrink-0 rounded-md bg-gray-100 py-0.5 text-center font-mono text-xs text-gray-500 group-hover/chapter:bg-white">
                                                                                                                                            C
                                                                                                                                            {chIdx +
                                                                                                                                                1}
                                                                                                                                        </span>
                                                                                                                                    )}
                                                                                                                                <span
                                                                                                                                    className="truncate"
                                                                                                                                    title={
                                                                                                                                        ch
                                                                                                                                            .chapter
                                                                                                                                            .chapter_name
                                                                                                                                    }
                                                                                                                                >
                                                                                                                                    {convertCapitalToTitleCase(
                                                                                                                                        ch
                                                                                                                                            .chapter
                                                                                                                                            .chapter_name
                                                                                                                                    )}
                                                                                                                                </span>
                                                                                                                            </div>
                                                                                                                            {canEditStructure && (
                                                                                                                                <div className="flex items-center gap-1">
                                                                                                                                    <SortableDragHandle className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border border-neutral-300 opacity-0 transition-opacity hover:bg-gray-100 group-hover/chapter-trigger:opacity-100">
                                                                                                                                        <DotsSixVertical
                                                                                                                                            size={
                                                                                                                                                14
                                                                                                                                            }
                                                                                                                                        />
                                                                                                                                    </SortableDragHandle>
                                                                                                                                    <DropdownMenu>
                                                                                                                                        <DropdownMenuTrigger
                                                                                                                                            asChild
                                                                                                                                        >
                                                                                                                                            <MyButton
                                                                                                                                                buttonType="secondary"
                                                                                                                                                layoutVariant="icon"
                                                                                                                                                scale="small"
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                }}
                                                                                                                                                className="opacity-0 transition-opacity group-hover/chapter-trigger:opacity-100"
                                                                                                                                            >
                                                                                                                                                <DotsThree
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    weight="bold"
                                                                                                                                                />
                                                                                                                                            </MyButton>
                                                                                                                                        </DropdownMenuTrigger>
                                                                                                                                        <DropdownMenuContent
                                                                                                                                            align="end"
                                                                                                                                            onClick={(
                                                                                                                                                e
                                                                                                                                            ) =>
                                                                                                                                                e.stopPropagation()
                                                                                                                                            }
                                                                                                                                        >
                                                                                                                                            <DropdownMenuItem
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    openEditDialog(
                                                                                                                                                        'chapter',
                                                                                                                                                        {
                                                                                                                                                            ...ch.chapter,
                                                                                                                                                            subjectId:
                                                                                                                                                                subject.id,
                                                                                                                                                            moduleId:
                                                                                                                                                                mod
                                                                                                                                                                    .module
                                                                                                                                                                    .id,
                                                                                                                                                        }
                                                                                                                                                    );
                                                                                                                                                }}
                                                                                                                                            >
                                                                                                                                                <PencilSimple
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    className="mr-2"
                                                                                                                                                />
                                                                                                                                                Edit
                                                                                                                                            </DropdownMenuItem>
                                                                                                                                            <DropdownMenuItem
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    openDeleteConfirmation(
                                                                                                                                                        'chapter',
                                                                                                                                                        {
                                                                                                                                                            id: ch
                                                                                                                                                                .chapter
                                                                                                                                                                .id,
                                                                                                                                                            name: ch
                                                                                                                                                                .chapter
                                                                                                                                                                .chapter_name,
                                                                                                                                                            subjectId:
                                                                                                                                                                subject.id,
                                                                                                                                                            moduleId:
                                                                                                                                                                mod
                                                                                                                                                                    .module
                                                                                                                                                                    .id,
                                                                                                                                                        }
                                                                                                                                                    );
                                                                                                                                                }}
                                                                                                                                                className="text-red-600 focus:text-red-600"
                                                                                                                                            >
                                                                                                                                                <Trash
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    className="mr-2"
                                                                                                                                                />
                                                                                                                                                Delete
                                                                                                                                            </DropdownMenuItem>
                                                                                                                                            {dripConditionsEnabled && (
                                                                                                                                                <DropdownMenuItem
                                                                                                                                                    onClick={(
                                                                                                                                                        e
                                                                                                                                                    ) => {
                                                                                                                                                        e.stopPropagation();
                                                                                                                                                        handleOpenChapterDripDialog(
                                                                                                                                                            ch
                                                                                                                                                                .chapter
                                                                                                                                                                .id,
                                                                                                                                                            ch
                                                                                                                                                                .chapter
                                                                                                                                                                .chapter_name
                                                                                                                                                        );
                                                                                                                                                    }}
                                                                                                                                                >
                                                                                                                                                    <Info
                                                                                                                                                        size={
                                                                                                                                                            16
                                                                                                                                                        }
                                                                                                                                                        className="mr-2"
                                                                                                                                                    />
                                                                                                                                                    Drip
                                                                                                                                                    Condition
                                                                                                                                                </DropdownMenuItem>
                                                                                                                                            )}
                                                                                                                                        </DropdownMenuContent>
                                                                                                                                    </DropdownMenu>
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </CollapsibleTrigger>
                                                                                                                        <CollapsibleContent className="py-1 pl-9">
                                                                                                                            <div className="relative space-y-1.5 border-l-2 border-dashed border-gray-200 pl-6">
                                                                                                                                {!readOnly && (
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
                                                                                                                                            className="text-primary-400 group-hover:text-primary-500"
                                                                                                                                        />
                                                                                                                                        <span className="font-medium">
                                                                                                                                            Add{' '}
                                                                                                                                            {getTerminology(
                                                                                                                                                ContentTerms.Slides,
                                                                                                                                                SystemTerms.Slides
                                                                                                                                            )}
                                                                                                                                        </span>
                                                                                                                                    </MyButton>
                                                                                                                                )}

                                                                                                                                {(
                                                                                                                                    chapterSlidesMap[
                                                                                                                                    ch
                                                                                                                                        .chapter
                                                                                                                                        .id
                                                                                                                                    ] ??
                                                                                                                                    []
                                                                                                                                )
                                                                                                                                    .length ===
                                                                                                                                    0 ? (
                                                                                                                                    <div className="px-2 py-1 text-xs text-gray-400">
                                                                                                                                        No{' '}
                                                                                                                                        {getTerminology(
                                                                                                                                            ContentTerms.Slides,
                                                                                                                                            SystemTerms.Slides
                                                                                                                                        )}{' '}
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
                                                                                                                                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                                                                                                                                onClick={() => {
                                                                                                                                                    if (
                                                                                                                                                        readOnly
                                                                                                                                                    )
                                                                                                                                                        return;
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
                                                                                                                                                {roleDisplay
                                                                                                                                                    ?.coursePage
                                                                                                                                                    ?.viewContentNumbering !==
                                                                                                                                                    false && (
                                                                                                                                                        <span className="w-7 shrink-0 text-center font-mono text-xs text-gray-400">
                                                                                                                                                            S
                                                                                                                                                            {sIdx +
                                                                                                                                                                1}
                                                                                                                                                        </span>
                                                                                                                                                    )}
                                                                                                                                                {getIcon(
                                                                                                                                                    (
                                                                                                                                                        slide as any
                                                                                                                                                    )
                                                                                                                                                        .html_video_slide
                                                                                                                                                        ? 'HTML_VIDEO'
                                                                                                                                                        : slide.source_type,
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
                                                                                                                </div>
                                                                                                            </SortableItem>
                                                                                                        );
                                                                                                    }
                                                                                                )}
                                                                                            </Sortable>
                                                                                        </div>
                                                                                    </CollapsibleContent>
                                                                                </Collapsible>
                                                                            </div>
                                                                        </SortableItem>
                                                                    );
                                                                })}
                                                            </Sortable>
                                                        </div>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </div>
                                        </SortableItem>
                                    );
                                })}
                            </Sortable>
                        )}
                        {courseStructure === 3 && (
                            <Sortable
                                value={subjects}
                                onValueChange={handleSubjectReorder}
                                orientation="vertical"
                            >
                                {subjects.map((subject) => {
                                    const isSubjectOpen = openSubjects.has(subject.id);

                                    return (
                                        <SortableItem key={subject.id} value={subject.id} asChild>
                                            <div className="group/subject-item">
                                                <Collapsible
                                                    open={isSubjectOpen}
                                                    onOpenChange={
                                                        readOnly
                                                            ? undefined
                                                            : () => toggleSubject(subject.id)
                                                    }
                                                    className="group"
                                                >
                                                    <CollapsibleContent className="py-1">
                                                        <div className="relative space-y-1.5 border-gray-200">
                                                            <div className="absolute -left-[13px] top-0 h-full">
                                                                <div className="sticky top-0 flex h-full flex-col items-center" />
                                                            </div>

                                                            <Sortable
                                                                value={(
                                                                    subjectModulesMap[subject.id] ??
                                                                    []
                                                                ).map((m) => ({
                                                                    ...m,
                                                                    id: m.module.id,
                                                                }))}
                                                                onValueChange={(reorderedModules) =>
                                                                    handleModuleReorder(
                                                                        subject.id,
                                                                        reorderedModules as unknown as {
                                                                            module: Module;
                                                                            chapters: ChapterWithSlidesStore[];
                                                                        }[]
                                                                    )
                                                                }
                                                                orientation="vertical"
                                                            >
                                                                {(
                                                                    subjectModulesMap[subject.id] ??
                                                                    []
                                                                ).map((mod, modIdx) => {
                                                                    const isModuleOpen =
                                                                        openModules.has(
                                                                            mod.module.id
                                                                        );

                                                                    return (
                                                                        <SortableItem
                                                                            key={mod.module.id}
                                                                            value={mod.module.id}
                                                                            asChild
                                                                        >
                                                                            <div className="group/module-item relative">
                                                                                <Collapsible
                                                                                    open={
                                                                                        isModuleOpen
                                                                                    }
                                                                                    onOpenChange={() =>
                                                                                        toggleModule(
                                                                                            mod
                                                                                                .module
                                                                                                .id
                                                                                        )
                                                                                    }
                                                                                    className="group/module"
                                                                                >
                                                                                    <CollapsibleContent className="py-1">
                                                                                        <div className="relative space-y-1.5  border-gray-200">
                                                                                            <AddChapterButton
                                                                                                moduleId={
                                                                                                    mod
                                                                                                        .module
                                                                                                        .id
                                                                                                }
                                                                                                sessionId={
                                                                                                    selectedSession
                                                                                                }
                                                                                                levelId={
                                                                                                    selectedLevel
                                                                                                }
                                                                                                subjectId={
                                                                                                    subject.id
                                                                                                }
                                                                                                packageSessionId={
                                                                                                    batchPackageSessionId ??
                                                                                                    ''
                                                                                                }
                                                                                                isTextButton
                                                                                            />
                                                                                            <Sortable
                                                                                                value={(
                                                                                                    mod.chapters ??
                                                                                                    []
                                                                                                ).map(
                                                                                                    (
                                                                                                        ch
                                                                                                    ) => ({
                                                                                                        ...ch,
                                                                                                        id: ch
                                                                                                            .chapter
                                                                                                            .id,
                                                                                                    })
                                                                                                )}
                                                                                                onValueChange={(
                                                                                                    reorderedChapters
                                                                                                ) =>
                                                                                                    handleChapterReorder(
                                                                                                        mod
                                                                                                            .module
                                                                                                            .id,
                                                                                                        reorderedChapters as unknown as ChapterWithSlidesStore[]
                                                                                                    )
                                                                                                }
                                                                                                orientation="vertical"
                                                                                            >
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
                                                                                                                ch
                                                                                                                    .chapter
                                                                                                                    .id
                                                                                                            );
                                                                                                        return (
                                                                                                            <SortableItem
                                                                                                                key={
                                                                                                                    ch
                                                                                                                        .chapter
                                                                                                                        .id
                                                                                                                }
                                                                                                                value={
                                                                                                                    ch
                                                                                                                        .chapter
                                                                                                                        .id
                                                                                                                }
                                                                                                                asChild
                                                                                                            >
                                                                                                                <div className="group/chapter-item relative">
                                                                                                                    <Collapsible
                                                                                                                        key={
                                                                                                                            ch
                                                                                                                                .chapter
                                                                                                                                .id
                                                                                                                        }
                                                                                                                        open={
                                                                                                                            isChapterOpen
                                                                                                                        }
                                                                                                                        onOpenChange={() =>
                                                                                                                            toggleChapter(
                                                                                                                                ch
                                                                                                                                    .chapter
                                                                                                                                    .id
                                                                                                                            )
                                                                                                                        }
                                                                                                                        className="group/chapter"
                                                                                                                    >
                                                                                                                        <CollapsibleTrigger className="group/chapter-trigger flex w-full items-center rounded-md px-2 py-1 text-left text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                                                                                                                            <div className="flex flex-1 items-center gap-2">
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
                                                                                                                                        16
                                                                                                                                    }
                                                                                                                                    weight="duotone"
                                                                                                                                    className="shrink-0 text-green-600"
                                                                                                                                />
                                                                                                                                {roleDisplay
                                                                                                                                    ?.coursePage
                                                                                                                                    ?.viewContentNumbering !==
                                                                                                                                    false && (
                                                                                                                                        <span className="w-7 shrink-0 rounded-md bg-gray-100 py-0.5 text-center font-mono text-xs text-gray-500 group-hover/chapter:bg-white">
                                                                                                                                            C
                                                                                                                                            {chIdx +
                                                                                                                                                1}
                                                                                                                                        </span>
                                                                                                                                    )}
                                                                                                                                <span
                                                                                                                                    className="truncate"
                                                                                                                                    title={
                                                                                                                                        ch
                                                                                                                                            .chapter
                                                                                                                                            .chapter_name
                                                                                                                                    }
                                                                                                                                >
                                                                                                                                    {convertCapitalToTitleCase(
                                                                                                                                        ch
                                                                                                                                            .chapter
                                                                                                                                            .chapter_name
                                                                                                                                    )}
                                                                                                                                </span>
                                                                                                                            </div>
                                                                                                                            {canEditStructure && (
                                                                                                                                <div className="flex items-center gap-1">
                                                                                                                                    <SortableDragHandle className="inline-flex size-6 cursor-grab items-center justify-center rounded-md border border-neutral-300 opacity-0 transition-opacity hover:bg-gray-100 group-hover/chapter-trigger:opacity-100">
                                                                                                                                        <DotsSixVertical
                                                                                                                                            size={
                                                                                                                                                14
                                                                                                                                            }
                                                                                                                                        />
                                                                                                                                    </SortableDragHandle>
                                                                                                                                    <DropdownMenu>
                                                                                                                                        <DropdownMenuTrigger
                                                                                                                                            asChild
                                                                                                                                        >
                                                                                                                                            <MyButton
                                                                                                                                                buttonType="secondary"
                                                                                                                                                layoutVariant="icon"
                                                                                                                                                scale="small"
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                }}
                                                                                                                                                className="opacity-0 transition-opacity group-hover/chapter-trigger:opacity-100"
                                                                                                                                            >
                                                                                                                                                <DotsThree
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    weight="bold"
                                                                                                                                                />
                                                                                                                                            </MyButton>
                                                                                                                                        </DropdownMenuTrigger>
                                                                                                                                        <DropdownMenuContent
                                                                                                                                            align="end"
                                                                                                                                            onClick={(
                                                                                                                                                e
                                                                                                                                            ) =>
                                                                                                                                                e.stopPropagation()
                                                                                                                                            }
                                                                                                                                        >
                                                                                                                                            <DropdownMenuItem
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    openEditDialog(
                                                                                                                                                        'chapter',
                                                                                                                                                        {
                                                                                                                                                            ...ch.chapter,
                                                                                                                                                            subjectId:
                                                                                                                                                                subject.id,
                                                                                                                                                            moduleId:
                                                                                                                                                                mod
                                                                                                                                                                    .module
                                                                                                                                                                    .id,
                                                                                                                                                        }
                                                                                                                                                    );
                                                                                                                                                }}
                                                                                                                                            >
                                                                                                                                                <PencilSimple
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    className="mr-2"
                                                                                                                                                />
                                                                                                                                                Edit
                                                                                                                                            </DropdownMenuItem>
                                                                                                                                            <DropdownMenuItem
                                                                                                                                                onClick={(
                                                                                                                                                    e
                                                                                                                                                ) => {
                                                                                                                                                    e.stopPropagation();
                                                                                                                                                    openDeleteConfirmation(
                                                                                                                                                        'chapter',
                                                                                                                                                        {
                                                                                                                                                            id: ch
                                                                                                                                                                .chapter
                                                                                                                                                                .id,
                                                                                                                                                            name: ch
                                                                                                                                                                .chapter
                                                                                                                                                                .chapter_name,
                                                                                                                                                            subjectId:
                                                                                                                                                                subject.id,
                                                                                                                                                            moduleId:
                                                                                                                                                                mod
                                                                                                                                                                    .module
                                                                                                                                                                    .id,
                                                                                                                                                        }
                                                                                                                                                    );
                                                                                                                                                }}
                                                                                                                                                className="text-red-600 focus:text-red-600"
                                                                                                                                            >
                                                                                                                                                <Trash
                                                                                                                                                    size={
                                                                                                                                                        16
                                                                                                                                                    }
                                                                                                                                                    className="mr-2"
                                                                                                                                                />
                                                                                                                                                Delete
                                                                                                                                            </DropdownMenuItem>
                                                                                                                                            {dripConditionsEnabled && (
                                                                                                                                                <DropdownMenuItem
                                                                                                                                                    onClick={(
                                                                                                                                                        e
                                                                                                                                                    ) => {
                                                                                                                                                        e.stopPropagation();
                                                                                                                                                        handleOpenChapterDripDialog(
                                                                                                                                                            ch
                                                                                                                                                                .chapter
                                                                                                                                                                .id,
                                                                                                                                                            ch
                                                                                                                                                                .chapter
                                                                                                                                                                .chapter_name
                                                                                                                                                        );
                                                                                                                                                    }}
                                                                                                                                                >
                                                                                                                                                    <Info
                                                                                                                                                        size={
                                                                                                                                                            16
                                                                                                                                                        }
                                                                                                                                                        className="mr-2"
                                                                                                                                                    />
                                                                                                                                                    Drip
                                                                                                                                                    Condition
                                                                                                                                                </DropdownMenuItem>
                                                                                                                                            )}
                                                                                                                                        </DropdownMenuContent>
                                                                                                                                    </DropdownMenu>
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </CollapsibleTrigger>
                                                                                                                        <CollapsibleContent className="py-1 pl-9">
                                                                                                                            <div className="relative space-y-1.5 border-l-2 border-dashed border-gray-200 pl-6">
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
                                                                                                                                        className="text-primary-400 group-hover:text-primary-500"
                                                                                                                                    />
                                                                                                                                    <span className="font-medium">
                                                                                                                                        Add{' '}
                                                                                                                                        {getTerminology(
                                                                                                                                            ContentTerms.Slides,
                                                                                                                                            SystemTerms.Slides
                                                                                                                                        )}
                                                                                                                                    </span>
                                                                                                                                </MyButton>

                                                                                                                                {(
                                                                                                                                    chapterSlidesMap[
                                                                                                                                    ch
                                                                                                                                        .chapter
                                                                                                                                        .id
                                                                                                                                    ] ??
                                                                                                                                    []
                                                                                                                                )
                                                                                                                                    .length ===
                                                                                                                                    0 ? (
                                                                                                                                    <div className="px-2 py-1 text-xs text-gray-400">
                                                                                                                                        No{' '}
                                                                                                                                        {getTerminology(
                                                                                                                                            ContentTerms.Slides,
                                                                                                                                            SystemTerms.Slides
                                                                                                                                        )}{' '}
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
                                                                                                                                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                                                                                                                                onClick={() => {
                                                                                                                                                    if (
                                                                                                                                                        readOnly
                                                                                                                                                    )
                                                                                                                                                        return;
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
                                                                                                                                                {roleDisplay
                                                                                                                                                    ?.coursePage
                                                                                                                                                    ?.viewContentNumbering !==
                                                                                                                                                    false && (
                                                                                                                                                        <span className="w-7 shrink-0 text-center font-mono text-xs text-gray-400">
                                                                                                                                                            S
                                                                                                                                                            {sIdx +
                                                                                                                                                                1}
                                                                                                                                                        </span>
                                                                                                                                                    )}
                                                                                                                                                {getIcon(
                                                                                                                                                    (
                                                                                                                                                        slide as any
                                                                                                                                                    )
                                                                                                                                                        .html_video_slide
                                                                                                                                                        ? 'HTML_VIDEO'
                                                                                                                                                        : slide.source_type,
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
                                                                                                                </div>
                                                                                                            </SortableItem>
                                                                                                        );
                                                                                                    }
                                                                                                )}
                                                                                            </Sortable>
                                                                                        </div>
                                                                                    </CollapsibleContent>
                                                                                </Collapsible>
                                                                            </div>
                                                                        </SortableItem>
                                                                    );
                                                                })}
                                                            </Sortable>
                                                        </div>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </div>
                                        </SortableItem>
                                    );
                                })}
                            </Sortable>
                        )}

                        {courseStructure === 2 && (
                            <div className="space-y-1.5">
                                {Object.entries(subjectModulesMap).flatMap(([subjectId, modules]) =>
                                    modules.flatMap((mod) =>
                                        mod.chapters.flatMap((ch) => [
                                            // Add Slide button for this chapter (now before slides)
                                            <MyButton
                                                key={`add-slide-${ch.chapter.id}`}
                                                buttonType="text"
                                                onClick={() =>
                                                    readOnly
                                                        ? undefined
                                                        : handleSlideNavigation(
                                                            subjectId,
                                                            mod.module.id,
                                                            ch.chapter.id,
                                                            '' // Empty slideId for new slide
                                                        )
                                                }
                                                className="!m-0 flex w-fit cursor-pointer flex-row items-center justify-start gap-2 px-0 pl-2 text-primary-500"
                                            >
                                                <Plus
                                                    size={14}
                                                    weight="bold"
                                                    className="text-primary-400 group-hover:text-primary-500"
                                                />
                                                <span className="font-medium">
                                                    Add{' '}
                                                    {getTerminology(
                                                        ContentTerms.Slides,
                                                        SystemTerms.Slides
                                                    )}
                                                </span>
                                            </MyButton>,
                                            // Slides for this chapter
                                            ...(chapterSlidesMap[ch.chapter.id] ?? []).map(
                                                (slide, sIdx) => (
                                                    <div
                                                        key={slide.id}
                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                                        onClick={() => {
                                                            handleSlideNavigation(
                                                                subjectId,
                                                                mod.module.id,
                                                                ch.chapter.id,
                                                                slide.id
                                                            );
                                                        }}
                                                    >
                                                        {roleDisplay?.coursePage
                                                            ?.viewContentNumbering !== false && (
                                                                <span className="w-7 shrink-0 text-center font-mono text-xs text-gray-400">
                                                                    S{sIdx + 1}
                                                                </span>
                                                            )}
                                                        {getIcon(
                                                            (slide as any).html_video_slide
                                                                ? 'HTML_VIDEO'
                                                                : slide.source_type,
                                                            slide.document_slide?.type,
                                                            '3',
                                                            slide
                                                        )}
                                                        <span
                                                            className="truncate"
                                                            title={slide.title}
                                                        >
                                                            {slide.title || `Slide ${sIdx + 1}`}
                                                        </span>
                                                    </div>
                                                )
                                            ),
                                        ])
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        ),
        [TabType.STUDENT]: (
            <div className="rounded-md bg-white p-6 py-2 text-sm text-gray-600 shadow-sm">
                {currentSession && (
                    <Students
                        packageSessionId={batchPackageSessionId ?? ''}
                        currentSession={currentSession}
                    />
                )}
            </div>
        ),
        [TabType.TEACHERS]: (
            <div className="p-6 py-2">
                <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
                    <div className="flex-1">
                        <h2 className="text-base font-semibold text-gray-800">
                            Manage {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}
                        </h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            View and manage{' '}
                            {getTerminology(
                                RoleTerms.Teacher,
                                SystemTerms.Teacher
                            ).toLocaleLowerCase()}
                            s assigned to this batch.
                        </p>
                    </div>
                    <AddTeachers packageSessionId={batchPackageSessionId ?? ''} />
                </div>
                <TeachersList packageSessionId={batchPackageSessionId ?? ''} />
            </div>
        ),
        [TabType.ASSESSMENT]: (
            <div className="rounded-md bg-white p-6 py-2 text-sm text-gray-600 shadow-sm">
                <Assessments packageSessionId={batchPackageSessionId ?? ''} />
            </div>
        ),
        [TabType.CONTENT_STRUCTURE]: (
            <div className="p-6 py-2">
                <div className="mb-4">
                    <h3 className="mb-2 text-lg font-semibold text-gray-800">Content Structure</h3>
                    <p className="text-sm text-gray-600">
                        Navigate through your course content using folders
                    </p>

                    {/* Breadcrumb Navigation */}
                    {navigationBreadcrumb.length > 0 && (
                        <div className="mt-3 flex items-center space-x-2 text-sm">
                            <button
                                onClick={() => navigateToLevel(-1)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                Course
                            </button>
                            {navigationBreadcrumb.map((crumb, index) => (
                                <div key={crumb.id} className="flex items-center space-x-2">
                                    <span className="text-gray-400">/</span>
                                    <button
                                        onClick={() => navigateToLevel(index)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        {crumb.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Folder Grid View */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2">
                    {/* Show Subjects (Course Structure 5 or when at subjects level) */}
                    {courseStructure === 5 && currentNavigationLevel === 'subjects' && (
                        <Sortable
                            value={subjects}
                            strategy={rectSortingStrategy}
                            onValueChange={handleSubjectReorder}
                        >
                            {subjects.map((subject, idx) => (
                                <SortableItem
                                    key={subject.id}
                                    value={subject.id}
                                    className="group relative"
                                >
                                    <div
                                        onClick={() =>
                                            handleSubjectClick(subject.id, subject.subject_name)
                                        }
                                        className="cursor-pointer rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                    >
                                        {/* Folder Icon/Image */}
                                        <ThumbnailImage
                                            thumbnailId={subject.thumbnail_id}
                                            fallbackIcon={
                                                <Folder
                                                    size={96}
                                                    weight="duotone"
                                                    className="text-blue-600"
                                                />
                                            }
                                            fallbackColor="bg-gradient-to-br from-blue-50 to-blue-100"
                                        />

                                        {/* Folder Title */}
                                        <h4
                                            className="mb-1 truncate text-sm font-medium text-gray-800"
                                            title={subject.subject_name}
                                        >
                                            {convertCapitalToTitleCase(subject.subject_name)}
                                        </h4>

                                        {/* Subject Number */}
                                        {roleDisplay?.coursePage?.viewContentNumbering !==
                                            false && (
                                                <p className="text-xs text-gray-500">
                                                    Subject {idx + 1}
                                                </p>
                                            )}

                                        {/* Edit and Delete Buttons */}
                                        {canEditStructure && (
                                            <div className="absolute right-2 top-2 flex gap-1">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="rounded-full p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100">
                                                            <DotsThree size={16} weight="bold" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openEditDialog('subject', subject);
                                                            }}
                                                        >
                                                            <PencilSimple
                                                                size={14}
                                                                className="mr-2 text-blue-600"
                                                            />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDeleteConfirmation('subject', {
                                                                    id: subject.id,
                                                                    name: subject.subject_name,
                                                                });
                                                            }}
                                                            className="text-red-600"
                                                        >
                                                            <Trash size={14} className="mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                    </div>
                                </SortableItem>
                            ))}
                        </Sortable>
                    )}

                    {/* Show Modules for Course Structure 5 when at modules level */}
                    {courseStructure === 5 &&
                        currentNavigationLevel === 'modules' &&
                        selectedSubjectId && (
                            <Sortable
                                value={(subjectModulesMap[selectedSubjectId] ?? []).map((m) => ({
                                    ...m,
                                    id: m.module.id,
                                }))}
                                strategy={rectSortingStrategy}
                                onValueChange={(reordered) =>
                                    handleModuleReorder(
                                        selectedSubjectId,
                                        reordered as unknown as ModuleWithChapters[]
                                    )
                                }
                            >
                                {(subjectModulesMap[selectedSubjectId] ?? []).map(
                                    (mod: ModuleWithChapters, modIdx: number) => (
                                        <SortableItem
                                            key={mod.module.id}
                                            value={mod.module.id}
                                            asChild
                                            className="group relative"
                                        >
                                            <div
                                                onClick={() =>
                                                    handleModuleClick(
                                                        mod.module.id,
                                                        mod.module.module_name
                                                    )
                                                }
                                                className="rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                            >
                                                {/* Folder Icon/Image */}
                                                <ThumbnailImage
                                                    thumbnailId={mod.module.thumbnail_id}
                                                    fallbackIcon={
                                                        <FileText
                                                            size={96}
                                                            weight="duotone"
                                                            className="text-green-600"
                                                        />
                                                    }
                                                    fallbackColor="bg-gradient-to-br from-green-50 to-green-100"
                                                />

                                                {/* Folder Title */}
                                                <h4
                                                    className="mb-1 truncate text-sm font-medium text-gray-800"
                                                    title={mod.module.module_name}
                                                >
                                                    {convertCapitalToTitleCase(
                                                        mod.module.module_name
                                                    )}
                                                </h4>

                                                {/* Module Number */}
                                                {roleDisplay?.coursePage?.viewContentNumbering !==
                                                    false && (
                                                        <p className="text-xs text-gray-500">
                                                            Module {modIdx + 1}
                                                        </p>
                                                    )}

                                                {/* Edit and Delete Buttons */}
                                                {canEditStructure && (
                                                    <div className="absolute right-2 top-2 flex gap-1">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="rounded-full p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100">
                                                                    <DotsThree
                                                                        size={16}
                                                                        weight="bold"
                                                                    />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditDialog('module', {
                                                                            ...mod.module,
                                                                            subjectId:
                                                                                selectedSubjectId,
                                                                        });
                                                                    }}
                                                                >
                                                                    <PencilSimple
                                                                        size={14}
                                                                        className="mr-2 text-blue-600"
                                                                    />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDeleteConfirmation(
                                                                            'module',
                                                                            {
                                                                                id: mod.module.id,
                                                                                name: mod.module
                                                                                    .module_name,
                                                                                subjectId:
                                                                                    selectedSubjectId,
                                                                            }
                                                                        );
                                                                    }}
                                                                    className="text-red-600"
                                                                >
                                                                    <Trash
                                                                        size={14}
                                                                        className="mr-2"
                                                                    />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                )}
                                            </div>
                                        </SortableItem>
                                    )
                                )}
                            </Sortable>
                        )}

                    {/* Show Modules for Course Structure 4 */}
                    {courseStructure === 4 &&
                        currentNavigationLevel === 'subjects' &&
                        subjects[0] && (
                            <Sortable
                                value={(subjectModulesMap[subjects[0].id] ?? []).map((m) => ({
                                    ...m,
                                    id: m.module.id,
                                }))}
                                strategy={rectSortingStrategy}
                                onValueChange={(reordered) =>
                                    handleModuleReorder(
                                        subjects[0]?.id || '',
                                        reordered as unknown as ModuleWithChapters[]
                                    )
                                }
                            >
                                {(subjectModulesMap[subjects[0].id] ?? []).map(
                                    (mod: ModuleWithChapters, modIdx: number) => (
                                        <SortableItem
                                            key={mod.module.id}
                                            value={mod.module.id}
                                            asChild
                                            className="group relative"
                                        >
                                            <div
                                                onClick={() => {
                                                    // For courseStructure 4, navigate to show chapters
                                                    setSelectedModuleId(mod.module.id);
                                                    setCurrentNavigationLevel('chapters');
                                                    setNavigationBreadcrumb([
                                                        {
                                                            level: 'Module',
                                                            name: mod.module.module_name,
                                                            id: mod.module.id,
                                                        },
                                                    ]);
                                                }}
                                                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                            >
                                                {/* Folder Icon/Image */}
                                                <ThumbnailImage
                                                    thumbnailId={mod.module.thumbnail_id}
                                                    fallbackIcon={
                                                        <FileText
                                                            size={96}
                                                            weight="duotone"
                                                            className="text-green-600"
                                                        />
                                                    }
                                                    fallbackColor="bg-gradient-to-br from-green-50 to-green-100"
                                                />

                                                {/* Folder Title */}
                                                <h4
                                                    className="mb-1 truncate text-sm font-medium text-gray-800"
                                                    title={mod.module.module_name}
                                                >
                                                    {convertCapitalToTitleCase(
                                                        mod.module.module_name
                                                    )}
                                                </h4>

                                                {/* Module Number */}
                                                {roleDisplay?.coursePage?.viewContentNumbering !==
                                                    false && (
                                                        <p className="text-xs text-gray-500">
                                                            Module {modIdx + 1}
                                                        </p>
                                                    )}

                                                {/* Edit and Delete Buttons */}
                                                {canEditStructure && (
                                                    <div className="absolute right-2 top-2 flex gap-1">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="rounded-full p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100">
                                                                    <DotsThree
                                                                        size={16}
                                                                        weight="bold"
                                                                    />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditDialog('module', {
                                                                            ...mod.module,
                                                                            subjectId:
                                                                                subjects[0]?.id,
                                                                        });
                                                                    }}
                                                                >
                                                                    <PencilSimple
                                                                        size={14}
                                                                        className="mr-2 text-blue-600"
                                                                    />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDeleteConfirmation(
                                                                            'module',
                                                                            {
                                                                                id: mod.module.id,
                                                                                name: mod.module
                                                                                    .module_name,
                                                                                subjectId:
                                                                                    subjects[0]?.id,
                                                                            }
                                                                        );
                                                                    }}
                                                                    className="text-red-600"
                                                                >
                                                                    <Trash
                                                                        size={14}
                                                                        className="mr-2"
                                                                    />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                )}
                                            </div>
                                        </SortableItem>
                                    )
                                )}
                            </Sortable>
                        )}

                    {/* Show Chapters for Course Structure 5 when at chapters level */}
                    {courseStructure === 5 &&
                        currentNavigationLevel === 'chapters' &&
                        selectedSubjectId &&
                        selectedModuleId && (
                            <Sortable
                                value={(
                                    subjectModulesMap[selectedSubjectId]?.find(
                                        (mod) => mod.module.id === selectedModuleId
                                    )?.chapters ?? []
                                ).map((c) => ({ ...c, id: c.chapter.id }))}
                                strategy={rectSortingStrategy}
                                onValueChange={(reordered) =>
                                    handleChapterReorder(
                                        selectedModuleId,
                                        reordered as unknown as ChapterWithSlidesStore[]
                                    )
                                }
                            >
                                {(
                                    subjectModulesMap[selectedSubjectId]?.find(
                                        (mod) => mod.module.id === selectedModuleId
                                    )?.chapters ?? []
                                ).map((ch: ChapterMetadata, chIdx: number) => (
                                    <SortableItem
                                        key={ch.chapter.id}
                                        value={ch.chapter.id}
                                        asChild
                                        className="group relative"
                                    >
                                        <div
                                            onClick={() => {
                                                if (readOnly) return;
                                                // Navigate to chapter slides
                                                handleChapterNavigation(
                                                    selectedSubjectId,
                                                    selectedModuleId,
                                                    ch.chapter.id
                                                );
                                            }}
                                            className="rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                        >
                                            {/* Folder Icon/Image */}
                                            <ThumbnailImage
                                                thumbnailId={ch.chapter.file_id}
                                                fallbackIcon={
                                                    <PresentationChart
                                                        size={96}
                                                        weight="duotone"
                                                        className="text-purple-600"
                                                    />
                                                }
                                                fallbackColor="bg-gradient-to-br from-purple-50 to-purple-100"
                                            />

                                            {/* Folder Title */}
                                            <h4
                                                className="mb-1 truncate text-sm font-medium text-gray-800"
                                                title={ch.chapter.chapter_name}
                                            >
                                                {convertCapitalToTitleCase(ch.chapter.chapter_name)}
                                            </h4>

                                            {/* Chapter Number */}
                                            {roleDisplay?.coursePage?.viewContentNumbering !==
                                                false && (
                                                    <p className="text-xs text-gray-500">
                                                        Chapter {chIdx + 1}
                                                    </p>
                                                )}

                                            {/* Edit and Delete Buttons */}
                                            {canEditStructure && (
                                                <div className="absolute right-2 top-2 flex gap-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="rounded-full p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100">
                                                                <DotsThree
                                                                    size={16}
                                                                    weight="bold"
                                                                />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditDialog('chapter', {
                                                                        ...ch.chapter,
                                                                        subjectId:
                                                                            selectedSubjectId,
                                                                        moduleId: selectedModuleId,
                                                                    });
                                                                }}
                                                            >
                                                                <PencilSimple
                                                                    size={14}
                                                                    className="mr-2 text-blue-600"
                                                                />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            {dripConditionsEnabled && (
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenChapterDripDialog(
                                                                            ch.chapter.id,
                                                                            ch.chapter.chapter_name
                                                                        );
                                                                    }}
                                                                >
                                                                    <Info
                                                                        size={14}
                                                                        className="mr-2 text-purple-600"
                                                                    />
                                                                    Drip Condition
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openDeleteConfirmation(
                                                                        'chapter',
                                                                        {
                                                                            id: ch.chapter.id,
                                                                            name: ch.chapter
                                                                                .chapter_name,
                                                                            subjectId:
                                                                                selectedSubjectId,
                                                                            moduleId:
                                                                                selectedModuleId,
                                                                        }
                                                                    );
                                                                }}
                                                                className="text-red-600"
                                                            >
                                                                <Trash size={14} className="mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )}
                                        </div>
                                    </SortableItem>
                                ))}
                            </Sortable>
                        )}

                    {/* Show Chapters for Course Structure 4 when at chapters level */}
                    {courseStructure === 4 &&
                        currentNavigationLevel === 'chapters' &&
                        selectedModuleId &&
                        subjects[0] && (
                            <Sortable
                                value={(
                                    subjectModulesMap[subjects[0].id]?.find(
                                        (mod) => mod.module.id === selectedModuleId
                                    )?.chapters ?? []
                                ).map((c) => ({ ...c, id: c.chapter.id }))}
                                strategy={rectSortingStrategy}
                                onValueChange={(reordered) =>
                                    handleChapterReorder(
                                        selectedModuleId,
                                        reordered as unknown as ChapterWithSlidesStore[]
                                    )
                                }
                            >
                                {(
                                    subjectModulesMap[subjects[0].id]?.find(
                                        (mod) => mod.module.id === selectedModuleId
                                    )?.chapters ?? []
                                ).map((ch: ChapterMetadata, chIdx: number) => (
                                    <SortableItem
                                        key={ch.chapter.id}
                                        value={ch.chapter.id}
                                        asChild
                                        className="group relative"
                                    >
                                        <div
                                            onClick={() => {
                                                if (readOnly) return;
                                                // Navigate to chapter slides
                                                handleChapterNavigation(
                                                    subjects[0]?.id || '',
                                                    selectedModuleId,
                                                    ch.chapter.id
                                                );
                                            }}
                                            className="rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                        >
                                            {/* Folder Icon/Image */}
                                            <ThumbnailImage
                                                thumbnailId={ch.chapter.file_id}
                                                fallbackIcon={
                                                    <PresentationChart
                                                        size={96}
                                                        weight="duotone"
                                                        className="text-purple-600"
                                                    />
                                                }
                                                fallbackColor="bg-gradient-to-br from-purple-50 to-purple-100"
                                            />

                                            {/* Folder Title */}
                                            <h4
                                                className="mb-1 truncate text-sm font-medium text-gray-800"
                                                title={ch.chapter.chapter_name}
                                            >
                                                {convertCapitalToTitleCase(ch.chapter.chapter_name)}
                                            </h4>

                                            {/* Chapter Number */}
                                            {roleDisplay?.coursePage?.viewContentNumbering !==
                                                false && (
                                                    <p className="text-xs text-gray-500">
                                                        Chapter {chIdx + 1}
                                                    </p>
                                                )}

                                            {/* Edit and Delete Buttons */}
                                            {canEditStructure && (
                                                <div className="absolute right-2 top-2 flex gap-1">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="rounded-full p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100">
                                                                <DotsThree
                                                                    size={16}
                                                                    weight="bold"
                                                                />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditDialog('chapter', {
                                                                        ...ch.chapter,
                                                                        subjectId:
                                                                            subjects[0]?.id || '',
                                                                        moduleId: selectedModuleId,
                                                                    });
                                                                }}
                                                            >
                                                                <PencilSimple
                                                                    size={14}
                                                                    className="mr-2 text-blue-600"
                                                                />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            {dripConditionsEnabled && (
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenChapterDripDialog(
                                                                            ch.chapter.id,
                                                                            ch.chapter.chapter_name
                                                                        );
                                                                    }}
                                                                >
                                                                    <Info
                                                                        size={14}
                                                                        className="mr-2 text-purple-600"
                                                                    />
                                                                    Drip Condition
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openDeleteConfirmation(
                                                                        'chapter',
                                                                        {
                                                                            id: ch.chapter.id,
                                                                            name: ch.chapter
                                                                                .chapter_name,
                                                                            subjectId:
                                                                                subjects[0]?.id ||
                                                                                '',
                                                                            moduleId:
                                                                                selectedModuleId,
                                                                        }
                                                                    );
                                                                }}
                                                                className="text-red-600"
                                                            >
                                                                <Trash size={14} className="mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )}
                                        </div>
                                    </SortableItem>
                                ))}
                            </Sortable>
                        )}

                    {/* Show Chapters for Course Structure 3 */}
                    {courseStructure === 3 &&
                        currentNavigationLevel === 'subjects' &&
                        subjects[0] && (
                            <Sortable
                                value={(subjectModulesMap[subjects[0].id]?.[0]?.chapters ?? []).map(
                                    (c) => ({ ...c, id: c.chapter.id })
                                )}
                                strategy={rectSortingStrategy}
                                onValueChange={(reordered) =>
                                    handleChapterReorder(
                                        subjectModulesMap[subjects[0]?.id || '']?.[0]?.module.id ||
                                        '',
                                        reordered as unknown as ChapterWithSlidesStore[]
                                    )
                                }
                            >
                                {(subjectModulesMap[subjects[0].id]?.[0]?.chapters ?? []).map(
                                    (ch: ChapterMetadata, chIdx: number) => (
                                        <SortableItem
                                            key={ch.chapter.id}
                                            value={ch.chapter.id}
                                            asChild
                                            className="group relative"
                                        >
                                            <div
                                                onClick={() => {
                                                    if (readOnly) return;
                                                    // Navigate to chapter slides
                                                    handleChapterNavigation(
                                                        subjects[0]?.id || '',
                                                        subjects[0]
                                                            ? subjectModulesMap[subjects[0].id]?.[0]
                                                                ?.module.id || ''
                                                            : '',
                                                        ch.chapter.id
                                                    );
                                                }}
                                                className="rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                            >
                                                {/* Folder Icon/Image */}
                                                <ThumbnailImage
                                                    thumbnailId={ch.chapter.file_id}
                                                    fallbackIcon={
                                                        <PresentationChart
                                                            size={96}
                                                            weight="duotone"
                                                            className="text-purple-600"
                                                        />
                                                    }
                                                    fallbackColor="bg-gradient-to-br from-purple-50 to-purple-100"
                                                />

                                                {/* Folder Title */}
                                                <h4
                                                    className="mb-1 truncate text-sm font-medium text-gray-800"
                                                    title={ch.chapter.chapter_name}
                                                >
                                                    {convertCapitalToTitleCase(
                                                        ch.chapter.chapter_name
                                                    )}
                                                </h4>

                                                {/* Chapter Number */}
                                                {roleDisplay?.coursePage?.viewContentNumbering !==
                                                    false && (
                                                        <p className="text-xs text-gray-500">
                                                            Chapter {chIdx + 1}
                                                        </p>
                                                    )}

                                                {/* Edit and Delete Buttons */}
                                                {canEditStructure && (
                                                    <div className="absolute right-2 top-2 flex gap-1">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="rounded-full p-1 opacity-0 transition-opacity hover:bg-gray-100 group-hover:opacity-100">
                                                                    <DotsThree
                                                                        size={16}
                                                                        weight="bold"
                                                                    />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openEditDialog('chapter', {
                                                                            ...ch.chapter,
                                                                            subjectId:
                                                                                subjects[0]?.id ||
                                                                                '',
                                                                            moduleId: subjects[0]
                                                                                ? subjectModulesMap[
                                                                                    subjects[0].id
                                                                                ]?.[0]?.module.id
                                                                                : undefined,
                                                                        });
                                                                    }}
                                                                >
                                                                    <PencilSimple
                                                                        size={14}
                                                                        className="mr-2 text-blue-600"
                                                                    />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                {dripConditionsEnabled && (
                                                                    <DropdownMenuItem
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenChapterDripDialog(
                                                                                ch.chapter.id,
                                                                                ch.chapter
                                                                                    .chapter_name
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Info
                                                                            size={14}
                                                                            className="mr-2 text-purple-600"
                                                                        />
                                                                        Drip Condition
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openDeleteConfirmation(
                                                                            'chapter',
                                                                            {
                                                                                id: ch.chapter.id,
                                                                                name: ch.chapter
                                                                                    .chapter_name,
                                                                                subjectId:
                                                                                    subjects[0]
                                                                                        ?.id || '',
                                                                                moduleId:
                                                                                    subjects[0]
                                                                                        ? subjectModulesMap[
                                                                                            subjects[0]
                                                                                                .id
                                                                                        ]?.[0]
                                                                                            ?.module
                                                                                            .id
                                                                                        : undefined,
                                                                            }
                                                                        );
                                                                    }}
                                                                    className="text-red-600"
                                                                >
                                                                    <Trash
                                                                        size={14}
                                                                        className="mr-2"
                                                                    />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                )}
                                            </div>
                                        </SortableItem>
                                    )
                                )}
                            </Sortable>
                        )}

                    {/* Show Slides for Course Structure 2 */}
                    {courseStructure === 2 &&
                        currentNavigationLevel === 'subjects' &&
                        directSlides.map((slide: Slide, sIdx: number) => (
                            <div key={slide.id} className="group relative">
                                <div
                                    onClick={() => {
                                        handleDirectSlideNavigation(slide.id);
                                    }}
                                    className="cursor-pointer rounded-lg border border-gray-200 bg-white p-2 transition-shadow duration-200 hover:shadow-md"
                                >
                                    {/* Slide Icon */}
                                    <div className="mb-3 flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                                        {getIcon(
                                            (slide as any).html_video_slide
                                                ? 'HTML_VIDEO'
                                                : slide.source_type,
                                            slide.document_slide?.type,
                                            '8',
                                            slide
                                        )}
                                    </div>

                                    {/* Slide Title */}
                                    <h4
                                        className="mb-1 truncate text-sm font-medium text-gray-800"
                                        title={slide.title}
                                    >
                                        {slide.title || `Slide ${sIdx + 1}`}
                                    </h4>

                                    {/* Slide Number */}
                                    {roleDisplay?.coursePage?.viewContentNumbering !== false && (
                                        <p className="text-xs text-gray-500">Slide {sIdx + 1}</p>
                                    )}
                                </div>
                            </div>
                        ))}

                    {/* Add New Folder Buttons */}
                    {courseStructure === 5 && currentNavigationLevel === 'subjects' && (
                        <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors duration-200 hover:border-primary-400 hover:bg-primary-50">
                            <AddSubjectButton
                                isTextButton={false}
                                onAddSubject={handleAddSubject}
                            />
                        </div>
                    )}

                    {courseStructure === 5 &&
                        currentNavigationLevel === 'modules' &&
                        selectedSubjectId && (
                            <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors duration-200 hover:border-primary-400 hover:bg-primary-50">
                                <AddModulesButton
                                    isTextButton={false}
                                    subjectId={selectedSubjectId}
                                    onAddModuleBySubjectId={(subjectId, module) =>
                                        handleAddModule(subjectId, module)
                                    }
                                />
                            </div>
                        )}

                    {/* Add Module button for course structure 4 at root level */}
                    {courseStructure === 4 &&
                        currentNavigationLevel === 'subjects' &&
                        subjects[0] && (
                            <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors duration-200 hover:border-primary-400 hover:bg-primary-50">
                                <AddModulesButton
                                    isTextButton={false}
                                    subjectId={subjects[0].id}
                                    onAddModuleBySubjectId={(subjectId, module) =>
                                        handleAddModule(subjectId, module)
                                    }
                                />
                            </div>
                        )}

                    {/* Add Chapter buttons for various scenarios */}
                    {((courseStructure === 5 &&
                        currentNavigationLevel === 'chapters' &&
                        selectedSubjectId &&
                        selectedModuleId) ||
                        (courseStructure === 4 &&
                            currentNavigationLevel === 'chapters' &&
                            selectedModuleId &&
                            subjects[0]) ||
                        (courseStructure === 3 &&
                            currentNavigationLevel === 'subjects' &&
                            subjects[0])) && (
                        <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors duration-200 hover:border-primary-400 hover:bg-primary-50">
                            <AddChapterButton
                                moduleId={
                                    courseStructure === 5
                                        ? selectedModuleId
                                        : courseStructure === 4
                                          ? selectedModuleId
                                          : subjects[0]
                                            ? subjectModulesMap[subjects[0].id]?.[0]?.module.id ||
                                              ''
                                            : ''
                                }
                                sessionId={selectedSession}
                                levelId={selectedLevel}
                                subjectId={
                                    courseStructure === 5
                                        ? selectedSubjectId
                                        : subjects[0]?.id || ''
                                }
                                packageSessionId={batchPackageSessionId ?? ''}
                                isTextButton={false}
                            />
                        </div>
                    )}

                    {/* Add Slide button for Course Structure 2 */}
                    {courseStructure === 2 &&
                        currentNavigationLevel === 'subjects' &&
                        !readOnly && (
                            <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors duration-200 hover:border-primary-400 hover:bg-primary-50">
                                <div
                                    onClick={() => handleDirectSlideNavigation()}
                                    className="flex flex-col items-center gap-2 text-center"
                                >
                                    <Plus size={24} className="text-primary-500" />
                                    <span className="text-sm font-medium text-primary-700">
                                        Add{' '}
                                        {getTerminology(ContentTerms.Slides, SystemTerms.Slides)}
                                    </span>
                                </div>
                            </div>
                        )}
                </div>
            </div>
        ),
        [TabType.PLANNING]: (
            <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
                <Planning packageSessionId={batchPackageSessionId ?? ''} />
            </div>
        ),
        [TabType.ACTIVITY]: (
            <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
                <Activity packageSessionId={batchPackageSessionId ?? ''} />
            </div>
        ),
    };

    const isLoading =
        addSubjectMutation.isPending ||
        deleteSubjectMutation.isPending ||
        updateSubjectMutation.isPending ||
        updateSubjectOrderMutation.isPending ||
        updateModuleMutation.isPending ||
        updateChapterMutation.isPending;

    // Compute final visible/reordered tabs once for rendering below
    const finalTabs = (() => {
        let reorderedTabs = [...tabs];

        const details = roleDisplay?.courseDetails;
        if (details?.tabs && details.tabs.length > 0) {
            const vis = new Map(
                details.tabs.map((t) => [mapDisplayIdToUiValue(t.id as CourseDetailsTabId), t])
            );
            reorderedTabs = reorderedTabs
                .filter((tab) => vis.get(tab.value as CourseDetailsTabId)?.visible !== false)
                .sort((a, b) => {
                    const ao = vis.get(a.value as CourseDetailsTabId)?.order ?? 999;
                    const bo = vis.get(b.value as CourseDetailsTabId)?.order ?? 999;
                    return ao - bo;
                });
        } else {
            // Fallbacks based on course settings/defaults
            if (settingsLoading || settingsError) {
                const outlineTab = reorderedTabs.find((tab) => tab.value === 'OUTLINE');
                const otherTabs = reorderedTabs.filter((tab) => tab.value !== 'OUTLINE');
                if (outlineTab) {
                    reorderedTabs = [outlineTab, ...otherTabs];
                }
            } else {
                const defaultViewMode = courseSettings?.courseViewSettings?.defaultViewMode;
                if (defaultViewMode === 'structure') {
                    const structureTab = reorderedTabs.find(
                        (tab) => tab.value === 'CONTENT_STRUCTURE'
                    );
                    const otherTabs = reorderedTabs.filter(
                        (tab) => tab.value !== 'CONTENT_STRUCTURE'
                    );
                    if (structureTab) {
                        reorderedTabs = [structureTab, ...otherTabs];
                    }
                } else {
                    const outlineTab = reorderedTabs.find((tab) => tab.value === 'OUTLINE');
                    const otherTabs = reorderedTabs.filter((tab) => tab.value !== 'OUTLINE');
                    if (outlineTab) {
                        reorderedTabs = [outlineTab, ...otherTabs];
                    }
                }
            }
        }

        return reorderedTabs;
    })();

    return isLoading ? (
        <DashboardLoader />
    ) : (
        <div className="flex size-full flex-col gap-3 rounded-lg bg-white py-4 text-neutral-700">
            {/* Restriction Message */}
            {!canEditStructure && (
                <div className="mx-4 rounded-md border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-center gap-2">
                        <div className="font-medium text-orange-600">
                            Editing Restricted: This course is{' '}
                            {isPublishedCourse
                                ? 'published'
                                : isInReviewCourse
                                    ? 'under review'
                                    : 'restricted'}
                            .
                        </div>
                        <div className="text-sm text-orange-600">
                            {isPublishedCourse
                                ? 'Go to My Courses to create an editable copy.'
                                : isInReviewCourse
                                    ? "You cannot edit the content while it's under review."
                                    : 'You cannot edit this content.'}
                        </div>
                    </div>
                </div>
            )}

            <Tabs value={selectedTab} onValueChange={handleTabChange} className="w-full">
                {finalTabs.length > 1 && (
                    <div className="overflow-x-auto border-b border-gray-200">
                        <TabsList
                            className="h-auto min-w-max flex-nowrap bg-transparent p-0"
                            style={{ display: 'flex', justifyContent: 'left' }}
                        >
                            {finalTabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className={`relative flex rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium !shadow-none transition-colors duration-200 hover:bg-gray-100 data-[state=active]:border-primary-500 data-[state=active]:bg-primary-50 data-[state=active]:text-primary-600`}
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                )}
                <TabsContent
                    key={selectedTab}
                    value={selectedTab}
                    className="mt-4 overflow-hidden rounded-r-md"
                >
                    <div className="relative">
                        {/* Loading overlay */}
                        {isInitLoading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <DashboardLoader size={24} />
                                    <div className="text-sm font-medium text-gray-600">
                                        Updating course structure...
                                    </div>
                                </div>
                            </div>
                        )}
                        {tabContent[selectedTab as TabType]}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Dialogs */}
            {/* Subject Edit Dialog */}
            <MyDialog
                heading="Edit Subject"
                dialogWidth="w-[400px]"
                open={editDialog.isOpen && editDialog.type === 'subject'}
                onOpenChange={(open) => !open && closeEditDialog()}
            >
                {editDialog.item && editDialog.type === 'subject' && (
                    <AddSubjectForm
                        initialValues={editDialog.item as SubjectType}
                        onSubmitSuccess={handleEditSubject}
                    />
                )}
            </MyDialog>

            {/* Module Edit Dialog */}
            <MyDialog
                heading="Edit Module"
                dialogWidth="w-[400px]"
                open={editDialog.isOpen && editDialog.type === 'module'}
                onOpenChange={(open) => !open && closeEditDialog()}
            >
                {editDialog.item && editDialog.type === 'module' && (
                    <AddModulesForm
                        initialValues={editDialog.item as Module}
                        onSubmitSuccess={handleEditModule}
                    />
                )}
            </MyDialog>

            {/* Chapter Edit Dialog */}
            <MyDialog
                heading="Edit Chapter"
                dialogWidth="min-w-[800px]"
                open={editDialog.isOpen && editDialog.type === 'chapter'}
                onOpenChange={(open) => !open && closeEditDialog()}
                headerActions={
                    editDialog.isOpen && editDialog.type === 'chapter' ? (
                        <ChapterHeaderActions
                            submitFn={chapterFormState.submitFn}
                            isPending={chapterFormState.isPending}
                        />
                    ) : undefined
                }
            >
                {editDialog.item &&
                    editDialog.type === 'chapter' &&
                    (() => {
                        const chapterItem = editDialog.item as Chapter & {
                            subjectId?: string;
                            moduleId?: string;
                        };
                        // Convert Chapter to ChapterWithSlides format expected by AddChapterForm
                        const chapterWithSlides: ChapterWithSlidesStore = {
                            chapter: chapterItem,
                            slides_count: {
                                video_count: 0,
                                pdf_count: 0,
                                doc_count: 0,
                                unknown_count: 0,
                            },
                            chapter_in_package_sessions: [], // Will be populated by the form
                        };
                        return (
                            <AddChapterForm
                                mode="edit"
                                initialValues={chapterWithSlides}
                                onSubmitSuccess={async () => {
                                    // Close dialog and refresh data after successful edit
                                    closeEditDialog();
                                    // Refresh the local state data
                                    const updatedSubjects = getCourseSubjects(
                                        courseId,
                                        selectedSession || '',
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
                                }}
                                module_id={chapterItem.moduleId}
                                session_id={selectedSession}
                                level_id={selectedLevel}
                                subject_id={chapterItem.subjectId}
                                hideSubmitButton={true}
                                onFormReady={handleChapterFormReady}
                            />
                        );
                    })()}
            </MyDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={deleteConfirmation.isOpen}
                onOpenChange={() =>
                    setDeleteConfirmation({ isOpen: false, type: null, item: null })
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{deleteConfirmation.item?.name}
                            &quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Chapter Drip Condition Dialog */}
            <ChapterDripConditionDialog
                open={chapterDripDialog.open}
                onClose={handleCloseChapterDripDialog}
                chapterId={chapterDripDialog.chapterId}
                chapterName={chapterDripDialog.chapterName}
                packageId={chapterDripDialog.packageId}
                dripConditions={dripConditions}
                onSave={handleSaveChapterDripConditions}
                allChapters={Object.values(subjectModulesMap)
                    .flat()
                    .flatMap((modWithChapters) =>
                        modWithChapters.chapters.map((ch) => ({
                            id: ch.chapter.id,
                            name: ch.chapter.chapter_name,
                        }))
                    )}
            />
        </div>
    );
};
