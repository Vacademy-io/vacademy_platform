import { StepsIcon } from '@phosphor-icons/react';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    ChalkboardTeacher,
    Clock,
    Code,
    Copy,
    DotsThree,
    File,
    FileDoc,
    FilePdf,
    PlayCircle,
    Question,
    BookOpen,
    GameController,
    ClipboardText,
    PresentationChart,
    FileText,
    VideoCamera,
} from '@phosphor-icons/react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useState, useEffect, useMemo, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CourseDetailsFormValues, courseDetailsSchema } from './course-details-schema';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useGetPackageSessionId } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionId';
import { useGetPackageSessionIdFromCourseInit } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionIdFromCourseInit';
import {
    VideoSlide,
    DocumentSlide,
    QuestionSlide,
    AssignmentSlide,
} from '../../-services/getAllSlides';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { handleGetSlideCountDetails } from '../-services/get-slides-count';
import { fetchCourseStudyLibraryDetails } from '../../-services/getStudyLibraryDetails';

import { CourseDetailsRatingsComponent } from './course-details-ratings-page';
import {
    calculateTotalTimeForCourseDuration,
    getInstructorsBySessionAndLevel,
    transformApiDataToCourseData,
} from '../-utils/helper';
import { CourseStructureDetails } from './course-structure-details';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { AddCourseForm } from '@/components/common/study-library/add-course/add-course-form';
import { PackageDripConditionsCard } from './PackageDripConditionsCard';
import { DripCondition } from '@/types/course-settings';
import { getCourseSettings, saveCourseSettings } from '@/services/course-settings';
import { MyButton } from '@/components/design-system/button';
import { getPublicUrl } from '@/services/upload_file';
import InviteDetailsComponent from './invite-details-component';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey, Authority } from '@/constants/auth/tokens';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { type DisplaySettingsData } from '@/types/display-settings';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { extractTextFromHTML } from '@/constants/helper';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';
import { fetchCourseBatches } from '@/routes/admin-package-management/-services/package-service';
import { EnrollmentWorkflowStatus } from '@/components/shared/workflow/enrollment-workflow-status';

type SlideType = {
    id: string;
    name: string;
    type: string;
    description: string;
    status: string;
    order: number;
    videoSlide?: VideoSlide;
    documentSlide?: DocumentSlide;
    questionSlide?: QuestionSlide;
    assignmentSlide?: AssignmentSlide;
};

export type ChapterType = {
    id: string;
    name: string;
    status: string;
    file_id: string;
    description: string;
    chapter_order: number;
    slides: SlideType[];
    isOpen?: boolean;
};

export type ModuleType = {
    id: string;
    name: string;
    description: string;
    status: string;
    thumbnail_id: string;
    chapters: ChapterType[];
    isOpen?: boolean;
};

export type SubjectType = {
    id: string;
    subject_name: string;
    subject_code: string;
    credit: number;
    thumbnail_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    modules: ModuleType[];
};

type Course = {
    id: string;
    title: string;
    level: 1 | 2 | 3 | 4 | 5;
    structure: {
        courseName: string;
        items: SubjectType[] | ModuleType[] | ChapterType[] | SlideType[];
    };
};

type SlideCountType = {
    slide_count: number;
    source_type: string;
};

// Batches model used on Course Details page
export type CourseBatch = PackageSessionDTO & {
    /**
     * Optional human-friendly name for this specific package session
     * (e.g. "Morning Batch A"). When present, the UI will use it in
     * the Batch/Subgroup dropdown. This is typically backed by the
     * `name` column on the package_session table, or a dedicated
     * `package_session_name` field in the API response.
     */
    package_session_name?: string | null;
};

const mockCourses: Course[] = [
    {
        id: '1',
        title: `2-Level ${getTerminology(ContentTerms.Level, SystemTerms.Level)} Structure`,
        level: 2,
        structure: {
            courseName: 'Introduction to Web Development',
            items: [] as SlideType[],
        },
    },
    {
        id: '2',
        title: `3-Level ${getTerminology(ContentTerms.Level, SystemTerms.Level)} Structure`,
        level: 3,
        structure: {
            courseName: 'Frontend Fundamentals',
            items: [] as SlideType[],
        },
    },
    {
        id: '3',
        title: `4-Level ${getTerminology(ContentTerms.Level, SystemTerms.Level)} Structure`,
        level: 4,
        structure: {
            courseName: 'Full-Stack JavaScript Development Mastery',
            items: [] as ModuleType[],
        },
    },
    {
        id: '4',
        title: `5-Level ${getTerminology(ContentTerms.Level, SystemTerms.Level)} Structure`,
        level: 5,
        structure: {
            courseName: 'Advanced Software Engineering Principles',
            items: [] as SubjectType[],
        },
    },
];

interface InstructorWithPicUrl {
    id: string;
    name: string;
    email: string;
    profilePicId?: string;
    profilePicUrl: string;
}

// Utility to extract YouTube video ID
const extractYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1] && match[1].length === 11 ? match[1] : null;
};

type AdvancedIdItem = { label: string; value: string };

