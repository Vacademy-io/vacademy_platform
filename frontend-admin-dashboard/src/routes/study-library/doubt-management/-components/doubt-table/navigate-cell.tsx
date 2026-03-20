import { Doubt } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useRouter } from '@tanstack/react-router';
import { ArrowSquareOut } from '@phosphor-icons/react';

export const NavigateCell = ({ doubt }: { doubt: Doubt }) => {
    const router = useRouter();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const handleNavigate = () => {
        const batch = getDetailsFromPackageSessionId({ packageSessionId: doubt?.batch_id || '' });
        const courseId = batch?.package_dto.id;
        const levelId = batch?.level.id;
        const sessionId = batch?.session.id;
        router.navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: {
                courseId: courseId || '',
                levelId: levelId || '',
                subjectId: doubt.subject_id,
                moduleId: doubt.module_id,
                chapterId: doubt.chapter_id,
                slideId: doubt.source_id,
                sessionId: sessionId || '',
                ...(doubt.content_type === 'VIDEO'
                    ? { timestamp: Number(doubt.content_position) / 1000 }
                    : {}),
                ...(doubt.content_type === 'PDF'
                    ? { currentPage: Number(doubt.content_position) }
                    : {}),
            },
            hash: '',
        });
    };

    return (
        <div className="flex w-full items-center justify-center">
            <ArrowSquareOut
                size={20}
                weight="regular"
                className="cursor-pointer text-primary-400 transition-colors hover:text-primary-500"
                onClick={handleNavigate}
            />
        </div>
    );
};
