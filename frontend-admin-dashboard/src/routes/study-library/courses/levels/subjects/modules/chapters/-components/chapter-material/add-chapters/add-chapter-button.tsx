import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import { AddChapterForm } from './add-chapter-form';

interface AddChapterButtonProps {
    isTextButton?: boolean;
    moduleId?: string;
    sessionId?: string;
}

export const AddChapterButton = ({
    isTextButton = false,
    moduleId,
    sessionId,
}: AddChapterButtonProps) => {
    const [openDialog, setOpenDialog] = useState(false);
    const triggerButton = isTextButton ? (
        // <div className="m-0 flex w-fit cursor-pointer flex-row items-center gap-2 text-primary-500">
        //     <Plus /> Add Chapter
        // </div>
        <MyButton
            scale="large"
            buttonType="text"
            className="!m-0 flex w-fit cursor-pointer flex-row items-center justify-start gap-2 px-0 pl-2 text-primary-500"
            id="add-chapters"
        >
            <Plus /> Add Chapter
        </MyButton>
    ) : (
        <MyButton scale="large" id="add-chapters">
            <Plus /> Add Chapter
        </MyButton>
    );

    const handleOpenChange = () => {
        setOpenDialog(!openDialog);
    };

    const handleSubmitSuccess = () => {
        handleOpenChange();
    };

    return (
        <MyDialog
            trigger={triggerButton}
            heading="Add Chapter"
            dialogWidth="min-w-[800px]"
            open={openDialog}
            onOpenChange={handleOpenChange}
        >
            <AddChapterForm
                module_id={moduleId}
                session_id={sessionId}
                onSubmitSuccess={handleSubmitSuccess}
                mode="create"
            />
        </MyDialog>
    );
};
