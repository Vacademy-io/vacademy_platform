import { ReactNode } from "react";
import { MyDialog } from "@/components/design-system/dialog";
import { MyButton } from "@/components/design-system/button";
import { useSubmissionsBulkActionsDialogStorePending } from "../bulk-actions-zustand-store/useSubmissionsBulkActionsDialogStorePending";

interface ProvideDialogDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const RemoveParticipantsDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } =
        useSubmissionsBulkActionsDialogStorePending();

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
                Are you sure you want to remove participants for&nbsp;
                <span className="text-primary-500">{displayText}</span>&nbsp;?
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

export const RemoveParticipantsDialog = ({
    trigger,
    open,
    onOpenChange,
}: ProvideDialogDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Remove Participants"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<RemoveParticipantsDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
