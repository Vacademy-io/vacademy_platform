import { ReactNode } from "react";
import { MyDialog } from "@/components/design-system/dialog";
import { MyButton } from "@/components/design-system/button";
import { useSubmissionsBulkActionsDialogStoreAttempted } from "../bulk-actions-zustand-store/useSubmissionsBulkActionsDialogStoreAttempted";

interface ProvideDialogDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ProvideReattemptDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } =
        useSubmissionsBulkActionsDialogStoreAttempted();

    const displayText = isBulkAction ? bulkActionInfo?.displayText : selectedStudent?.student_name;

    const handleSubmit = () => {
        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            console.log("bulk actions");
        } else if (selectedStudent) {
            console.log("individual student");
        }
        closeAllDialogs();
    };

    return (
        <div className="flex flex-col gap-6 px-4 pb-2 text-neutral-600">
            <h1>
                Are you sure you want to provide reattempt to selected&nbsp;
                <span className="text-primary-500">{displayText}</span>?
            </h1>
            <MyButton
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                onClick={handleSubmit}
            >
                Done
            </MyButton>
        </div>
    );
};

export const ProvideReattemptDialog = ({
    trigger,
    open,
    onOpenChange,
}: ProvideDialogDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Provide Reattempt"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<ProvideReattemptDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
