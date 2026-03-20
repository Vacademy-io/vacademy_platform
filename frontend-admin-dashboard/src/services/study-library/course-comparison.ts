import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_MODULES_WITH_CHAPTERS,
    GET_CHAPTERS_WITH_SLIDES,
    INIT_COURSE_STUDY_LIBRARY,
    GET_SLIDES, // Added for direct slides API
} from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    ModulesWithChaptersResponse,
    ChaptersWithSlidesResponse,
    CourseComparisonResult,
    ComparisonItem,
    ChangeType,
    PackageSession,
} from '@/types/study-library/course-comparison';

// Fetch modules with chapters for a subject and package session
export const fetchModulesWithChaptersForComparison = async (
    subjectId: string,
    packageSessionId: string
): Promise<ModulesWithChaptersResponse[]> => {
    console.log('🔄 Making API call to GET_MODULES_WITH_CHAPTERS:', {
        url: GET_MODULES_WITH_CHAPTERS,
        params: { subjectId, packageSessionId },
    });

    const response = await authenticatedAxiosInstance.get(GET_MODULES_WITH_CHAPTERS, {
        params: {
            subjectId,
            packageSessionId,
        },
    });

    console.log('📊 GET_MODULES_WITH_CHAPTERS response:', {
        status: response.status,
        statusText: response.statusText,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        length: Array.isArray(response.data) ? response.data.length : 'N/A',
        data: response.data,
    });

    return response.data;
};

// Fetch chapters with slides for a module and package session
export const fetchChaptersWithSlidesForComparison = async (
    moduleId: string,
    packageSessionId: string
): Promise<ChaptersWithSlidesResponse[]> => {
    const response = await authenticatedAxiosInstance.get(GET_CHAPTERS_WITH_SLIDES, {
        params: {
            moduleId,
            packageSessionId,
        },
    });
    return response.data;
};

// NEW: Fetch slides directly for a chapter (working approach)
export const fetchSlidesDirectly = async (chapterId: string): Promise<any[]> => {
    console.log('🔄 Making direct API call to GET_SLIDES:', {
        url: GET_SLIDES,
        params: { chapterId },
    });

    const response = await authenticatedAxiosInstance.get(`${GET_SLIDES}?chapterId=${chapterId}`);

    console.log('📊 GET_SLIDES response:', {
        status: response.status,
        statusText: response.statusText,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        length: Array.isArray(response.data) ? response.data.length : 'N/A',
        slides: response.data,
    });

    return response.data || [];
};

// Get all subjects for a course
export const fetchSubjectsForComparison = async (courseId: string) => {
    // This would typically come from the study library data
    // Using the course-init API for course-specific data
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

    const response = await authenticatedAxiosInstance.get(INIT_COURSE_STUDY_LIBRARY, {
        params: {
            courseId,
            instituteId: INSTITUTE_ID,
        },
    });
    return response.data;
};

// Compare two items and determine change type
const determineChangeType = (
    current: any,
    original: any,
    itemType: 'subject' | 'module' | 'chapter' | 'slide'
): { changeType: ChangeType; changes: string[] } => {
    if (!current && original) {
        return { changeType: 'deleted', changes: [] };
    }

    if (current && !original) {
        return { changeType: 'added', changes: [] };
    }

    if (current?.parent_id === null) {
        return { changeType: 'added', changes: [] };
    }

    const changes: string[] = [];

    // Check for name changes based on item type
    let currentName = '';
    let originalName = '';

    switch (itemType) {
        case 'subject':
            currentName = current?.subject_name || '';
            originalName = original?.subject_name || '';
            if (currentName !== originalName) changes.push('Name');
            break;
        case 'module':
            currentName = current?.module_name || '';
            originalName = original?.module_name || '';
            if (currentName !== originalName) changes.push('Name');
            if (current?.description !== original?.description) changes.push('Description');
            break;
        case 'chapter':
            currentName = current?.chapter_name || '';
            originalName = original?.chapter_name || '';
            if (currentName !== originalName) changes.push('Name');
            if (current?.description !== original?.description) changes.push('Description');
            break;
        case 'slide':
            currentName = current?.title || '';
            originalName = original?.title || '';
            if (currentName !== originalName) changes.push('Title');

            // Check for published data changes in document slides
            if (
                current?.document_slide?.published_data !== original?.document_slide?.published_data
            ) {
                changes.push('Content');
            }

            // Check for video URL changes
            if (current?.video_slide?.published_url !== original?.video_slide?.published_url) {
                changes.push('Video URL');
            }
            break;
    }

    return {
        changeType: changes.length > 0 ? 'updated' : 'unchanged',
        changes,
    };
};

