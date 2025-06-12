import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider';
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider';
import { ModuleMaterial } from '@/routes/study-library/courses/levels/subjects/modules/-components/module-material';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { CaretLeft } from 'phosphor-react';
import { getSubjectName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getSubjectNameById';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubjectType } from '@/stores/study-library/use-study-library-store';
import { getSubjectsByLevelAndSession } from '@/utils/courseUtils';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';

interface SubjectSearchParams {
    courseId: string;
    levelId: string;
    subjectId: string;
    sessionId: string;
}

export const Route = createFileRoute('/study-library/courses/levels/subjects/modules/')({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): SubjectSearchParams => {
        return {
            courseId: search.courseId as string,
            levelId: search.levelId as string,
            subjectId: search.subjectId as string,
            sessionId: search.sessionId as string,
        };
    },
});

function RouteComponent() {
    const queryClient = useQueryClient(); // Get the queryClient instance

    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const { courseId, levelId, subjectId, sessionId } = Route.useSearch();
    const subjectName = getSubjectName(subjectId);

    // Function to invalidate the modules with chapters query
    const invalidateModulesQuery = () => {
        queryClient.invalidateQueries({
            queryKey: ['GET_MODULES_WITH_CHAPTERS', subjectId],
        });
    };

    const handleBackClick = () => {
        navigate({
            to: '/study-library/courses/levels/subjects',
            search: { courseId, levelId },
        });
    };

    const heading = (
        <div className="flex items-center gap-4">
            <CaretLeft onClick={handleBackClick} className="cursor-pointer" />
            <div>{`${subjectName} Modules`}</div>
        </div>
    );

    // Ensure dependencies are complete
    useEffect(() => {
        setNavHeading(heading);
        invalidateModulesQuery();
    }, []);

    const [subjects, setSubjects] = useState<SubjectType[]>([]);

    const { studyLibraryData } = useStudyLibraryStore();

    useEffect(() => {
        const subjects = getSubjectsByLevelAndSession(studyLibraryData, levelId, sessionId);
        setSubjects(subjects);
    }, [levelId, sessionId, studyLibraryData]);

    return (
        <LayoutContainer
            internalSideBar
            sideBarList={subjects.map((subject) => {
                return {
                    value: subject.subject_name,
                    id: subject.id,
                };
            })}
            sideBarData={{ title: 'Subjects', listIconText: 'S', searchParam: 'subjectId' }}
        >
            <InitStudyLibraryProvider>
                <ModulesWithChaptersProvider>
                    <ModuleMaterial />
                </ModulesWithChaptersProvider>
            </InitStudyLibraryProvider>
        </LayoutContainer>
    );
}
