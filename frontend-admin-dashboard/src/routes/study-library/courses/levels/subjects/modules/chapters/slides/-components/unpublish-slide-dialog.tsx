// publish-dialog.tsx
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useContentStore } from '@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-stores/chapter-sidebar-store';
import { Dispatch, SetStateAction } from 'react';

interface UnpublishDialogProps {
    isOpen: boolean;
    setIsOpen: Dispatch<SetStateAction<boolean>>;
    handlePublishUnpublishSlide: (
        setIsOpen: Dispatch<SetStateAction<boolean>>,
        notify: boolean
    ) => void;
}

export const UnpublishDialog = ({
    isOpen,
    setIsOpen,
    handlePublishUnpublishSlide,
}: UnpublishDialogProps) => {
    const { activeItem } = useContentStore();
    const unpublishTrigger = (
        <MyButton
            buttonType="secondary"
            scale="medium"
            layoutVariant="default"
            disable={activeItem?.status == 'DRAFT'}
        >
            Unpublish
        </MyButton>
    );

    return (
        <MyDialog
            heading={`Unpublish Slide`}
            dialogWidth="w-[400px]"
            open={isOpen}
            onOpenChange={setIsOpen}
            trigger={unpublishTrigger}
        >
            <div className="flex w-full flex-col gap-6">
                <p>Are you sure you want to unpublish publish this slide? </p>
                <div className="flex justify-end gap-4">
                    <MyButton buttonType="secondary" onClick={() => setIsOpen(false)}>
                        Cancel
                    </MyButton>

                    <MyButton
                        buttonType="primary"
                        onClick={() => handlePublishUnpublishSlide(setIsOpen, false)}
                    >
                        Yes, I&apos;m sure
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
};
