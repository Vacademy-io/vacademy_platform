import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';

/**
 * Hook to get packageSessionId from the course-init API response.
 * This uses the package_sessions array from the course-init response
 * which maps level + session to a packageSessionId.
 *
 * Falls back to empty string if not found.
 */
export const useGetPackageSessionIdFromCourseInit = (
    courseId: string,
    sessionId: string,
    levelId: string
): string => {
    const { getPackageSessionId } = useStudyLibraryStore();

    if (!courseId || !sessionId || !levelId) {
        return '';
    }

    return getPackageSessionId({ courseId, sessionId, levelId }) || '';
};
