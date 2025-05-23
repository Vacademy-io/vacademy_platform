import { StudyMaterialDetailsForm } from '@/routes/study-library/courses/-components/upload-study-material/study-material-details-form';
import { MyDialog } from '@/components/design-system/dialog';
import { Dispatch, SetStateAction } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { useMoveSlide } from '../../-services/moveSlides';
import { toast } from 'sonner';

interface MoveTo {
    openDialog: 'copy' | 'move' | 'delete' | null;
    setOpenDialog: Dispatch<SetStateAction<'copy' | 'move' | 'delete' | null>>;
}

export const MoveToDialog = ({ openDialog, setOpenDialog }: MoveTo) => {
    const router = useRouter();
    const { chapterId } = router.state.location.search;
    const { activeItem } = useContentStore();
    const moveSlideMutation = useMoveSlide();

    const handleMoveSlide = async (data: {
        [x: string]: { id: string; name: string } | undefined;
    }) => {
        const slideId = activeItem?.id || '';
        const oldChapterId = chapterId || '';
        const newChapterId = data['chapter']?.id || '';
        try {
            await moveSlideMutation.mutateAsync({
                slideId: slideId,
                oldChapterId: oldChapterId,
                newChapterId: newChapterId,
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
