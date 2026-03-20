import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { ReactNode, useRef, useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { AddCourseDetailsForm, AddLevelData } from './add-course-details-form';

const triggerButton = (
    <MyButton buttonType="primary" scale="large" layoutVariant="default" id="assign-year">
        <Plus /> Add Level
    </MyButton>
);

interface AddLevelButtonProps {
    onSubmit: ({
        requestData,
        packageId,
        sessionId,
    }: {
        requestData: AddLevelData;
        packageId?: string;
        sessionId?: string;
        levelId?: string;
    }) => void;
    trigger?: ReactNode;
    packageId?: string;
}

export const AddCourseDetailsButton = ({ onSubmit, trigger, packageId }: AddLevelButtonProps) => {
    const [openDialog, setOpenDialog] = useState(false);

    const handleOpenChange = () => {
        setOpenDialog(!openDialog);
    };

    const formSubmitRef = useRef(() => {});

    const levelSubmitButton = (
        <div className="flex w-full items-center justify-center">
            <MyButton
                type="button"
                buttonType="primary"
                layoutVariant="default"
                scale="large"
                onClick={() => formSubmitRef.current()}
            >
                Add
            </MyButton>
        </div>
    );

    const submitFormFn = (submitFn: () => void) => {
        formSubmitRef.current = submitFn;
    };

    return (
        <MyDialog
            trigger={trigger ? trigger : triggerButton}
            heading="Add Level"
            dialogWidth="w-[430px]"
            open={openDialog}
            onOpenChange={handleOpenChange}
            footer={levelSubmitButton}
            className="z-[99999]"
        >
            {packageId ? (
                <AddCourseDetailsForm
                    onSubmitSuccess={onSubmit}
                    setOpenDialog={setOpenDialog}
                    submitForm={submitFormFn}
                    packageId={packageId}
                />
            ) : (
                <AddCourseDetailsForm
                    onSubmitSuccess={onSubmit}
                    setOpenDialog={setOpenDialog}
                    submitForm={submitFormFn}
                />
            )}
        </MyDialog>
    );
};
