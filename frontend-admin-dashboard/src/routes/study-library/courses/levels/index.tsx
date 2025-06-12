// routes/study-library/$class/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider';
import { LevelPage } from '@/routes/study-library/courses/levels/-components/level-page';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useNavigate } from '@tanstack/react-router';
import { CaretLeft } from 'phosphor-react';
import { useEffect, useState } from 'react';
import {
    StudyLibrarySessionType,
    useStudyLibraryStore,
} from '@/stores/study-library/use-study-library-store';
import { getCourseSessions } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getSessionsForLevels';
import { getCourseNameById } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getCourseNameById';
import { getCourseLevels } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getLevelWithDetails';
import { getCourses } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getCourses';

interface CourseSearchParams {
    courseId: string;
}

export const Route = createFileRoute('/study-library/courses/levels/')({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
        return {
            courseId: search.courseId as string,
        };
    },
});

function RouteComponent() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const { courseId } = Route.useSearch();

    const sessionList = courseId ? getCourseSessions(courseId) : [];
    const initialSession: StudyLibrarySessionType | undefined = sessionList[0] ?? undefined;

    const { studyLibraryData } = useStudyLibraryStore();

    // Get levels only if session is selected
    const initialLevelList = initialSession ? getCourseLevels(courseId!, initialSession.id) : [];

    const [levelList, setLevelList] = useState(initialLevelList);

    const courseName = getCourseNameById(courseId);

    const [courses, setCourses] = useState(getCourses());

    useEffect(() => {
        const newLevelList = initialSession ? getCourseLevels(courseId!, initialSession.id) : [];
        setLevelList(newLevelList);
        setCourses(getCourses());
    }, [studyLibraryData]);

    if (levelList[0]?.id == 'DEFAULT') {
        navigate({
            to: `/study-library/courses/levels/subjects`,
            search: {
                courseId: courseId,
                levelId: 'DEFAULT',
            },
        });
    }

    const handleBackClick = () => {
        navigate({
            to: `/study-library/courses`,
        });
    };

    const heading = (
        <div className="flex items-center gap-4">
            <CaretLeft onClick={handleBackClick} className="cursor-pointer" />
            <div>{courseName} Levels</div>
        </div>
    );

    useEffect(() => {
        setNavHeading(heading);
    }, []);

    return (
        <LayoutContainer
            internalSideBar
            sideBarList={courses.map((course) => {
                return {
                    value: course.package_name,
                    id: course.id,
                };
            })}
            sideBarData={{ title: 'Courses', listIconText: 'C', searchParam: 'courseId' }}
        >
            <InitStudyLibraryProvider>
                <LevelPage />
            </InitStudyLibraryProvider>
        </LayoutContainer>
    );
}
