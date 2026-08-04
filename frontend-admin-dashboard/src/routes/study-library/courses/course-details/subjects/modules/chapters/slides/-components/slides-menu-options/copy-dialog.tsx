import { useRouter } from '@tanstack/react-router';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { MyDialog } from '@/components/design-system/dialog';
import {
    CopyMoveDestinationPicker,
    type CopyMoveDestination,
    type CopyMovePlacement,
} from '@/components/common/study-library/copy-move/copy-move-destination-picker';
import { Dispatch, SetStateAction, useState } from 'react';
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCopySlide = async (
        destinations: CopyMoveDestination[],
        placement: CopyMovePlacement
    ) => {
        const slideId = activeItem?.id || '';
        const source = {
            slideId,
            oldChapterId: chapterId || '',
            oldModuleId: moduleId || '',
            oldSubjectId: subjectId || '',
            oldPackageSessionId:
                getPackageSessionId({
                    courseId: courseId || '',
                    sessionId: sessionId || '',
                    levelId: levelId || '',
                }) || '',
        };

        setIsSubmitting(true);
        const failed: CopyMoveDestination[] = [];
        // Sequential: the backend re-orders slides in the target chapter, so
        // parallel copies of the same slide can race on slide_order.
        for (const destination of destinations) {
            try {
                await copySlideMutation.mutateAsync({
                    ...source,
                    newChapterId: destination.chapterId,
                    newModuleId: destination.moduleId,
                    newSubjectId: destination.subjectId,
                    newPackageSessionId: destination.packageSessionId,
                    slideStatus: placement.slideStatus,
                    position: placement.position,
                });
            } catch {
                failed.push(destination);
            }
        }
        setIsSubmitting(false);

        const succeeded = destinations.length - failed.length;
        if (failed.length === 0) {
            toast.success(
                succeeded === 1
                    ? 'Slide copied successfully!'
                    : `Slide copied to ${succeeded} locations`
            );
            setOpenDialog(null);
            return;
        }
        if (succeeded === 0) {
            toast.error('Failed to copy slide');
        } else {
            toast.warning(
                `Copied to ${succeeded} of ${destinations.length} locations. Retry the rest below.`
            );
        }
        // The source is untouched, so retrying just these is safe.
        return failed;
    };

    return (
        <MyDialog
            heading="Copy to"
            dialogWidth="max-w-2xl"
            open={openDialog == 'copy'}
            onOpenChange={() => setOpenDialog(null)}
        >
            <CopyMoveDestinationPicker
                leaf="chapter"
                showPlacementOptions
                submitLabel="Copy"
                busyLabel="Copying…"
                isSubmitting={isSubmitting}
                onSubmit={handleCopySlide}
            />
        </MyDialog>
    );
};