// Create comparison items from modules data
const createModuleComparisonItems = (
    currentModules: ModulesWithChaptersResponse[],
    originalModules: ModulesWithChaptersResponse[]
): ComparisonItem[] => {
    const comparisonItems: ComparisonItem[] = [];

    // Create a map of original modules for quick lookup
    const originalModulesMap = new Map();
    originalModules.forEach((moduleData) => {
        originalModulesMap.set(moduleData.module.id, moduleData.module);
    });

    // Check current modules
    currentModules.forEach((moduleData) => {
        const currentModule = moduleData.module;
        const originalModule = originalModulesMap.get(currentModule.id);

        const { changeType, changes } = determineChangeType(
            currentModule,
            originalModule,
            'module'
        );

        comparisonItems.push({
            id: currentModule.id,
            name: currentModule.module_name,
            type: 'module',
            changeType,
            originalData: originalModule,
            currentData: currentModule,
            changes,
        });

        // Remove from original map to track deletions
        originalModulesMap.delete(currentModule.id);
    });

    // Add deleted modules
    originalModulesMap.forEach((originalModule) => {
        comparisonItems.push({
            id: originalModule.id,
            name: originalModule.module_name,
            type: 'module',
            changeType: 'deleted',
            originalData: originalModule,
            currentData: null,
            changes: [],
        });
    });

    return comparisonItems;
};

// Create comparison items from chapters data
const createChapterComparisonItems = (
    currentChapters: ChaptersWithSlidesResponse[],
    originalChapters: ChaptersWithSlidesResponse[]
): ComparisonItem[] => {
    const comparisonItems: ComparisonItem[] = [];

    // Create a map of original chapters for quick lookup
    const originalChaptersMap = new Map();
    originalChapters.forEach((chapterData) => {
        originalChaptersMap.set(chapterData.chapter.id, chapterData.chapter);
    });

    // Check current chapters
    currentChapters.forEach((chapterData) => {
        const currentChapter = chapterData.chapter;
        const originalChapter = originalChaptersMap.get(currentChapter.id);

        const { changeType, changes } = determineChangeType(
            currentChapter,
            originalChapter,
            'chapter'
        );

        comparisonItems.push({
            id: currentChapter.id,
            name: currentChapter.chapter_name,
            type: 'chapter',
            changeType,
            originalData: originalChapter,
            currentData: currentChapter,
            changes,
        });

        // Remove from original map to track deletions
        originalChaptersMap.delete(currentChapter.id);
    });

    // Add deleted chapters
    originalChaptersMap.forEach((originalChapter) => {
        comparisonItems.push({
            id: originalChapter.id,
            name: originalChapter.chapter_name,
            type: 'chapter',
            changeType: 'deleted',
            originalData: originalChapter,
            currentData: null,
            changes: [],
        });
    });

    return comparisonItems;
};

// Create comparison items from slides data
const createSlideComparisonItems = (
    currentSlides: any[],
    originalSlides: any[]
): ComparisonItem[] => {
    const comparisonItems: ComparisonItem[] = [];

    // Create a map of original slides for quick lookup
    const originalSlidesMap = new Map();
    originalSlides.forEach((slide) => {
        originalSlidesMap.set(slide.id, slide);
    });

    // Check current slides
    currentSlides.forEach((currentSlide) => {
        const originalSlide = originalSlidesMap.get(currentSlide.id);

        const { changeType, changes } = determineChangeType(currentSlide, originalSlide, 'slide');

        comparisonItems.push({
            id: currentSlide.id,
            name: currentSlide.title,
            type: 'slide',
            changeType,
            originalData: originalSlide,
            currentData: currentSlide,
            changes,
        });

        // Remove from original map to track deletions
        originalSlidesMap.delete(currentSlide.id);
    });

    // Add deleted slides
    originalSlidesMap.forEach((originalSlide) => {
        comparisonItems.push({
            id: originalSlide.id,
            name: originalSlide.title,
            type: 'slide',
            changeType: 'deleted',
            originalData: originalSlide,
            currentData: null,
            changes: [],
        });
    });

    return comparisonItems;
};

