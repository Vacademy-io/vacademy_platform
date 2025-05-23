import { MyDialog } from "@/components/design-system/dialog";
import { MyButton } from "@/components/design-system/button";
import { FileDoc } from "@phosphor-icons/react";
import { useState } from "react";
import { CreateStudyDocForm } from "./create-study-doc-form";

const triggerButton = (
    <MyButton
        buttonType="secondary"
        scale="large"
        layoutVariant="default"
        className="flex items-center gap-2"
    >
        <span>
            <FileDoc />
        </span>
        <p>Create Study Doc</p>
    </MyButton>
);

export const CreateStudyDocButton = () => {
    const [openDialog, setOpenDialog] = useState(false);

    const handleOpenChange = () => {
        setOpenDialog(!openDialog);
    };

    return (
        <MyDialog
            trigger={triggerButton}
            heading="Create Study Doc"
            dialogWidth="min-w-[400px]"
            open={openDialog}
            onOpenChange={handleOpenChange}
        >
            <CreateStudyDocForm />
        </MyDialog>
    );
};
