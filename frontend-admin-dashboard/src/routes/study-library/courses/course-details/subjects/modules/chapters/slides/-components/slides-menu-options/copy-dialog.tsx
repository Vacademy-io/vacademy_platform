import { useRouter } from '@tanstack/react-router';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { StudyMaterialDetailsForm } from '@/routes/study-library/courses/-components/upload-study-material/study-material-details-form';
import { MyDialog } from '@/components/design-system/dialog';
import { Dispatch, SetStateAction } from 'react';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { useCopySlide } from '../../-services/copySlides';
import { toast } from 'sonner';

interface CopyTo {
    openDialog: 'copy' | 'move' | 'delete' | 'drip-conditions' | null;
    setOpenDialog: Dispatch<SetStateAction<'copy' | 'move' | 'delete' | 'drip-conditions' | null>>;
}

export const CopyToDialog = ({ openDialog, setOpenDialog }: CopyTo) => {
    const router = useRouter();
    const { chapterId, courseId, levelId, subjectId, moduleId, sessionId } =
        router.state.location.search;
    const { activeItem } = useContentStore();
    const copySlideMutation = useCopySlide();
    const { getPackageSessionId } = useInstituteDetailsStore();

    const handleCopySlide = async (data: {
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
            await copySlideMutation.mutateAsync({
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
            toast.success('Slide copied successfully!');
            setOpenDialog(null);
        } catch {
            toast.error('Failed to copy slide');
        }
    };

    return (
        <MyDialog
            heading="Copy to"
            dialogWidth="w-[400px]"
            open={openDialog == 'copy'}
            onOpenChange={() => setOpenDialog(null)}
        >
            <StudyMaterialDetailsForm
                fields={['course', 'session', 'level', 'subject', 'module', 'chapter']}
                onFormSubmit={handleCopySlide}
                submitButtonName="Copy"
            />
        </MyDialog>
    );
};