// Main comparison function
export const compareCourses = async (
    currentCourseId: string,
    originalCourseId: string | null,
    subjectId: string,
    packageSessionId: string
): Promise<CourseComparisonResult> => {
    try {
        const isNewCourse = !originalCourseId;

        console.log('🔄 Starting course comparison:', {
            currentCourseId,
            originalCourseId,
            subjectId,
            packageSessionId,
            isNewCourse,
        });

        // Fetch current course data
        console.log(
            '🔄 Fetching modules with chapters for subject:',
            subjectId,
            'session:',
            packageSessionId
        );
        const currentModulesData = await fetchModulesWithChaptersForComparison(
            subjectId,
            packageSessionId
        );
        console.log('📊 Found modules data:', {
            moduleCount: currentModulesData.length,
            modules: currentModulesData.map((m) => ({
                id: m.module.id,
                name: m.module.module_name,
                chaptersCount: m.chapters.length,
            })),
        });

        // Get all chapters with slides for current course
        const currentChaptersData: ChaptersWithSlidesResponse[] = [];

        // Fetch slides for each module
        for (const moduleData of currentModulesData) {
            console.log(
                '🔄 Fetching chapters with slides for module:',
                moduleData.module.id,
                moduleData.module.module_name
            );
            const chaptersWithSlides = await fetchChaptersWithSlidesForComparison(
                moduleData.module.id,
                packageSessionId
            );
            console.log('📊 Found chapters with slides:', {
                moduleId: moduleData.module.id,
                chaptersCount: chaptersWithSlides.length,
                chapters: chaptersWithSlides.map((c) => ({
                    id: c.chapter.id,
                    name: c.chapter.chapter_name,
                    slidesCount: c.slides.length,
                })),
            });
            currentChaptersData.push(...chaptersWithSlides);
        }

        console.log('📊 Total chapters collected:', {
            totalChapters: currentChaptersData.length,
            totalSlides: currentChaptersData.reduce(
                (sum, chapter) => sum + chapter.slides.length,
                0
            ),
        });

        // For new courses, show everything as "added"
        // For existing courses, use parent_id logic
        const moduleComparisons: ComparisonItem[] = currentModulesData.map((moduleData) => {
            const module = moduleData.module;
            const changeType = isNewCourse
                ? 'added'
                : module.parent_id === null
                  ? 'added'
                  : 'unchanged';

            return {
                id: module.id,
                name: module.module_name,
                type: 'module' as const,
                changeType,
                originalData: null,
                currentData: module,
                changes: [],
            };
        });

        const chapterComparisons: ComparisonItem[] = currentChaptersData.map((chapterData) => {
            const chapter = chapterData.chapter;
            const changeType = isNewCourse
                ? 'added'
                : chapter.parent_id === null
                  ? 'added'
                  : 'unchanged';

            return {
                id: chapter.id,
                name: chapter.chapter_name,
                type: 'chapter' as const,
                changeType,
                originalData: null,
                currentData: chapter,
                changes: [],
            };
        });

        // Collect all slides from chapters
        const currentSlides = currentChaptersData.flatMap((chapterData) => chapterData.slides);
        const slideComparisons: ComparisonItem[] = currentSlides.map((slide) => {
            const changeType = isNewCourse
                ? 'added'
                : slide.parent_id === null
                  ? 'added'
                  : 'unchanged';

            return {
                id: slide.id,
                name: slide.title,
                type: 'slide' as const,
                changeType,
                originalData: null,
                currentData: slide,
                changes: [],
            };
        });

        // Calculate summary
        const allComparisons = [...moduleComparisons, ...chapterComparisons, ...slideComparisons];
        const summary = {
            totalAdded: allComparisons.filter((item) => item.changeType === 'added').length,
            totalDeleted: allComparisons.filter((item) => item.changeType === 'deleted').length,
            totalUpdated: allComparisons.filter((item) => item.changeType === 'updated').length,
            totalUnchanged: allComparisons.filter((item) => item.changeType === 'unchanged').length,
        };

        console.log('✅ Course comparison completed:', {
            modulesCount: moduleComparisons.length,
            chaptersCount: chapterComparisons.length,
            slidesCount: slideComparisons.length,
            isNewCourse,
            summary,
        });

        return {
            subjects: [], // Subjects comparison can be added here
            modules: moduleComparisons,
            chapters: chapterComparisons,
            slides: slideComparisons,
            summary,
        };
    } catch (error) {
        console.error('Error comparing courses:', error);
        throw new Error('Failed to compare courses');
    }
};

