import { StudyMaterialDetailsForm } from '@/routes/study-library/courses/-components/upload-study-material/study-material-details-form';
import { MyDialog } from '@/components/design-system/dialog';
import { Dispatch, SetStateAction } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { useMoveSlide } from '../../-services/moveSlides';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { toast } from 'sonner';

interface MoveTo {
    openDialog: 'copy' | 'move' | 'delete' | 'drip-conditions' | null;
    setOpenDialog: Dispatch<SetStateAction<'copy' | 'move' | 'delete' | 'drip-conditions' | null>>;
}

export const MoveToDialog = ({ openDialog, setOpenDialog }: MoveTo) => {
    const router = useRouter();
    const { chapterId, courseId, levelId, subjectId, moduleId, sessionId } =
        router.state.location.search;
    const { activeItem } = useContentStore();
    const moveSlideMutation = useMoveSlide();
    const { getPackageSessionId } = useInstituteDetailsStore();

    const handleMoveSlide = async (data: {
        [x: string]: { id: string; name: string } | undefined;
    }) => {
        const slideId = activeItem?.id || '';
        // Old values from route/search params
        const oldChapterId = chapterId || '';
        const oldModuleId = moduleId || '';
        const oldSubjectId = subjectId || '';
        const oldPackageSessionId =
            getPackageSessionId({
                courseId: courseId || '',
                sessionId: sessionId || '',
                levelId: levelId || '',
            }) || '';
        // New values from form data
        const newChapterId = data['chapter']?.id || '';
        const newModuleId = data['module']?.id || '';
        const newSubjectId = data['subject']?.id || '';
        const newCourseId = data['course']?.id || '';
        const newSessionId = data['session']?.id || '';
        const newLevelId = data['level']?.id || '';
        const newPackageSessionId =
            getPackageSessionId({
                courseId: newCourseId,
                sessionId: newSessionId,
                levelId: newLevelId,
            }) || '';
        try {
            await moveSlideMutation.mutateAsync({
                slideId,
                oldChapterId,
                oldModuleId,
                oldSubjectId,
                oldPackageSessionId,
                newChapterId,
                newModuleId,
                newSubjectId,
                newPackageSessionId,
            });
            toast.success('Slide moved successfully');
            setOpenDialog(null);
        } catch {
            toast.error('Failed to move the slide');
        }
    };

    return (
        <MyDialog
            heading="Move to"
            dialogWidth="w-[400px]"
            open={openDialog == 'move'}
            onOpenChange={() => setOpenDialog(null)}
        >
            <StudyMaterialDetailsForm
                fields={['course', 'session', 'level', 'subject', 'module', 'chapter']}
                onFormSubmit={handleMoveSlide}
                submitButtonName="Move"
            />
        </MyDialog>
    );
};