const AdvancedIdsMenu = ({ items }: { items: AdvancedIdItem[] }) => {
    const handleCopy = async (item: AdvancedIdItem) => {
        if (!item.value) {
            toast.error(`${item.label} is not available`);
            return;
        }
        try {
            await navigator.clipboard.writeText(item.value);
            toast.success(`${item.label} copied`);
        } catch {
            toast.error('Failed to copy');
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <MyButton
                    type="button"
                    buttonType="secondary"
                    layoutVariant="icon"
                    scale="small"
                    aria-label="More options"
                >
                    <DotsThree size={18} weight="bold" />
                </MyButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="text-xs font-semibold text-gray-700">
                    Advanced
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items.map((item) => (
                    <DropdownMenuItem
                        key={item.label}
                        onSelect={(e) => {
                            e.preventDefault();
                            handleCopy(item);
                        }}
                        className="flex cursor-pointer items-start gap-2"
                    >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                {item.label}
                            </span>
                            <span className="truncate font-mono text-xs text-gray-800">
                                {item.value || '—'}
                            </span>
                        </div>
                        <Copy size={14} className="mt-1 shrink-0 text-gray-400" />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export const CourseDetailsPage = () => {
    const router = useRouter();
    const searchParams = router.state.location.search;
    const queryClient = useQueryClient();
    const courseId = searchParams.courseId ?? '';

    const { studyLibraryData, isInitLoading, setStudyLibraryData } = useStudyLibraryStore();

    // Normalise study library data so it works whether the course-init API
    // returns a single course object or an array of courses.
    const normalizedStudyLibraryData = useMemo(() => {
        if (!studyLibraryData) return null;
        return Array.isArray(studyLibraryData) ? studyLibraryData : [studyLibraryData];
    }, [studyLibraryData]);

    // Safely resolve the current course from studyLibraryData.
    // Handles three cases:
    // 1) Direct match on course.id === searchParams.courseId (ideal)
    // 2) Single-course payload from course-init (fallback to the only item)
    // 3) URL contains a package_session.id (child batch) – match via package_sessions[].id
    const courseDetailsData = useMemo(() => {
        if (!normalizedStudyLibraryData) return null;

        // Prefer direct course.id match when possible
        const byCourseId = normalizedStudyLibraryData.find(
            (item) => item.course.id === searchParams.courseId
        );
        if (byCourseId) return byCourseId;

        // If course-init returned a single course, fall back to it
        if (normalizedStudyLibraryData.length === 1) {
            return normalizedStudyLibraryData[0];
        }

        // Lastly, support URLs that were built with a child package_session.id
        const byPackageSessionId = normalizedStudyLibraryData.find((item) =>
            Array.isArray(item.package_sessions)
                ? item.package_sessions.some((ps) => ps.id === searchParams.courseId)
                : false
        );

        return byPackageSessionId ?? null;
    }, [normalizedStudyLibraryData, searchParams.courseId]);

    // Safety net: if course-init data for this specific courseId was not yet
    // loaded into the studyLibraryStore (e.g. after navigating from a view
    // that only fetched the global INIT_STUDY_LIBRARY payload), explicitly
    // trigger the course-init API here so that sessions/levels/batches are
    // available for the selectors.
    useEffect(() => {
        if (!courseDetailsData && courseId) {
            fetchCourseStudyLibraryDetails(courseId)
                .then((data: unknown) => {
                    if (data) {
                        setStudyLibraryData(data as never);
                    }
                })
                .catch((error: unknown) => {
                    console.error('Failed to load course-init data for course details', error);
                });
        }
    }, [courseDetailsData, courseId, setStudyLibraryData]);

    const form = useForm<CourseDetailsFormValues>({
        resolver: zodResolver(courseDetailsSchema),
        defaultValues: {
            courseData: {
                id: '',
                title: '',
                description: '',
                tags: [],
                imageUrl: '',
                courseStructure: 1,
                whatYoullLearn: '',
                whyLearn: '',
                whoShouldLearn: '',
                aboutTheCourse: '',
                packageName: '',
                status: '',
                isCoursePublishedToCatalaouge: false,
                coursePreviewImageMediaId: '',
                courseBannerMediaId: '',
                courseMediaId: {
                    type: '',
                    id: '',
                },
                coursePreviewImageMediaPreview: '',
                courseBannerMediaPreview: '',
                courseMediaPreview: '',
                courseHtmlDescription: '',
                instructors: [],
                sessions: [],
            },
            mockCourses: [],
        },
        mode: 'onChange',
    });

    const getInitials = (email: string) => {
        const name = email.split('@')[0];
        return name?.slice(0, 2).toUpperCase();
    };

    const [selectedSession, setSelectedSession] = useState<string>('');
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedBatchId, setSelectedBatchId] = useState<string>('');
    const [isRestoringSelections, setIsRestoringSelections] = useState<boolean>(false);
    const [dripConditionsEnabled, setDripConditionsEnabled] = useState<boolean>(false);
    const [dripConditions, setDripConditions] = useState<DripCondition[]>([]);
    const [courseFilterType, setCourseFilterType] = useState<
        'PARENTS_ONLY' | 'CHILDREN_ONLY' | null | undefined
    >(null);

    // Use refs to preserve selections across re-renders and data fetches
    const preservedSessionRef = useRef<string>('');
    const preservedLevelRef = useRef<string>('');
    const isInitialLoadRef = useRef<boolean>(true);
    const hasRestoredOnceRef = useRef<boolean>(false);
    const skipAutoSelectionRef = useRef<boolean>(false);

    // Backup mechanism using localStorage
    const STORAGE_KEY_SESSION = `preserved_session_${searchParams.courseId}`;
    const STORAGE_KEY_LEVEL = `preserved_level_${searchParams.courseId}`;

    // Initialize refs from URL params first, then localStorage on component mount
    useEffect(() => {
        // URL params take priority over localStorage
        const urlSessionId = searchParams.sessionId as string | undefined;
        const urlLevelId = searchParams.levelId as string | undefined;

        if (urlSessionId) {
            preservedSessionRef.current = urlSessionId;
            localStorage.setItem(STORAGE_KEY_SESSION, urlSessionId);
        } else {
            const storedSession = localStorage.getItem(STORAGE_KEY_SESSION);
            if (storedSession) {
                preservedSessionRef.current = storedSession;
            }
        }

        if (urlLevelId) {
            preservedLevelRef.current = urlLevelId;
            localStorage.setItem(STORAGE_KEY_LEVEL, urlLevelId);
        } else {
            const storedLevel = localStorage.getItem(STORAGE_KEY_LEVEL);
            if (storedLevel) {
                preservedLevelRef.current = storedLevel;
            }
        }
    }, []);

    // Store to localStorage whenever refs are updated
    const updatePreservedSession = (sessionId: string) => {
        preservedSessionRef.current = sessionId;
        localStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    };

    const updatePreservedLevel = (levelId: string) => {
        preservedLevelRef.current = levelId;
        localStorage.setItem(STORAGE_KEY_LEVEL, levelId);
    };

    // Update refs when session/level changes and handle emergency restoration
    useEffect(() => {
        if (selectedSession) {
            updatePreservedSession(selectedSession);
            isInitialLoadRef.current = false;
        } else {
            // Emergency backup restoration if ref is somehow empty
            if (!preservedSessionRef.current) {
                const storedSession = localStorage.getItem(STORAGE_KEY_SESSION);
                if (storedSession) {
                    preservedSessionRef.current = storedSession;
                }
            }
        }
    }, [selectedSession]);

    useEffect(() => {
        if (selectedLevel) {
            updatePreservedLevel(selectedLevel);
        } else {
            // Emergency backup restoration if ref is somehow empty
            if (!preservedLevelRef.current) {
                const storedLevel = localStorage.getItem(STORAGE_KEY_LEVEL);
                if (storedLevel) {
                    preservedLevelRef.current = storedLevel;
                }
            }
        }
    }, [selectedLevel]);
    const [levelOptions, setLevelOptions] = useState<
        { _id: string; value: string; label: string }[]
    >([]);

    // Get current session and level IDs
    const currentSession = form
        .getValues('courseData')
        .sessions.find((session) => session.sessionDetails.id === selectedSession);
    const currentLevel = currentSession?.levelDetails.find((level) => level.id === selectedLevel);

    // Resolve the effective courseId to use for mapping calls. This prefers the
    // id coming back from course-init (courseDetailsData.course.id), but falls
    // back to the raw search param when necessary.
    const effectiveCourseId = courseDetailsData?.course.id ?? searchParams.courseId ?? '';

    // Try to get packageSessionId from course-init API first (new approach)
    const packageSessionIdFromCourseInit = useGetPackageSessionIdFromCourseInit(
        effectiveCourseId,
        currentSession?.sessionDetails.id ?? '',
        currentLevel?.id ?? ''
    );
    // Fallback to institute details if course-init doesn't have it
    const packageSessionIdFromInstitute =
        useGetPackageSessionId(
            effectiveCourseId,
            currentSession?.sessionDetails.id ?? '',
            currentLevel?.id ?? ''
        ) || '';

    // ── Course batches (parent + child package sessions) ────────────────────────
    const { data: rawBatches = [] } = useQuery({
        queryKey: ['COURSE_BATCHES', courseId],
        queryFn: () => (courseId ? fetchCourseBatches(courseId) : Promise.resolve([])),
        enabled: !!courseId,
        staleTime: 5 * 60 * 1000,
    });

    const batches: CourseBatch[] = useMemo(
        () =>
            (rawBatches as PackageSessionDTO[]).map((b) => ({
                ...b,
                // Keep backend-provided `package_session_name` (if present) separate from
                // `name` (package_session table). The UI may concatenate both for display.
                package_session_name:
                    (b as unknown as { package_session_name?: string | null })
                        .package_session_name ?? null,
            })),
        [rawBatches]
    );

    // Convert sessions to select options format
    const sessionOptions = useMemo(() => {
        const sessions = form.getValues('courseData')?.sessions || [];
        const options = sessions.map((session) => ({
            _id: session.sessionDetails.id,
            value: session.sessionDetails.id,
            label: session.sessionDetails.session_name,
        }));

        return options;
    }, [form.watch('courseData.sessions')]);

    // Determine if the currently selected (session, level) actually has any
    // child package sessions (subgroups). When there are no children for this
    // combination, showing a Batch/Subgroup dropdown would be confusing, so we
    // hide it and fall back to the legacy session+level mapping.
    //
    // Important: backend may return non-parent rows even when the user did NOT
    // configure subgroups (e.g. “invite/default” rows). We only treat a child
    // as a real subgroup when it has a meaningful name.
    const isNamedChildSubgroup = (b: CourseBatch) => {
        if (b.is_parent !== false) return false;
        const name = (b.name ?? '').trim();
        const psn = (b.package_session_name ?? '').trim();
        return Boolean(name || psn);
    };

    const hasChildSubgroupsForSelection = useMemo(() => {
        if (!selectedSession || !selectedLevel) return false;
        return batches.some(
            (b) =>
                b.session.id === selectedSession &&
                b.level.id === selectedLevel &&
                isNamedChildSubgroup(b)
        );
    }, [batches, selectedSession, selectedLevel]);

    // Batch/Subgroup dropdown should only be visible when:
    // 1) Global course settings default filter is constrained to parents/children, AND
    // 2) The current (session, level) has at least one child package session.
    const shouldShowBatchDropdown =
        (courseFilterType === 'PARENTS_ONLY' || courseFilterType === 'CHILDREN_ONLY') &&
        hasChildSubgroupsForSelection;

    // Only allow subgroup selection to influence content when the dropdown is visible.
    // Prevents stale/incorrect batch scoping when there are no real subgroups.
    const effectiveSelectedBatchId = shouldShowBatchDropdown ? selectedBatchId : '';

    // Prefer the Batch/Subgroup dropdown selection so we can segregate when there
    // are multiple package sessions (e.g. 1 parent + N children). Otherwise use
    // session+level mapping from course-init or institute.
    const packageSessionIds =
        effectiveSelectedBatchId || packageSessionIdFromCourseInit || packageSessionIdFromInstitute;

    // Additional guard specifically for edge cases where studyLibraryData exists
    // but the transformed form state ends up with no sessions (e.g. a package
    // that has multiple child package_sessions and only the global init payload
    // was used). In that case, re-fire the course-init API for this courseId
    // exactly once until sessions are populated. This keeps behaviour
    // backward-compatible for existing courses that already have sessions.
    useEffect(() => {
        if (!courseId) return;

        const sessions = form.getValues('courseData')?.sessions || [];
        if (sessions.length > 0) {
            return;
        }

        fetchCourseStudyLibraryDetails(courseId)
            .then((data: unknown) => {
                if (data) {
                    setStudyLibraryData(data as never);
                }
            })
            .catch((error: unknown) => {
                console.error('Failed to reload course-init data for empty-session course', error);
            });
        // We intentionally only depend on courseId and the watched sessions
        // collection length to avoid repeated refetches once sessions exist.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, form.watch('courseData.sessions')]);

    // Update level options when session changes
    const handleSessionChange = (sessionId: string, preserveLevel = false) => {
        setSelectedSession(sessionId);
        const sessions = form.getValues('courseData')?.sessions || [];
        const selectedSessionData = sessions.find(
            (session) => session.sessionDetails.id === sessionId
        );

        if (selectedSessionData) {
            const newLevelOptions = selectedSessionData.levelDetails.map((level) => ({
                _id: level.id,
                value: level.id,
                label: level.name,
            }));
            setLevelOptions(newLevelOptions);

            // Only change level if preserveLevel is false, or if current level is not valid for new session
            if (!preserveLevel) {
                if (newLevelOptions.length > 0 && newLevelOptions[0]?.value) {
                    setSelectedLevel(newLevelOptions[0].value);
                } else {
                    setSelectedLevel('');
                }
            } else {
                // Check if current level is still valid for the new session
                const currentLevelExists = newLevelOptions.some(
                    (option) => option.value === selectedLevel
                );

                if (
                    !currentLevelExists &&
                    newLevelOptions.length > 0 &&
                    newLevelOptions[0]?.value
                ) {
                    setSelectedLevel(newLevelOptions[0].value);
                }
            }
        }
    };

    // Handle level change - clear expanded items and reset state
    const handleLevelChange = (levelId: string) => {
        setSelectedLevel(levelId);
    };

    // Build batch / subgroup dropdown options based on selected session + level.
    // Label uses backend-provided package_session_name when available
    // (e.g. "fs A", "fs B", "fs C") and falls back to package_name otherwise.
    const batchOptions = useMemo(() => {
        if (!selectedSession || !selectedLevel) return [];

        return batches
            .filter(
                (b) =>
                    b.session.id === selectedSession &&
                    b.level.id === selectedLevel &&
                    // Always keep parent rows. Only show child rows when they are real subgroups.
                    (b.is_parent !== false || isNamedChildSubgroup(b))
            )
            .map((b) => {
                // Prefer per-batch name from backend; fallback to package name.
                const primary = (b.package_session_name ?? '').trim();
                const fallback = (b.package_dto.package_name ?? '').trim();
                let label = primary || fallback;

                // As a last resort, use level name so the option is never empty.
                if (!label && b.level?.level_name) {
                    label = b.level.level_name.trim();
                }

                if (label && b.is_parent) {
                    label += ' (Parent batch)';
                }

                return {
                    id: b.id,
                    label,
                };
            });
    }, [batches, selectedSession, selectedLevel]);

    // If dropdown is hidden (no real subgroups), clear any previously selected batch
    // so session+level fallback mapping is used consistently.
    useEffect(() => {
        if (!shouldShowBatchDropdown && selectedBatchId) {
            setSelectedBatchId('');
        }
    }, [shouldShowBatchDropdown, selectedBatchId]);

    const handleBatchChange = (batchId: string) => {
        setSelectedBatchId(batchId);
    };

    // Initial/default batch selection and when session/level changes
    useEffect(() => {
        if (!batchOptions.length) {
            setSelectedBatchId('');
            return;
        }

        // If current selection is still valid, keep it
        const exists = batchOptions.some((opt) => opt.id === selectedBatchId);
        if (selectedBatchId && exists) {
            return;
        }

        // Prefer parent batch when available, otherwise first option
        const preferredParent = batchOptions.find((opt) => {
            const batch = batches.find((b) => b.id === opt.id);
            return batch?.is_parent;
        });

        setSelectedBatchId(preferredParent?.id ?? batchOptions[0]?.id ?? '');
    }, [batchOptions, batches, selectedBatchId]);

    // Load drip conditions and permissions from course settings
    useEffect(() => {
        const loadDripSettings = async () => {
            try {
                const settings = await getCourseSettings();
                setDripConditionsEnabled(settings.dripConditions.enabled);
                setDripConditions(settings.dripConditions.conditions);
                setCourseFilterType(settings.permissions.courseFilterType);
            } catch (error) {
                console.error('Error loading drip conditions:', error);
            }
        };
        loadDripSettings();
    }, []);

    // Drip conditions handlers
    const handleAddDripCondition = async (condition: DripCondition) => {
        try {
            const settings = await getCourseSettings();

            // Check if a condition with same level and level_id already exists
            const existingConditionIndex = settings.dripConditions.conditions.findIndex(
                (c) => c.level === condition.level && c.level_id === condition.level_id
            );

            let updatedConditions: DripCondition[];

            if (existingConditionIndex !== -1) {
                // Merge drip_condition arrays if condition exists
                const existingCondition =
                    settings.dripConditions.conditions[existingConditionIndex];
                const mergedCondition: DripCondition = {
                    id: existingCondition?.id ?? '',
                    level: existingCondition?.level ?? 'package',
                    level_id: existingCondition?.level_id ?? '',
                    enabled: existingCondition?.enabled ?? false,
                    created_at: existingCondition?.created_at,
                    drip_condition: condition.drip_condition,
                    updated_at: new Date().toISOString(),
                };

                updatedConditions = settings.dripConditions.conditions.map((c, idx) =>
                    idx === existingConditionIndex ? mergedCondition : c
                );
            } else {
                // Add new condition if doesn't exist
                updatedConditions = [...settings.dripConditions.conditions, condition];
            }

            await saveCourseSettings({
                ...settings,
                dripConditions: {
                    ...settings.dripConditions,
                    conditions: updatedConditions,
                },
            });
            setDripConditions(updatedConditions);
        } catch (error) {
            console.error('Error adding drip condition:', error);
            toast.error('Failed to save drip condition. Please try again.');
        }
    };

    const handleUpdateDripCondition = async (condition: DripCondition) => {
        try {
            const settings = await getCourseSettings();
            const updatedConditions = settings.dripConditions.conditions.map((c) =>
                c.id === condition.id ? condition : c
            );
            await saveCourseSettings({
                ...settings,
                dripConditions: {
                    ...settings.dripConditions,
                    conditions: updatedConditions,
                },
            });
            setDripConditions(updatedConditions);
        } catch (error) {
            console.error('Error updating drip condition:', error);
            toast.error('Failed to update drip condition. Please try again.');
        }
    };

    const handleDeleteDripCondition = async (id: string) => {
        try {
            const settings = await getCourseSettings();
            const updatedConditions = settings.dripConditions.conditions.filter((c) => c.id !== id);
            await saveCourseSettings({
                ...settings,
                dripConditions: {
                    ...settings.dripConditions,
                    conditions: updatedConditions,
                },
            });
            setDripConditions(updatedConditions);
        } catch (error) {
            console.error('Error deleting drip condition:', error);
            toast.error('Failed to delete drip condition. Please try again.');
        }
    };

    // Set initial session and its levels
    useEffect(() => {
        // Skip auto-selection logic if we're in the process of restoring preserved selections
        if (isRestoringSelections || skipAutoSelectionRef.current) {
            return;
        }

        if (sessionOptions.length > 0) {
            if (!selectedSession && sessionOptions[0]?.value) {
                // Check if we have preserved values before auto-selecting
                const hasPreservedSession =
                    preservedSessionRef.current || localStorage.getItem(STORAGE_KEY_SESSION);
                if (hasPreservedSession) {
                    return; // Skip auto-selection, let restoration handle it
                }

                // No session selected and no preserved values, select the first one
                const initialSessionId = sessionOptions[0].value;
                handleSessionChange(initialSessionId);
            } else if (selectedSession) {
                // Session already selected, check if it's still valid and preserve level
                const currentSessionExists = sessionOptions.some(
                    (option) => option.value === selectedSession
                );

                if (currentSessionExists) {
                    // Current session still exists, preserve it and the level
                    handleSessionChange(selectedSession, true);
                } else if (sessionOptions[0]?.value) {
                    // Current session no longer exists, select first available
                    handleSessionChange(sessionOptions[0].value);
                }
            }
        }
    }, [sessionOptions, isRestoringSelections]);

    // Add a ref to track if we've already loaded the course data for this course
    const loadedCourseIdRef = useRef<string>('');
    // Map key = `${sessionId}|${levelId}` -> parent package_session (batch) id for edit-course subgroup payload
    const parentBatchIdRef = useRef<Map<string, string>>(new Map());

    // Add effect to reset loaded course ID when studyLibraryData changes (after mutations)
    useEffect(() => {
        // Reset the loaded course ID to allow reload after mutations
        loadedCourseIdRef.current = '';
    }, [studyLibraryData]);

    useEffect(() => {
        const loadCourseData = async () => {
            if (courseDetailsData?.course) {
                // Only load if we haven't loaded this course yet
                const currentCourseId = courseDetailsData.course.id;
                if (loadedCourseIdRef.current === currentCourseId) {
                    return;
                }

                // Get preserved selections from refs (these persist across re-renders)
                const preservedSession = preservedSessionRef.current;
                const preservedLevel = preservedLevelRef.current;

                try {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    const transformedData = await transformApiDataToCourseData(courseDetailsData);
                    if (transformedData) {
                        // Mark this course as loaded BEFORE form reset to prevent race conditions
                        loadedCourseIdRef.current = currentCourseId;

                        // Load batches to build Session → Level → Subgroups for edit form
                        const parentMap = new Map<string, string>();
                        const subgroupsMap = new Map<string, { id: string; name: string }[]>();
                        try {
                            const batchesList = await fetchCourseBatches(currentCourseId);
                            const courseName = (courseDetailsData.course.package_name ?? '').trim();
                            // Backend may not always populate `is_parent`. Prefer it when present,
                            // but fall back to `parent_id === null` to identify parent rows.
                            const parents = batchesList.filter(
                                (b: { is_parent?: boolean; parent_id?: string | null }) =>
                                    b.is_parent === true ||
                                    (b.parent_id == null && b.is_parent !== false)
                            );
                            parents.forEach(
                                (p: {
                                    id: string;
                                    session: { id: string };
                                    level: { id: string };
                                }) => {
                                    const key = `${p.session.id}|${p.level.id}`;
                                    parentMap.set(key, p.id);
                                    if (!subgroupsMap.has(key)) subgroupsMap.set(key, []);
                                }
                            );

                            // Child rows: either explicitly marked, or anything with a parent_id.
                            const children = batchesList.filter(
                                (b: { is_parent?: boolean; parent_id?: string | null }) =>
                                    b.is_parent === false ||
                                    (b.parent_id != null && b.is_parent !== true)
                            );
                            children.forEach(
                                (child: {
                                    id: string;
                                    parent_id?: string | null;
                                    name?: string | null;
                                    session: { id: string };
                                    level: { id: string };
                                }) => {
                                    const key = `${child.session.id}|${child.level.id}`;

                                    // If we didn't find the parent row explicitly, still record the
                                    // parent batch id for update payload mapping.
                                    if (!parentMap.get(key) && child.parent_id) {
                                        parentMap.set(key, child.parent_id);
                                    }

                                    const pkgSessionName = (child as CourseBatch)
                                        .package_session_name;
                                    const subName =
                                        (child.name && child.name.trim()) ||
                                        (typeof pkgSessionName === 'string'
                                            ? pkgSessionName
                                                  .replace(
                                                      new RegExp(
                                                          `^${courseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`,
                                                          'i'
                                                      ),
                                                      ''
                                                  )
                                                  .trim() || pkgSessionName
                                            : '');
                                    if (subName) {
                                        const arr = subgroupsMap.get(key) ?? [];
                                        arr.push({ id: child.id, name: subName });
                                        subgroupsMap.set(key, arr);
                                    }
                                }
                            );
                            parentBatchIdRef.current = parentMap;
                        } catch (_) {
                            parentBatchIdRef.current = new Map();
                        }

                        // Merge subgroups (with batch id for existing) and parent id into each level for edit UI
                        const sessionsToMerge = transformedData.sessions ?? [];
                        sessionsToMerge.forEach(
                            (session: {
                                sessionDetails: { id: string };
                                levelDetails: Array<{
                                    id: string;
                                    subgroups?: { id?: string; name: string }[];
                                    parentPackageSessionId?: string;
                                }>;
                            }) => {
                                (session.levelDetails ?? []).forEach(
                                    (level: {
                                        id: string;
                                        subgroups?: { id?: string; name: string }[];
                                        parentPackageSessionId?: string;
                                    }) => {
                                        const key = `${session.sessionDetails.id}|${level.id}`;
                                        level.subgroups = subgroupsMap.get(key) ?? [];
                                        level.parentPackageSessionId = parentMap.get(key);
                                    }
                                );
                            }
                        );

                        form.reset({
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            courseData: transformedData,
                            mockCourses: mockCourses,
                        });

                        // Restore preserved selections - try multiple sources
                        let sessionToRestore = preservedSession;
                        let levelToRestore = preservedLevel;

                        // If refs are empty, try localStorage as backup
                        if (!sessionToRestore) {
                            sessionToRestore = localStorage.getItem(STORAGE_KEY_SESSION) || '';
                        }
                        if (!levelToRestore) {
                            levelToRestore = localStorage.getItem(STORAGE_KEY_LEVEL) || '';
                        }

                        if (sessionToRestore) {
                            // Check if preserved session still exists in the new data
                            const matchingSession = transformedData.sessions?.find(
                                (session: {
                                    sessionDetails: { id: string };
                                    levelDetails: { id: string }[];
                                }) => session.sessionDetails.id === sessionToRestore
                            );

                            if (matchingSession) {
                                // Set flags to prevent auto-selection interference
                                setIsRestoringSelections(true);
                                skipAutoSelectionRef.current = true;
                                hasRestoredOnceRef.current = true;

                                // If no level to restore, pick the first level from the matching session
                                if (!levelToRestore && matchingSession.levelDetails?.length > 0) {
                                    levelToRestore = matchingSession.levelDetails[0]!.id;
                                }

                                // Update our backup stores first
                                updatePreservedSession(sessionToRestore);
                                updatePreservedLevel(levelToRestore);

                                // Restore immediately without delay
                                setSelectedSession(sessionToRestore);
                                setSelectedLevel(levelToRestore);

                                // Use microtask to clean up flags after state updates
                                Promise.resolve().then(() => {
                                    setIsRestoringSelections(false);
                                    skipAutoSelectionRef.current = false;
                                });
                            } else {
                                setIsRestoringSelections(false);
                                skipAutoSelectionRef.current = false; // Re-enable auto-selection
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error transforming course data:', error);
                }
            }
        };

        loadCourseData();
    }, [courseDetailsData]);

    // Slide count is tied to shared course content (outline/slides) and follows
    // the legacy mapping from session+level → packageSessionId, independent of
    // the Batch/Subgroup selection.
    const slideCountQuery = useQuery({
        ...handleGetSlideCountDetails(packageSessionIds),
        enabled: !!packageSessionIds,
    });

    // Invalidate slide count query when study library data changes (after mutations)
    useEffect(() => {
        if (packageSessionIds) {
            queryClient.invalidateQueries({
                queryKey: ['GET_SLIDES_COUNT', packageSessionIds],
            });
        }
    }, [studyLibraryData, packageSessionIds, queryClient]);

    // Add a global invalidation function that can be called from other components
    useEffect(() => {
        // Create a global function to invalidate slide counts
        (window as unknown as { invalidateSlideCounts?: () => void }).invalidateSlideCounts =
            () => {
                if (packageSessionIds) {
                    queryClient.invalidateQueries({
                        queryKey: ['GET_SLIDES_COUNT', packageSessionIds],
                    });
                }
            };

        // Also expose queryClient globally for other components
        (window as unknown as { queryClient?: typeof queryClient }).queryClient = queryClient;

        // Cleanup on unmount
        return () => {
            delete (
                window as unknown as {
                    invalidateSlideCounts?: () => void;
                }
            ).invalidateSlideCounts;
            delete (
                window as unknown as {
                    queryClient?: typeof queryClient;
                }
            ).queryClient;
        };
    }, [packageSessionIds, queryClient]);

    // Keep the form's instructors field in sync with the currently selected
    // session + level so downstream UI (stats card, authors list) always
    // reflects the active configuration.
    useEffect(() => {
        form.setValue(
            'courseData.instructors',
            getInstructorsBySessionAndLevel(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error – courseDetailsData.sessions shape is normalized by transformer
                courseDetailsData?.sessions,
                selectedSession,
                selectedLevel
            )
        );
    }, [courseDetailsData, currentSession, currentLevel, selectedSession, selectedLevel, form]);

    const [resolvedInstructors, setResolvedInstructors] = useState<InstructorWithPicUrl[]>([]);
    const [loadingInstructors, setLoadingInstructors] = useState(false);
    const instructors: Omit<InstructorWithPicUrl, 'profilePicUrl'>[] =
        form.getValues('courseData').instructors || [];

    // Cache for profilePicId -> url
    const profilePicUrlCache = useRef<Record<string, string>>({});

    // Description expand/collapse state for course header
    const [isDescExpanded, setIsDescExpanded] = useState(false);
    const [isDescClamped, setIsDescClamped] = useState(false);
    const descRef = useRef<HTMLDivElement>(null);
    const courseDescription = form.watch('courseData')?.description;
    useEffect(() => {
        const el = descRef.current;
        if (!el) return;
        setIsDescClamped(el.scrollHeight > el.clientHeight);
    }, [courseDescription, isDescExpanded]);

    // Determine if we should show the dashboard loader.
    // We only block on the initial course-init load; once that finishes,
    // we always render the page (even if slide counts or avatars are
    // still loading) to avoid getting stuck on a spinner for edge cases
    // like courses with multiple child package sessions.
    const isLoading = useMemo(
        () => Boolean(isInitLoading && !courseDetailsData),
        [isInitLoading, courseDetailsData]
    );

    useEffect(() => {
        let isMounted = true;
        async function preloadInstructorAvatars() {
            setLoadingInstructors(true);
            const uniqueProfilePicIds = [
                ...new Set(
                    instructors.map((i) => i.profilePicId).filter((id): id is string => Boolean(id))
                ),
            ];
            // Only fetch URLs for IDs not already in the cache
            await Promise.all(
                uniqueProfilePicIds.map(async (id) => {
                    if (!(id in profilePicUrlCache.current)) {
                        try {
                            profilePicUrlCache.current[id] = await getPublicUrl(id);
                        } catch {
                            profilePicUrlCache.current[id] = '';
                        }
                    }
                })
            );
            if (isMounted) {
                setResolvedInstructors(
                    instructors.map((inst) => ({
                        ...inst,
                        profilePicUrl:
                            inst.profilePicId && profilePicUrlCache.current[inst.profilePicId]
                                ? profilePicUrlCache.current[inst.profilePicId]
                                : '',
                    })) as InstructorWithPicUrl[]
                );
                setLoadingInstructors(false);
            }
        }
        preloadInstructorAvatars();
        return () => {
            isMounted = false;
        };
    }, [JSON.stringify(instructors)]);

    // Check user permissions for editing
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const isAdmin =
        tokenData?.authorities &&
        Object.values(tokenData.authorities).some(
            (auth: Authority) => Array.isArray(auth?.roles) && auth.roles.includes('ADMIN')
        );
    const isAdminOrTeacher =
        tokenData?.authorities &&
        Object.values(tokenData.authorities).some(
            (auth: Authority) =>
                Array.isArray(auth?.roles) &&
                (auth.roles.includes('ADMIN') || auth.roles.includes('TEACHER'))
        );
    const currentUserId = tokenData?.user;

    // Get course status and ownership
    const courseStatus = form.getValues('courseData')?.status;
    const courseCreatedBy = form.getValues('courseData')?.created_by_user_id;
    const isOwnCourse = courseCreatedBy === currentUserId;

    // Role display settings (course page toggles). Use the same async-fetch
    // pattern as authored-courses-tab / NonAdminSlidesView so the component
    // re-renders when the cache populates after first render (e.g. fresh
    // incognito session landing directly on this URL).
    const [roleDisplay, setRoleDisplay] = useState<DisplaySettingsData | null>(() =>
        getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey())
    );
    useEffect(() => {
        const roleKeyInner = getActiveRoleDisplaySettingsKey();
        // Always force-refresh on mount so admin policy changes
        // (e.g. directEditPublishedCourse) take effect on the next page load
        // without waiting for the 24h localStorage TTL to expire.
        getDisplaySettings(roleKeyInner, true)
            .then(setRoleDisplay)
            .catch(() => {
                // On failure, fall back to whatever is cached so the page
                // still renders something sensible.
                const cached = getDisplaySettingsFromCache(roleKeyInner);
                if (cached) setRoleDisplay(cached);
            });
    }, []);
    const coursePage = roleDisplay?.coursePage;
    const allowDirectEditPublished = coursePage?.directEditPublishedCourse === true;

    const canEdit =
        isAdmin ||
        allowDirectEditPublished ||
        (isOwnCourse && courseStatus === 'DRAFT') ||
        (!courseCreatedBy && courseStatus === 'DRAFT');
    const isPublishedCourse = courseStatus === 'ACTIVE';
    const isInReviewCourse = courseStatus === 'IN_REVIEW';
    const isTeacherOnPublishedCourse =
        !isAdmin && isPublishedCourse && !allowDirectEditPublished;
    const showSelectors = !(
        coursePage?.viewCourseConfiguration === false &&
        sessionOptions.length <= 1 &&
        levelOptions.length <= 1
    );

    const { instituteDetails } = useInstituteDetailsStore();
    // Show restriction message for non-editable courses
    const shouldShowRestriction =
        !isAdmin && !allowDirectEditPublished && (isPublishedCourse || isInReviewCourse);

    // Show dashboard loader while loading
    if (isLoading) {
        return <DashboardLoader />;
    }

    return (
        <div className="z-0 flex min-h-screen flex-col bg-gray-50">
            {/* Restriction Banner */}
            {shouldShowRestriction && (
                <div className="border-b border-orange-200 bg-orange-50 px-4 py-3">
                    <div className="container mx-auto">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="font-medium text-orange-600">
                                    Editing Restricted: This course is{' '}
                                    {isPublishedCourse ? 'published' : 'under review'}.
                                </div>
                                <div className="text-sm text-orange-600">
                                    {isPublishedCourse
                                        ? 'Go to My Courses to create an editable copy.'
                                        : "You cannot edit the content while it's under review."}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Course Header - Title and Description on left, Banner/Video on right */}
            <div className="w-full px-2 py-3 sm:px-4 lg:px-6 lg:py-4">
                {!form.watch('courseData')?.title ? (
                    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-10">
                        <div className="space-y-3">
                            <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
                            <div className="h-10 w-4/5 animate-pulse rounded bg-gray-200" />
                            <div className="space-y-2">
                                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                            </div>
                        </div>
                        <div className="hidden h-48 w-full animate-pulse rounded-xl bg-gray-200 lg:block" />
                    </div>
                ) : (
                    (() => {
                        const mediaId = form.watch('courseData')?.courseMediaId?.id;
                        const mediaType = form.watch('courseData')?.courseMediaId?.type;
                        const bannerMediaId = form.watch('courseData')?.courseBannerMediaId;
                        const hasMedia = !!mediaId || !!bannerMediaId;
                        return (
                            <div
                                className={`grid grid-cols-1 items-center gap-6 ${
                                    hasMedia ? 'lg:grid-cols-2 lg:gap-10' : ''
                                }`}
                            >
                                {/* Left side - Tags, Title, Description */}
                                <div className="space-y-3 sm:space-y-4">
                                    {(form.getValues('courseData')?.tags?.length ?? 0) > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {form
                                                .getValues('courseData')
                                                ?.tags?.map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 shadow-sm sm:text-xs"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                        </div>
                                    )}

                                    <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 sm:text-2xl lg:text-3xl">
                                        {form.getValues('courseData')?.title}
                                    </h1>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {form.getValues('courseData')
                                            ?.isCoursePublishedToCatalaouge && (
                                            <MyButton
                                                type="button"
                                                scale="small"
                                                buttonType="primary"
                                                className="rounded-md bg-success-100 font-medium !text-black hover:bg-success-100 focus:bg-success-100 active:bg-success-100"
                                            >
                                                Added to catalog
                                            </MyButton>
                                        )}
                                        {canEdit && (
                                            <AddCourseForm
                                                isEdit={true}
                                                initialCourseData={form.getValues()}
                                                getParentPackageSessionId={({
                                                    sessionId,
                                                    levelId,
                                                }: {
                                                    sessionId: string;
                                                    levelId: string;
                                                }) =>
                                                    parentBatchIdRef.current.get(
                                                        `${sessionId}|${levelId}`
                                                    ) ?? ''
                                                }
                                            />
                                        )}
                                        {coursePage?.showAdvancedCourseIds === true && (
                                            <AdvancedIdsMenu
                                                items={[
                                                    {
                                                        label: 'Course ID',
                                                        value: effectiveCourseId,
                                                    },
                                                    {
                                                        label: 'Package Session ID',
                                                        value: packageSessionIds || '',
                                                    },
                                                    {
                                                        label: 'Session ID',
                                                        value: selectedSession,
                                                    },
                                                    { label: 'Level ID', value: selectedLevel },
                                                ]}
                                            />
                                        )}
                                    </div>

                                    {form.getValues('courseData')?.description && (
                                        <div>
                                            <div
                                                ref={descRef}
                                                className={`text-sm leading-relaxed text-gray-600 sm:text-base ${
                                                    !isDescExpanded ? 'line-clamp-4' : ''
                                                }`}
                                                dangerouslySetInnerHTML={{
                                                    __html:
                                                        form.getValues('courseData')?.description ||
                                                        '',
                                                }}
                                            />
                                            {(isDescClamped || isDescExpanded) && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setIsDescExpanded((prev) => !prev)
                                                    }
                                                    className="mt-1 text-sm font-medium text-primary-500 hover:underline focus:outline-none"
                                                >
                                                    {isDescExpanded ? 'View less' : 'View more'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right side - Video or Banner */}
                                {mediaId &&
                                    (mediaType === 'youtube' ? (
                                        <div className="w-full overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/10">
                                            <div className="relative aspect-video">
                                                <iframe
                                                    width="100%"
                                                    height="100%"
                                                    src={`https://www.youtube.com/embed/${extractYouTubeVideoId(mediaId || '')}`}
                                                    title="YouTube video player"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    className="size-full object-contain"
                                                />
                                            </div>
                                        </div>
                                    ) : mediaType === 'video' ? (
                                        <div className="w-full overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/10">
                                            <div className="relative aspect-video">
                                                <video
                                                    src={
                                                        form.watch('courseData')?.courseMediaPreview
                                                    }
                                                    controls
                                                    controlsList="nodownload noremoteplayback"
                                                    disablePictureInPicture
                                                    disableRemotePlayback
                                                    className="size-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.parentElement?.classList.add(
                                                            'bg-black'
                                                        );
                                                    }}
                                                >
                                                    Your browser does not support the video tag.
                                                </video>
                                            </div>
                                        </div>
                                    ) : (
                                        <img
                                            src={form.watch('courseData')?.courseMediaPreview}
                                            alt="Course Banner"
                                            className="max-h-[300px] w-full rounded-xl object-contain"
                                        />
                                    ))}
                                {!mediaId && bannerMediaId && (
                                    <img
                                        src={form.watch('courseData')?.courseBannerMediaPreview}
                                        alt="Course Banner"
                                        className="max-h-[300px] w-full rounded-xl object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })()
                )}
            </div>

            {/* Main Content */}
            <div className="w-full space-y-2 px-2 py-2 sm:px-4 lg:px-6 lg:py-3">
                <div className="flex flex-col gap-3 xl:flex-row">
                    {/* Left Column - 2/3 width */}
                    <div className="flex w-full grow flex-col xl:w-2/3">
                        {/* Session and Level Selectors */}
                        <div className="w-full px-0 pb-2 lg:pb-3">
                            {showSelectors && (
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:gap-4">
                                    {sessionOptions.length === 1 ? (
                                        sessionOptions[0]?.label.toLocaleLowerCase() !==
                                            'default' && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-medium text-gray-700">
                                                    {sessionOptions[0]?.label}
                                                </label>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-700">
                                                {getTerminology(
                                                    ContentTerms.Session,
                                                    SystemTerms.Session
                                                )}
                                            </label>
                                            <Select
                                                value={selectedSession}
                                                onValueChange={handleSessionChange}
                                                disabled={isTeacherOnPublishedCourse}
                                            >
                                                <SelectTrigger className="h-8 w-full rounded-md text-sm sm:w-40 lg:w-48">
                                                    <SelectValue
                                                        placeholder={`Select ${getTerminology(
                                                            ContentTerms.Session,
                                                            SystemTerms.Session
                                                        )}`}
                                                    />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-md">
                                                    {sessionOptions.map((option) => (
                                                        <SelectItem
                                                            key={option._id}
                                                            value={option.value}
                                                            className="text-sm"
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {levelOptions.length === 1 ? (
                                        levelOptions[0]?.label.toLocaleLowerCase() !==
                                            'default' && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-medium text-gray-700">
                                                    {levelOptions[0]?.label}
                                                </label>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-700">
                                                {getTerminology(
                                                    ContentTerms.Level,
                                                    SystemTerms.Level
                                                )}
                                            </label>
                                            <Select
                                                value={selectedLevel}
                                                onValueChange={handleLevelChange}
                                                disabled={!selectedSession}
                                            >
                                                <SelectTrigger className="h-8 w-full rounded-md text-sm sm:w-40 lg:w-48">
                                                    <SelectValue
                                                        placeholder={`Select ${getTerminology(
                                                            ContentTerms.Level,
                                                            SystemTerms.Level
                                                        )}`}
                                                    />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-md">
                                                    {levelOptions.map((option) => (
                                                        <SelectItem
                                                            key={option._id}
                                                            value={option.value}
                                                            className="text-sm"
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {/* Batch / Subgroup dropdown
                                     * Only show when the global course settings
                                     * default filter is PARENTS_ONLY or CHILDREN_ONLY.
                                     */}
                                    {shouldShowBatchDropdown && (
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-gray-700">
                                                Batch / Subgroup
                                            </label>
                                            <Select
                                                value={selectedBatchId}
                                                onValueChange={handleBatchChange}
                                                disabled={
                                                    !selectedSession ||
                                                    !selectedLevel ||
                                                    isTeacherOnPublishedCourse ||
                                                    batchOptions.length === 0
                                                }
                                            >
                                                <SelectTrigger className="h-8 w-full rounded-md text-sm sm:w-40 lg:w-48">
                                                    <SelectValue placeholder="Select batch" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-md">
                                                    {batchOptions.map((option) => (
                                                        <SelectItem
                                                            key={option.id}
                                                            value={option.id}
                                                            className="text-sm"
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            )}
                            {coursePage?.viewInviteLinks !== false && (
                                <InviteDetailsComponent
                                    form={form}
                                    selectedBatchId={effectiveSelectedBatchId}
                                />
                            )}
                        </div>

                        <CourseStructureDetails
                            selectedSession={selectedSession}
                            selectedLevel={selectedLevel}
                            courseStructure={form.getValues('courseData.courseStructure')}
                            isReadOnly={isTeacherOnPublishedCourse}
                            selectedBatchId={effectiveSelectedBatchId}
                        />

                        {(extractTextFromHTML(form.getValues('courseData').whatYoullLearn) ||
                            extractTextFromHTML(form.getValues('courseData').aboutTheCourse) ||
                            extractTextFromHTML(form.getValues('courseData').whoShouldLearn) ||
                            (instructors && instructors.length > 0 && isAdminOrTeacher)) && (
                            <Accordion
                                type="single"
                                collapsible
                                defaultValue="course-highlights"
                                className="mb-3 lg:mb-4"
                            >
                                <AccordionItem
                                    value="course-highlights"
                                    className="rounded-md border border-b-0 border-neutral-200 bg-white shadow-sm"
                                >
                                    <AccordionTrigger className="px-3 text-base font-semibold text-gray-900 lg:px-4">
                                        Course highlights
                                    </AccordionTrigger>
                                    <AccordionContent className="px-3 pb-3 lg:px-4 lg:pb-4">
                                        <div className="space-y-3 lg:space-y-4">
                                            {/* What You'll Learn Section */}
                                            {extractTextFromHTML(
                                                form.getValues('courseData').whatYoullLearn
                                            ) && (
                                                <div className="rounded-md border-l-4 border-emerald-400 bg-white p-3 shadow-sm">
                                                    <h2 className="mb-2 text-lg font-semibold text-gray-900 lg:mb-3">
                                                        What you&apos;ll learn?
                                                    </h2>
                                                    <div className="rounded-md">
                                                        <p
                                                            className="text-sm leading-relaxed text-gray-700"
                                                            dangerouslySetInnerHTML={{
                                                                __html:
                                                                    form.getValues('courseData')
                                                                        .whatYoullLearn || '',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* About Content Section */}
                                            {extractTextFromHTML(
                                                form.getValues('courseData').aboutTheCourse
                                            ) && (
                                                <div className="rounded-md border-l-4 border-blue-400 bg-white p-3 shadow-sm">
                                                    <h2 className="mb-2 text-lg font-semibold text-gray-900 lg:mb-3">
                                                        About this{' '}
                                                        {getTerminology(
                                                            ContentTerms.Course,
                                                            SystemTerms.Course
                                                        ).toLocaleLowerCase()}
                                                    </h2>
                                                    <div className="rounded-md">
                                                        <p
                                                            className="text-sm leading-relaxed text-gray-700"
                                                            dangerouslySetInnerHTML={{
                                                                __html:
                                                                    form.getValues('courseData')
                                                                        .aboutTheCourse || '',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Who Should Join Section */}
                                            {extractTextFromHTML(
                                                form.getValues('courseData').whoShouldLearn
                                            ) && (
                                                <div className="rounded-md border-l-4 border-purple-400 bg-white p-3 shadow-sm">
                                                    <h2 className="mb-2 text-lg font-semibold text-gray-900 lg:mb-3">
                                                        Who should join?
                                                    </h2>
                                                    <div className="rounded-md">
                                                        <p
                                                            className="text-sm leading-relaxed text-gray-700"
                                                            dangerouslySetInnerHTML={{
                                                                __html:
                                                                    form.getValues('courseData')
                                                                        .whoShouldLearn || '',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Instructors Section - only visible for ADMIN or TEACHER roles */}
                                            {instructors &&
                                                instructors.length > 0 &&
                                                isAdminOrTeacher && (
                                                    <div className="flex flex-col gap-2 rounded-md border-l-4 border-orange-400 bg-white p-3 shadow-sm">
                                                        <h2 className="text-lg font-semibold text-gray-900">
                                                            Authors
                                                        </h2>
                                                        {loadingInstructors ? (
                                                            <div className="text-sm text-gray-600">
                                                                Loading instructors...
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {resolvedInstructors.map(
                                                                    (instructor, index) => (
                                                                        <div
                                                                            key={index}
                                                                            className="flex items-center gap-2 rounded-md p-1"
                                                                        >
                                                                            <Avatar className="size-6">
                                                                                {instructor.profilePicUrl ? (
                                                                                    <AvatarImage
                                                                                        src={
                                                                                            instructor.profilePicUrl
                                                                                        }
                                                                                        alt={
                                                                                            instructor.email
                                                                                        }
                                                                                    />
                                                                                ) : (
                                                                                    <AvatarFallback className="bg-primary-500 text-xs font-medium text-white">
                                                                                        {getInitials(
                                                                                            instructor.email
                                                                                        )}
                                                                                    </AvatarFallback>
                                                                                )}
                                                                            </Avatar>
                                                                            <h3 className="text-sm font-medium text-gray-800">
                                                                                {instructor.name}
                                                                            </h3>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>

                    {/* Right Column - 1/3 width */}
                    <div className="w-full space-y-2 xl:w-1/3">
                        <div className="sticky top-4 rounded-md border bg-white p-3 shadow-sm lg:p-4">
                            {/* Course Stats */}
                            <h2 className="mb-3 line-clamp-2 text-base font-semibold text-gray-900">
                                {form.getValues('courseData').title}
                            </h2>
                            <div className="space-y-2">
                                {levelOptions[0]?.label !== 'default' && (
                                    <div className="flex items-center gap-2">
                                        <StepsIcon size={16} className="shrink-0 text-gray-600" />
                                        <span className="text-sm text-gray-700">
                                            {
                                                levelOptions.find(
                                                    (option) => option.value === selectedLevel
                                                )?.label
                                            }
                                        </span>
                                    </div>
                                )}

                                {/* Course Structure Summary */}
                                {coursePage?.viewCourseOverviewItem !== false &&
                                    form.getValues('courseData').courseStructure > 1 && (
                                        <div className="flex items-center gap-2">
                                            {/* <Folder size={16} className="shrink-0 text-gray-600" /> */}
                                            <span className="text-sm text-gray-700">
                                                {form.getValues('courseData').sessions.length >
                                                    1 && (
                                                    <span>
                                                        {
                                                            form.getValues('courseData').sessions
                                                                .length
                                                        }{' '}
                                                        {getTerminology(
                                                            ContentTerms.Session,
                                                            SystemTerms.Session
                                                        )}
                                                        s
                                                    </span>
                                                )}
                                                {form.getValues('courseData').sessions.length > 1 &&
                                                    levelOptions.length > 1 &&
                                                    ' • '}
                                                {levelOptions.length > 1 && (
                                                    <span>
                                                        {levelOptions.length}{' '}
                                                        {getTerminology(
                                                            ContentTerms.Level,
                                                            SystemTerms.Level
                                                        )}
                                                        s
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                {/* Total Slides Count */}
                                {coursePage?.viewCourseOverviewItem !== false &&
                                    slideCountQuery.data &&
                                    slideCountQuery.data.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <FileText
                                                size={16}
                                                className="shrink-0 text-gray-600"
                                            />
                                            <span className="text-sm text-gray-700">
                                                {slideCountQuery.data.reduce(
                                                    (total: number, count: SlideCountType) =>
                                                        total + count.slide_count,
                                                    0
                                                )}{' '}
                                                Total{' '}
                                                {getTerminology(
                                                    ContentTerms.Slides,
                                                    SystemTerms.Slides
                                                ).toLocaleLowerCase()}
                                                {slideCountQuery.data.reduce(
                                                    (total: number, count: SlideCountType) =>
                                                        total + count.slide_count,
                                                    0
                                                ) !== 1
                                                    ? 's'
                                                    : ''}
                                            </span>
                                        </div>
                                    )}
                                {slideCountQuery.isLoading ? (
                                    <div className="space-y-1">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div
                                                key={i}
                                                className="h-4 w-24 animate-pulse rounded bg-gray-200"
                                            />
                                        ))}
                                    </div>
                                ) : slideCountQuery.error ? (
                                    <div className="text-xs text-red-500">
                                        Error loading slide counts
                                    </div>
                                ) : (
                                    <>
                                        {coursePage?.viewCourseOverviewItem !== false &&
                                        slideCountQuery.data &&
                                        (calculateTotalTimeForCourseDuration(slideCountQuery.data)
                                            .hours ||
                                            calculateTotalTimeForCourseDuration(
                                                slideCountQuery.data
                                            ).minutes) ? (
                                            <div className="flex items-center gap-2">
                                                <Clock
                                                    size={16}
                                                    className="shrink-0 text-gray-600"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {
                                                        calculateTotalTimeForCourseDuration(
                                                            slideCountQuery.data
                                                        ).hours
                                                    }{' '}
                                                    hour{' '}
                                                    {
                                                        calculateTotalTimeForCourseDuration(
                                                            slideCountQuery.data
                                                        ).minutes
                                                    }{' '}
                                                    minutes
                                                </span>
                                            </div>
                                        ) : null}
                                        {coursePage?.viewCourseOverviewItem !== false &&
                                            slideCountQuery.data?.map(
                                                (count: SlideCountType, countIndex: number) => {
                                                    // Helper function to get slide type display name and icon
                                                    const getSlideTypeInfo = (
                                                        sourceType: string | null | undefined
                                                    ) => {
                                                        const safeType =
                                                            sourceType &&
                                                            typeof sourceType === 'string'
                                                                ? sourceType
                                                                : '';
                                                        switch (safeType) {
                                                            case 'HTML_VIDEO':
                                                                return {
                                                                    icon: (
                                                                        <VideoCamera
                                                                            size={16}
                                                                            className="shrink-0 text-purple-600"
                                                                        />
                                                                    ),
                                                                    name: 'AI Content',
                                                                    color: 'text-purple-600',
                                                                };
                                                            case 'VIDEO':
                                                                return {
                                                                    icon: (
                                                                        <PlayCircle
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Video',
                                                                    color: 'text-green-500',
                                                                };
                                                            case 'CODE':
                                                                return {
                                                                    icon: (
                                                                        <Code
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Code Editor',
                                                                    color: 'text-green-500',
                                                                };
                                                            case 'PDF':
                                                                return {
                                                                    icon: (
                                                                        <FilePdf
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'PDF Document',
                                                                    color: 'text-red-500',
                                                                };
                                                            case 'DOCUMENT':
                                                                return {
                                                                    icon: (
                                                                        <FileDoc
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Document',
                                                                    color: 'text-blue-600',
                                                                };
                                                            case 'PRESENTATION':
                                                                return {
                                                                    icon: (
                                                                        <PresentationChart
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Presentation',
                                                                    color: 'text-orange-500',
                                                                };
                                                            case 'JUPYTER':
                                                                return {
                                                                    icon: (
                                                                        <BookOpen
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Jupyter Notebook',
                                                                    color: 'text-violet-500',
                                                                };
                                                            case 'SCRATCH':
                                                                return {
                                                                    icon: (
                                                                        <GameController
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Scratch Project',
                                                                    color: 'text-yellow-500',
                                                                };
                                                            case 'QUESTION':
                                                                return {
                                                                    icon: (
                                                                        <Question
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Question',
                                                                    color: 'text-purple-500',
                                                                };
                                                            case 'QUIZ':
                                                                return {
                                                                    icon: (
                                                                        <ClipboardText
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Quiz',
                                                                    color: 'text-orange-500',
                                                                };
                                                            case 'ASSIGNMENT':
                                                                return {
                                                                    icon: (
                                                                        <File
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: 'Assignment',
                                                                    color: 'text-blue-500',
                                                                };
                                                            default:
                                                                return {
                                                                    icon: (
                                                                        <FileDoc
                                                                            size={16}
                                                                            className="shrink-0 text-gray-600"
                                                                        />
                                                                    ),
                                                                    name: safeType
                                                                        ? safeType
                                                                              .charAt(0)
                                                                              .toUpperCase() +
                                                                          safeType
                                                                              .slice(1)
                                                                              .toLowerCase()
                                                                        : 'Slide',
                                                                    color: 'text-gray-500',
                                                                };
                                                        }
                                                    };

                                                    const slideTypeInfo = getSlideTypeInfo(
                                                        count.source_type
                                                    );

                                                    return (
                                                        <div
                                                            key={
                                                                count.source_type ??
                                                                `slide-type-${countIndex}`
                                                            }
                                                            className="flex items-center gap-2"
                                                        >
                                                            {slideTypeInfo.icon}
                                                            <span className="text-sm text-gray-700">
                                                                {count.slide_count}{' '}
                                                                {slideTypeInfo.name}{' '}
                                                                {getTerminology(
                                                                    ContentTerms.Slides,
                                                                    SystemTerms.Slides
                                                                ).toLocaleLowerCase()}
                                                                {count.slide_count !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                            )}

                                        {form.getValues('courseData').instructors.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <ChalkboardTeacher
                                                    size={16}
                                                    className="shrink-0 text-gray-600"
                                                />
                                                <span className="truncate text-sm text-gray-700">
                                                    {form
                                                        .getValues('courseData')
                                                        .instructors.map((i) => i.name)
                                                        .join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        {/* Enrollment workflow run(s) for the selected batch —
                            renders nothing when no workflow is attached. */}
                        {packageSessionIds && (
                            <EnrollmentWorkflowStatus
                                instituteId={instituteDetails?.id || ''}
                                packageSessionIds={[packageSessionIds]}
                            />
                        )}
                        {dripConditionsEnabled && (
                            <div className="sticky top-4 rounded-md border bg-white p-3 shadow-sm lg:p-4">
                                <PackageDripConditionsCard
                                    packageId={searchParams.courseId || ''}
                                    packageName={form.getValues('courseData').title || 'Course'}
                                    conditions={dripConditions.filter(
                                        (c) =>
                                            c.level === 'package' &&
                                            c.level_id === searchParams.courseId
                                    )}
                                    onAdd={handleAddDripCondition}
                                    onUpdate={handleUpdateDripCondition}
                                    onDelete={handleDeleteDripCondition}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <CourseDetailsRatingsComponent
                    currentSession={selectedSession}
                    currentLevel={selectedLevel}
                />
            </div>
        </div>
    );
};