// NEW: Simplified comparison using direct slides API
export const compareCoursesDirectly = async (
    currentCourseId: string,
    originalCourseId: string | null,
    currentChapterId: string
): Promise<CourseComparisonResult> => {
    try {
        const isNewCourse = !originalCourseId;
        console.log('🔄 Starting DIRECT course comparison:', {
            currentCourseId,
            originalCourseId,
            currentChapterId,
            isNewCourse,
        });

        // Fetch current slides directly
        const currentSlides = await fetchSlidesDirectly(currentChapterId);
        console.log('📊 Found current slides:', {
            slidesCount: currentSlides.length,
            slides: currentSlides,
        });

        // For new courses, show all slides as "added"
        if (isNewCourse) {
            const slideComparisons: ComparisonItem[] = currentSlides.map((slide) => ({
                id: slide.id,
                name: slide.title || slide.slide_title || 'Untitled Slide',
                type: 'slide' as const,
                changeType: 'added' as const,
                originalData: null,
                currentData: slide,
                changes: [],
            }));

            console.log('✅ DIRECT course comparison completed (new course):', {
                slidesCount: slideComparisons.length,
                isNewCourse: true,
            });

            return {
                subjects: [], // Not used in direct approach
                modules: [], // Not used in direct approach
                chapters: [], // Not used in direct approach
                slides: slideComparisons,
                summary: {
                    totalAdded: slideComparisons.length,
                    totalUpdated: 0,
                    totalDeleted: 0,
                    totalUnchanged: 0,
                },
                isNewCourse: true,
            };
        }

        // For existing courses, we would need to fetch original slides
        // For now, let's implement the new course case first
        console.log('⚠️ Existing course comparison not yet implemented in direct approach');
        return {
            subjects: [],
            modules: [],
            chapters: [],
            slides: [],
            summary: {
                totalAdded: 0,
                totalUpdated: 0,
                totalDeleted: 0,
                totalUnchanged: 0,
            },
            isNewCourse: false,
        };
    } catch (error) {
        console.error('❌ Error in DIRECT course comparison:', error);
        throw new Error('Failed to compare courses directly');
    }
};

