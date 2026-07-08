// unpublish-dialog.tsx
import { MyButton } from '@/components/design-system/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Dispatch, ReactNode, SetStateAction } from 'react';

interface UnpublishDialogProps {
    isOpen: boolean;
    setIsOpen: Dispatch<SetStateAction<boolean>>;
    handlePublishUnpublishSlide: (
        setIsOpen: Dispatch<SetStateAction<boolean>>,
        notify: boolean
    ) => void;
    /** The button the confirm popover anchors to (rendered by the caller so it
        keeps its exact styling / responsive labels). */
    trigger?: ReactNode;
}

export const UnpublishDialog = ({
    isOpen,
    setIsOpen,
    handlePublishUnpublishSlide,
    trigger,
}: UnpublishDialogProps) => {
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            {trigger && <PopoverAnchor asChild>{trigger}</PopoverAnchor>}
            <PopoverContent align="end" sideOffset={8} className="w-72 p-4">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <p className="text-subtitle font-semibold text-neutral-700">
                            Unpublish this slide?
                        </p>
                        <p className="text-caption text-neutral-500">
                            Learners will no longer be able to see it.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            className="min-w-0 sm:min-w-0"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            className="min-w-0 sm:min-w-0"
                            onClick={() => handlePublishUnpublishSlide(setIsOpen, false)}
                        >
                            Unpublish
                        </MyButton>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
