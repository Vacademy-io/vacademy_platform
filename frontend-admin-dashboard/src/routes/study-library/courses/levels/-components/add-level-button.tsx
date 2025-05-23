import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { ReactNode, useRef, useState } from "react";
import { Plus } from "phosphor-react";
import { AddLevelData, AddLevelForm } from "./add-level-form";

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

export const AddLevelButton = ({ onSubmit, trigger, packageId }: AddLevelButtonProps) => {
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
            {packageId ?
                <AddLevelForm
                    onSubmitSuccess={onSubmit}
                    setOpenDialog={setOpenDialog}
                    submitForm={submitFormFn}
                    packageId={packageId}
                />
                :
                <AddLevelForm
                    onSubmitSuccess={onSubmit}
                    setOpenDialog={setOpenDialog}
                    submitForm={submitFormFn}
                />
            }
        </MyDialog>
    );
};
