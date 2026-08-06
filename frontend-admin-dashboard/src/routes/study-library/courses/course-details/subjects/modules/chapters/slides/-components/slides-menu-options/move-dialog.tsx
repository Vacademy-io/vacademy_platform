import { MyDialog } from '@/components/design-system/dialog';
import {
    CopyMoveDestinationPicker,
    type CopyMoveDestination,
    type CopyMovePlacement,
} from '@/components/common/study-library/copy-move/copy-move-destination-picker';
import { Dispatch, SetStateAction, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useContentStore } from '../../-stores/chapter-sidebar-store';
import { useMoveSlide } from '../../-services/moveSlides';
import { useCopySlide } from '../../-services/copySlides';
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
    const copySlideMutation = useCopySlide();
    const { getPackageSessionId } = useInstituteDetailsStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleMoveSlide = async (
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

        // A move has exactly one origin, so with several destinations the extra
        // ones get a copy — the slide is then removed from its current chapter by
        // moving it into the last destination. Copies run first, while the source
        // slide still lives where it is.
        const [moveTarget, ...copyTargets] = [...destinations].reverse();
        if (!moveTarget) return;

        setIsSubmitting(true);
        const failed: CopyMoveDestination[] = [];
        for (const destination of copyTargets) {
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

        let moved = false;
        try {
            await moveSlideMutation.mutateAsync({
                ...source,
                newChapterId: moveTarget.chapterId,
                newModuleId: moveTarget.moduleId,
                newSubjectId: moveTarget.subjectId,
                newPackageSessionId: moveTarget.packageSessionId,
                slideStatus: placement.slideStatus,
                position: placement.position,
            });
            moved = true;
        } catch {
            failed.push(moveTarget);
        }
        setIsSubmitting(false);

        const done = destinations.length - failed.length;
        if (failed.length === 0) {
            toast.success(
                destinations.length === 1
                    ? 'Slide moved successfully'
                    : `Slide moved, with copies in ${destinations.length - 1} more ${
                          destinations.length === 2 ? 'location' : 'locations'
                      }`
            );
            setOpenDialog(null);
            return;
        }
        if (moved) {
            // The slide has left its original chapter, so this dialog's source is
            // stale — close instead of offering a retry that would move it again.
            toast.warning(
                `Slide moved, but ${failed.length} ${
                    failed.length === 1 ? 'copy' : 'copies'
                } failed: ${failed.map((d) => d.label).join(', ')}`
            );
            setOpenDialog(null);
            return;
        }
        // Nothing moved — the slide is still in its chapter, so retrying the
        // failed destinations from here is safe.
        if (done === 0) {
            toast.error('Failed to move the slide');
        } else {
            toast.warning(`${done} of ${destinations.length} locations done. Retry the rest below.`);
        }
        return failed;
    };

    return (
        <MyDialog
            heading="Move to"
            dialogWidth="max-w-2xl"
            open={openDialog == 'move'}
            onOpenChange={() => setOpenDialog(null)}
        >
            <CopyMoveDestinationPicker
                leaf="chapter"
                showPlacementOptions
                submitLabel="Move"
                busyLabel="Moving…"
                isSubmitting={isSubmitting}
                onSubmit={handleMoveSlide}
                multiHint="A slide lives in one place: the extra locations get a copy, and the slide is removed from its current chapter."
            />
        </MyDialog>
    );
};
