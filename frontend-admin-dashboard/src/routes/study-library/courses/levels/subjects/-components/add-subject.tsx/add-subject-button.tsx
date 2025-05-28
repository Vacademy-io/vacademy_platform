import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useState } from 'react';
import { AddSubjectForm } from './add-subject-form';
import { SubjectType } from '@/stores/study-library/use-study-library-store';
import { Plus } from 'phosphor-react';

interface AddSubjectButtonProps {
    onAddSubject: (subject: SubjectType) => void;
    isTextButton?: boolean;
}

export const AddSubjectButton = ({ onAddSubject, isTextButton = false }: AddSubjectButtonProps) => {
    const [openDialog, setOpenDialog] = useState(false);
    const triggerButton = isTextButton ? (
        <MyButton
            scale="large"
            buttonType="text"
            className="!m-0 flex w-fit cursor-pointer flex-row items-center justify-start gap-2 px-0 pl-2 text-primary-500"
            id="add-chapters"
        >
            <Plus /> Add Subject
        </MyButton>
    ) : (
        <MyButton buttonType="primary" layoutVariant="default" scale="large" id="add-subject">
            Add Subject
        </MyButton>
    );

    const handleOpenChange = () => {
        setOpenDialog(!openDialog);
    };

    return (
        <MyDialog
            trigger={triggerButton}
            heading="Add Subject"
            dialogWidth="w-[400px]"
            open={openDialog}
            onOpenChange={handleOpenChange}
        >
            <AddSubjectForm
                onSubmitSuccess={(subject) => {
                    onAddSubject(subject);
                    handleOpenChange();
                }}
            />
        </MyDialog>
    );
};
