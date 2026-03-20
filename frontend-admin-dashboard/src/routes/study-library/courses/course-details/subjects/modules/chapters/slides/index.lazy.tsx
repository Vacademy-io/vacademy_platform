import { createLazyFileRoute, useSearch } from '@tanstack/react-router';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { AdminSlidesView } from './admin/AdminSlidesView';
import { NonAdminSlidesView } from './non-admin/NonAdminSlidesView';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { useMemo } from 'react';
import { QuickAddView, type ChapterSearchParamsForQuickAdd } from './quick-add';

interface ChapterSearchParams {
    courseId: string;
    levelId: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
    sessionId: string;
    timestamp?: number;
    currentPage?: number;
    quickAdd?: boolean;
}

export const Route = createLazyFileRoute(
    '/study-library/courses/course-details/subjects/modules/chapters/slides/'
)({
    component: RouteComponent,
});

function RouteComponent(): JSX.Element {
    const searchParams = useSearch({
        from: '/study-library/courses/course-details/subjects/modules/chapters/slides/',
    }) as ChapterSearchParams;
    const { courseId } = searchParams;
    const { studyLibraryData } = useStudyLibraryStore();

    // Get user role and institute ID
    const { userRole } = useMemo(() => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const tokenData = getTokenDecodedData(accessToken);

        if (!tokenData || !tokenData.authorities) {
            return { userRole: null };
        }

        // Find the institute from studyLibraryData to get the correct institute ID
        const courseData = studyLibraryData?.find((item) => item.course.id === courseId);
        const currentInstituteId =
            courseData?.course?.institute_id || Object.keys(tokenData.authorities)[0]; // fallback to first institute

        if (!currentInstituteId || !tokenData.authorities[currentInstituteId]) {
            return { userRole: null };
        }

        const roles = tokenData.authorities[currentInstituteId]?.roles || [];
        const isAdmin = roles.includes('ADMIN');

        return {
            userRole: isAdmin ? 'ADMIN' : 'TEACHER',
        };
    }, [courseId, studyLibraryData]);

    if (searchParams.quickAdd) {
        return <QuickAddView search={searchParams as unknown as ChapterSearchParamsForQuickAdd} />;
    }

    return userRole === 'ADMIN' ? (
        <AdminSlidesView {...searchParams} />
    ) : (
        <NonAdminSlidesView {...searchParams} />
    );
}