// Get package sessions for a course from study library data
export const getPackageSessionsForCourse = async (
    courseId: string,
    subjectId?: string
): Promise<PackageSession[]> => {
    try {
        console.log('🔄 Fetching package sessions for course:', courseId);

        // Get institute ID from token (same as existing study library service)
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const tokenData = getTokenDecodedData(accessToken);
        const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

        if (!INSTITUTE_ID) {
            console.error('❌ No institute ID found in token');
            return [{ id: 'DEFAULT', name: 'Default Session' }];
        }

        console.log('🏢 Using institute ID:', INSTITUTE_ID);

        // Fetch course data from study library course-init endpoint using the correct URL constant
        const response = await authenticatedAxiosInstance.get(INIT_COURSE_STUDY_LIBRARY, {
            params: {
                courseId,
                instituteId: INSTITUTE_ID,
            },
        });
        let studyLibraryData = response.data;

        console.log('📊 Raw API response:', {
            status: response.status,
            statusText: response.statusText,
            dataType: typeof studyLibraryData,
            isArray: Array.isArray(studyLibraryData),
            url: INIT_COURSE_STUDY_LIBRARY,
        });

        // Handle string response (likely HTML error page)
        if (typeof studyLibraryData === 'string') {
            try {
                studyLibraryData = JSON.parse(studyLibraryData);
                console.log('✅ Successfully parsed string response as JSON');
            } catch (parseError) {
                console.error('❌ API returned non-JSON string response, using default session');
                return [{ id: 'DEFAULT', name: 'Default Session' }];
            }
        }

        // Validate array structure
        if (!Array.isArray(studyLibraryData)) {
            console.warn('⚠️ Study library data is not an array, using default session');
            return [{ id: 'DEFAULT', name: 'Default Session' }];
        }

        // Find course and extract sessions
        const courseData = studyLibraryData.find(
            (item: unknown) => (item as { course?: { id: string } })?.course?.id === courseId
        );

        console.log('🔍 Course data found:', {
            found: !!courseData,
            courseId,
            courseData: courseData ? JSON.stringify(courseData, null, 2) : 'null',
        });

        if (!courseData) {
            console.warn('⚠️ Course not found in study library data, using default session');
            return [{ id: 'DEFAULT', name: 'Default Session' }];
        }

        const courseTyped = courseData as { sessions?: unknown[] };
        console.log('🔍 Sessions in course data:', {
            hasSessions: !!courseTyped.sessions,
            isArray: Array.isArray(courseTyped.sessions),
            sessionsCount: Array.isArray(courseTyped.sessions) ? courseTyped.sessions.length : 0,
        });

        // Log each session separately for better readability
        if (Array.isArray(courseTyped.sessions)) {
            courseTyped.sessions.forEach((session, index) => {
                console.log(`🔍 Session ${index + 1}:`, JSON.stringify(session, null, 2));

                // Check if this session has subjects
                const sessionData = session as any;

                // Check both session_dto.subjects and level_with_details.subjects
                let subjects: any[] = [];

                if (
                    sessionData.session_dto?.subjects &&
                    Array.isArray(sessionData.session_dto.subjects)
                ) {
                    subjects = sessionData.session_dto.subjects;
                    console.log(`🔍 Found ${subjects.length} subjects in session_dto.subjects`);
                } else if (
                    sessionData.level_with_details &&
                    Array.isArray(sessionData.level_with_details)
                ) {
                    // Extract subjects from level_with_details
                    subjects = sessionData.level_with_details.flatMap((level: any) =>
                        level.subjects && Array.isArray(level.subjects) ? level.subjects : []
                    );
                    console.log(`🔍 Found ${subjects.length} subjects in level_with_details`);
                }

                if (subjects.length > 0) {
                    console.log(
                        `🔍 Session ${index + 1} has ${subjects.length} subjects:`,
                        subjects.map((s: any) => ({
                            id: s.id,
                            name: s.subject_name || s.name,
                        }))
                    );

                    // Check if this session contains the subject we're looking for
                    const hasTargetSubject = subjects.some((s: any) => s.id === subjectId);
                    if (hasTargetSubject) {
                        console.log(`🎯 Session ${index + 1} contains the target subject!`, {
                            sessionId: sessionData.session_dto?.id,
                            sessionName: sessionData.session_dto?.session_name,
                            targetSubjectId: subjectId,
                        });
                    }
                }
            });
        }

        if (!courseTyped.sessions || !Array.isArray(courseTyped.sessions)) {
            console.warn('⚠️ No sessions found in course data, using default session');
            return [{ id: 'DEFAULT', name: 'Default Session' }];
        }

        // Map sessions to PackageSession format
        const sessions = courseTyped.sessions.map((session: unknown) => {
            const s = session as {
                session_id?: string;
                id?: string;
                session_name?: string;
                name?: string;
            };

            console.log('🔍 Mapping session:', {
                originalSession: JSON.stringify(session, null, 2),
                extractedFields: {
                    session_id: s.session_id,
                    id: s.id,
                    session_name: s.session_name,
                    name: s.name,
                },
            });

            const mappedSession = {
                id: s.session_id || s.id || 'DEFAULT',
                name:
                    s.session_name ||
                    s.name ||
                    `Session ${(s.session_id || s.id || 'DEFAULT').slice(0, 8)}`,
            };

            console.log('🔍 Mapped to:', mappedSession);
            return mappedSession;
        });

        console.log('✅ Found package sessions:', sessions);
        return sessions.length > 0 ? sessions : [{ id: 'DEFAULT', name: 'Default Session' }];
    } catch (error) {
        console.error('Error fetching package sessions:', error);
        console.log('🔄 Using fallback default session');
        return [{ id: 'DEFAULT', name: 'Default Session' }];
    }
};
