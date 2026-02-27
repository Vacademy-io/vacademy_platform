import { StepsIcon } from '@phosphor-icons/react';
import { useRouter } from '@tanstack/react-router';
import {
    ChalkboardTeacher,
    Clock,
    Code,
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
} from '@phosphor-icons/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import { extractTextFromHTML } from '@/constants/helper';

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

export const CourseDetailsPage = () => {
    const router = useRouter();
    const searchParams = router.state.location.search;
    const queryClient = useQueryClient();

    const { studyLibraryData } = useStudyLibraryStore();

    const courseDetailsData = useMemo(() => {
        return studyLibraryData?.find((item) => item.course.id === searchParams.courseId);
    }, [studyLibraryData]);

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
    const [isRestoringSelections, setIsRestoringSelections] = useState<boolean>(false);
    const [dripConditionsEnabled, setDripConditionsEnabled] = useState<boolean>(false);
    const [dripConditions, setDripConditions] = useState<DripCondition[]>([]);

    // Use refs to preserve selections across re-renders and data fetches
    const preservedSessionRef = useRef<string>('');
    const preservedLevelRef = useRef<string>('');
    const isInitialLoadRef = useRef<boolean>(true);
    const hasRestoredOnceRef = useRef<boolean>(false);
    const skipAutoSelectionRef = useRef<boolean>(false);

    // Backup mechanism using localStorage
    const STORAGE_KEY_SESSION = `preserved_session_${searchParams.courseId}`;
    const STORAGE_KEY_LEVEL = `preserved_level_${searchParams.courseId}`;

    // Initialize refs from localStorage on component mount
    useEffect(() => {
        const storedSession = localStorage.getItem(STORAGE_KEY_SESSION);
        const storedLevel = localStorage.getItem(STORAGE_KEY_LEVEL);

        if (storedSession) {
            preservedSessionRef.current = storedSession;
        }
        if (storedLevel) {
            preservedLevelRef.current = storedLevel;
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

    // Try to get packageSessionId from course-init API first (new approach)
    const packageSessionIdFromCourseInit = useGetPackageSessionIdFromCourseInit(
        searchParams.courseId ?? '',
        currentSession?.sessionDetails.id ?? '',
        currentLevel?.id ?? ''
    );
    // Fallback to institute details if course-init doesn't have it
    const packageSessionIdFromInstitute =
        useGetPackageSessionId(
            searchParams.courseId ?? '',
            currentSession?.sessionDetails.id ?? '',
            currentLevel?.id ?? ''
        ) || '';
    // Prefer course-init data, fallback to institute details
    const packageSessionIds = packageSessionIdFromCourseInit || packageSessionIdFromInstitute;

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

    // Load drip conditions from course settings
    useEffect(() => {
        const loadDripSettings = async () => {
            try {
                const settings = await getCourseSettings();
                setDripConditionsEnabled(settings.dripConditions.enabled);
                setDripConditions(settings.dripConditions.conditions);
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
            alert('Failed to save drip condition. Please try again.');
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
            alert('Failed to update drip condition. Please try again.');
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
            alert('Failed to delete drip condition. Please try again.');
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

                        if (sessionToRestore && levelToRestore) {
                            // Check if preserved session still exists in the new data
                            const sessionExists = transformedData.sessions?.some(
                                (session: { sessionDetails: { id: string } }) =>
                                    session.sessionDetails.id === sessionToRestore
                            );

                            if (sessionExists) {
                                // Set flags to prevent auto-selection interference
                                setIsRestoringSelections(true);
                                skipAutoSelectionRef.current = true;
                                hasRestoredOnceRef.current = true;

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

    // Add this with other queries at the top level of the component
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

    useEffect(() => {
        form.setValue(
            'courseData.instructors',
            getInstructorsBySessionAndLevel(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                courseDetailsData?.sessions,
                selectedSession,
                selectedLevel
            )
        );
    }, [currentLevel, currentSession]);

    const [resolvedInstructors, setResolvedInstructors] = useState<InstructorWithPicUrl[]>([]);
    const [loadingInstructors, setLoadingInstructors] = useState(false);
    const instructors: Omit<InstructorWithPicUrl, 'profilePicUrl'>[] =
        form.getValues('courseData').instructors || [];

    // Cache for profilePicId -> url
    const profilePicUrlCache = useRef<Record<string, string>>({});

    // Determine if we should show the dashboard loader
    const isLoading = useMemo(() => {
        // Show loader if study library data is not loaded yet
        if (!studyLibraryData) {
            return true;
        }

        // Show loader if course details data is not found for the current courseId
        if (!courseDetailsData) {
            return true;
        }

        // Show loader if form data hasn't been loaded yet (title is empty)
        if (!form.getValues('courseData')?.title) {
            return true;
        }

        // Show loader if instructor avatars are loading
        if (loadingInstructors) {
            return true;
        }

        // Show loader if slide count query is loading and we have packageSessionIds
        if (packageSessionIds && slideCountQuery.isLoading) {
            return true;
        }

        return false;
    }, [
        studyLibraryData,
        courseDetailsData,
        form.watch('courseData.title'),
        loadingInstructors,
        packageSessionIds,
        slideCountQuery.isLoading,
    ]);

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
    const currentUserId = tokenData?.user;

    // Get course status and ownership
    const courseStatus = form.getValues('courseData')?.status;
    const courseCreatedBy = form.getValues('courseData')?.created_by_user_id;
    const isOwnCourse = courseCreatedBy === currentUserId;

    const canEdit =
        isAdmin ||
        (isOwnCourse && courseStatus === 'DRAFT') ||
        (!courseCreatedBy && courseStatus === 'DRAFT');
    const isPublishedCourse = courseStatus === 'ACTIVE';
    const isInReviewCourse = courseStatus === 'IN_REVIEW';
    const isTeacherOnPublishedCourse = !isAdmin && isPublishedCourse;
    // Role display settings (course page toggles)
    const roleKey = isAdmin ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;
    const roleDisplay: DisplaySettingsData | null = getDisplaySettingsFromCache(roleKey);
    const coursePage = roleDisplay?.coursePage;
    const showSelectors = !(
        coursePage?.viewCourseConfiguration === false &&
        sessionOptions.length <= 1 &&
        levelOptions.length <= 1
    );

    const { instituteDetails } = useInstituteDetailsStore();
    // Show restriction message for non-editable courses
    const shouldShowRestriction =
        !isAdmin &&
        (isPublishedCourse || isInReviewCourse);

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

            {/* Top Banner - More Compact */}
            <div
                className={`relative ${form.watch('courseData')?.courseBannerMediaId
                        ? form.getValues('courseData')?.isCoursePublishedToCatalaouge
                            ? 'min-h-[200px] sm:min-h-[220px] lg:min-h-[240px]'
                            : 'min-h-[180px] sm:min-h-[200px] lg:min-h-[220px]'
                        : form.getValues('courseData')?.isCoursePublishedToCatalaouge
                            ? 'min-h-[140px] sm:min-h-[160px] lg:min-h-[180px]'
                            : 'min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]'
                    }`}
            >
                {/* Transparent black overlay */}
                {form.watch('courseData')?.courseBannerMediaId ? (
                    <div className="pointer-events-none absolute inset-0 z-10 bg-black/50" />
                ) : (
                    <div className="pointer-events-none absolute inset-0 z-10 bg-black/5" />
                )}
                {!form.watch('courseData')?.courseBannerMediaId ? (
                    <div className="absolute inset-0 z-0 bg-gray-100" />
                ) : (
                    <div className="absolute inset-0 z-0 opacity-70">
                        <img
                            src={form.watch('courseData')?.courseBannerMediaPreview}
                            alt="Course Banner"
                            className="size-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.classList.add('bg-primary-500');
                            }}
                        />
                    </div>
                )}
                {/* Primary color overlay with 70% opacity */}
                <div
                    className={`container relative z-20 mx-auto px-3 sm:px-4 lg:px-6 ${form.watch('courseData')?.courseBannerMediaId
                            ? 'py-4 sm:py-5 lg:py-6'
                            : 'py-3 sm:py-4 lg:py-5'
                        } ${!form.watch('courseData')?.courseBannerMediaId ? 'text-black' : 'text-white'}`}
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                        {/* Left side - Title and Description */}
                        <div className="max-w-none flex-1 lg:max-w-2xl">
                            {!form.watch('courseData')?.title ? (
                                <div className="space-y-2">
                                    <div className="h-4 w-24 animate-pulse rounded bg-white/20" />
                                    <div className="h-6 w-3/4 animate-pulse rounded bg-white/20" />
                                    <div className="h-3 w-full animate-pulse rounded bg-white/20" />
                                    <div className="h-3 w-2/3 animate-pulse rounded bg-white/20" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between gap-4">
                                        <h1
                                            className={`font-semibold leading-tight ${form.watch('courseData')?.courseBannerMediaId
                                                    ? 'mb-2 text-lg sm:text-xl lg:text-2xl'
                                                    : 'mb-1 text-base sm:text-lg lg:text-xl'
                                                }`}
                                        >
                                            {form.getValues('courseData')?.title}
                                        </h1>
                                    </div>
                                    <p
                                        className={`leading-snug opacity-90 ${form.watch('courseData')?.courseBannerMediaId
                                                ? 'mb-2 text-xs sm:text-sm'
                                                : 'mb-1 text-xs'
                                            }`}
                                        dangerouslySetInnerHTML={{
                                            __html: form.getValues('courseData')?.description || '',
                                        }}
                                    />
                                    {form.getValues('courseData')
                                        ?.isCoursePublishedToCatalaouge && (
                                            <MyButton
                                                type="button"
                                                scale="small"
                                                buttonType="primary"
                                                className="mb-2 rounded-md bg-success-100 font-medium !text-black hover:bg-success-100 focus:bg-success-100 active:bg-success-100"
                                            >
                                                Added to catalog
                                            </MyButton>
                                        )}
                                    {canEdit && (
                                        <div className="mb-2">
                                            <AddCourseForm
                                                isEdit={true}
                                                initialCourseData={form.getValues()}
                                            />
                                        </div>
                                    )}
                                    {(form.getValues('courseData')?.tags?.length ?? 0) > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {form
                                                .getValues('courseData')
                                                ?.tags?.map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className="rounded-md border bg-white/10 px-2 py-0.5 text-xs shadow-sm backdrop-blur-sm"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Right side - Video Player - More Compact */}
                        {form.watch('courseData')?.courseMediaId?.id &&
                            (form.watch('courseData')?.courseMediaId?.type === 'youtube' ? (
                                <div
                                    className={`shrink-0 overflow-hidden rounded-lg shadow-lg ${form.watch('courseData')?.courseBannerMediaId
                                            ? 'w-full lg:w-[280px] xl:w-[320px]'
                                            : 'w-full lg:w-[240px] xl:w-[280px]'
                                        }`}
                                >
                                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            src={`https://www.youtube.com/embed/${extractYouTubeVideoId(form.watch('courseData')?.courseMediaId?.id || '')}`}
                                            title="YouTube video player"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="size-full object-contain"
                                        />
                                    </div>
                                </div>
                            ) : form.watch('courseData')?.courseMediaId?.type === 'video' ? (
                                <div
                                    className={`shrink-0 overflow-hidden rounded-lg shadow-lg ${form.watch('courseData')?.courseBannerMediaId
                                            ? 'w-full lg:w-[280px] xl:w-[320px]'
                                            : 'w-full lg:w-[240px] xl:w-[280px]'
                                        }`}
                                >
                                    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                                        <video
                                            src={form.watch('courseData')?.courseMediaPreview}
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
                                <div
                                    className={`shrink-0 overflow-hidden rounded-lg shadow-lg ${form.watch('courseData')?.courseBannerMediaId
                                            ? 'w-full lg:w-[280px] xl:w-[320px]'
                                            : 'w-full lg:w-[240px] xl:w-[280px]'
                                        }`}
                                >
                                    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                                        <img
                                            src={form.watch('courseData')?.courseMediaPreview}
                                            alt="Course Banner"
                                            className="size-full object-contain"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-3 py-4 sm:px-4 lg:p-6">
                <div className="flex flex-col gap-4 lg:gap-6 xl:flex-row">
                    {/* Left Column - 2/3 width */}
                    <div className="flex w-full grow flex-col xl:w-2/3">
                        {/* Session and Level Selectors */}
                        <div className="container mx-auto px-0 pb-3 lg:pb-4">
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
                                                disabled={
                                                    !selectedSession || isTeacherOnPublishedCourse
                                                }
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
                                </div>
                            )}
                            {coursePage?.viewInviteLinks !== false && (
                                <InviteDetailsComponent form={form} />
                            )}
                        </div>

                        <CourseStructureDetails
                            selectedSession={selectedSession}
                            selectedLevel={selectedLevel}
                            courseStructure={form.getValues('courseData.courseStructure')}
                            isReadOnly={isTeacherOnPublishedCourse}
                        />

                        {/* What You'll Learn Section */}
                        {extractTextFromHTML(form.getValues('courseData').whatYoullLearn) && (
                            <div className="mb-4 mt-3 rounded-md bg-white p-3 shadow-sm lg:mb-6 lg:mt-4 lg:p-4">
                                <h2 className="mb-2 text-lg font-semibold text-gray-900 lg:mb-3">
                                    What you&apos;ll learn?
                                </h2>
                                <div className="rounded-md">
                                    <p
                                        className="text-sm leading-relaxed text-gray-700"
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                form.getValues('courseData').whatYoullLearn || '',
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* About Content Section */}
                        {extractTextFromHTML(form.getValues('courseData').aboutTheCourse) && (
                            <div className="mb-4 rounded-md bg-white p-3 shadow-sm lg:mb-6 lg:p-4">
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
                                                form.getValues('courseData').aboutTheCourse || '',
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Who Should Join Section */}
                        {extractTextFromHTML(form.getValues('courseData').whoShouldLearn) && (
                            <div className="mb-4 rounded-md bg-white p-3 shadow-sm lg:mb-6 lg:p-4">
                                <h2 className="mb-2 text-lg font-semibold text-gray-900 lg:mb-3">
                                    Who should join?
                                </h2>
                                <div className="rounded-md">
                                    <p
                                        className="text-sm leading-relaxed text-gray-700"
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                form.getValues('courseData').whoShouldLearn || '',
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Instructors Section */}
                        {instructors && instructors.length > 0 && (
                            <div className="mb-4 flex flex-col gap-2 rounded-md bg-white p-3 shadow-sm lg:mb-6 lg:p-4">
                                <h2 className="text-lg font-semibold text-gray-900">Authors</h2>
                                {loadingInstructors ? (
                                    <div className="text-sm text-gray-600">
                                        Loading instructors...
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {resolvedInstructors.map((instructor, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 rounded-md p-1"
                                            >
                                                <Avatar className="size-6">
                                                    {instructor.profilePicUrl ? (
                                                        <AvatarImage
                                                            src={instructor.profilePicUrl}
                                                            alt={instructor.email}
                                                        />
                                                    ) : (
                                                        <AvatarFallback className="bg-[#3B82F6] text-xs font-medium text-white">
                                                            {getInitials(instructor.email)}
                                                        </AvatarFallback>
                                                    )}
                                                </Avatar>
                                                <h3 className="text-sm font-medium text-gray-800">
                                                    {instructor.name}
                                                </h3>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                            slideCountQuery.data?.map((count: SlideCountType, countIndex: number) => {
                                                // Helper function to get slide type display name and icon
                                                const getSlideTypeInfo = (sourceType: string | null | undefined) => {
                                                    const safeType = sourceType && typeof sourceType === 'string' ? sourceType : '';
                                                    switch (safeType) {
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
                                                                    ? safeType.charAt(0).toUpperCase() + safeType.slice(1).toLowerCase()
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
                                                        key={count.source_type ?? `slide-type-${countIndex}`}
                                                        className="flex items-center gap-2"
                                                    >
                                                        {slideTypeInfo.icon}
                                                        <span className="text-sm text-gray-700">
                                                            {count.slide_count} {slideTypeInfo.name}{' '}
                                                            {getTerminology(
                                                                ContentTerms.Slides,
                                                                SystemTerms.Slides
                                                            ).toLocaleLowerCase()}
                                                            {count.slide_count !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                );
                                            })}

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
