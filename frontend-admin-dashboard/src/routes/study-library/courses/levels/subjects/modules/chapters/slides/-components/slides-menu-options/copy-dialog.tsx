import { StudyMaterialDetailsForm } from '@/routes/study-library/courses/-components/upload-study-material/study-material-details-form';
import { MyDialog } from '@/components/design-system/dialog';
import { Dispatch, SetStateAction } from 'react';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { useCopySlide } from '../../-services/copySlides';
import { toast } from 'sonner';

interface CopyTo {
    openDialog: 'copy' | 'move' | 'delete' | null;
    setOpenDialog: Dispatch<SetStateAction<'copy' | 'move' | 'delete' | null>>;
}

export const CopyToDialog = ({ openDialog, setOpenDialog }: CopyTo) => {
    const { activeItem } = useContentStore();
    const copySlideMutation = useCopySlide();

    const handleCopySlide = async (data: {
        [x: string]: { id: string; name: string } | undefined;
    }) => {
        const slideId = activeItem?.id || '';
        const newChapterId = data['chapter']?.id || '';

        try {
            await copySlideMutation.mutateAsync({ slideId: slideId, newChapterId: newChapterId });
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
