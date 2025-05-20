import { ReactNode, useState } from "react";
import { MyDialog } from "@/components/design-system/dialog";
import { MyButton } from "@/components/design-system/button";
import { useSubmissionsBulkActionsDialogStoreOngoing } from "../bulk-actions-zustand-store/useSubmissionsBulkActionsDialogStoreOngoing";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { timeLimit } from "@/constants/dummy-data";

interface ProvideDialogDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    durationDistribution: string;
}

const IncreaseAssessmentTimeDialogContent = ({
    durationDistribution,
}: {
    durationDistribution: string;
}) => {
    const [selectedSection, setSelectedSection] = useState<string>(timeLimit[0] as string);
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } =
        useSubmissionsBulkActionsDialogStoreOngoing();

    const handleSubmit = () => {
        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            console.log("bulk actions");
        } else if (selectedStudent) {
            console.log("individual student");
        }
        closeAllDialogs();
    };

    return (
        <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto text-neutral-600">
            {durationDistribution === "ASSESSMENT" && (
                <div className="flex flex-col gap-2 p-4">
                    <h1>Entire Assessment</h1>
                    <h3>Increase By</h3>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeLimit.map((section, idx) => (
                                <SelectItem key={idx} value={section}>
                                    {section}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="mt-4 flex justify-center">
                        <MyButton
                            buttonType="primary"
                            scale="large"
                            layoutVariant="default"
                            onClick={handleSubmit}
                        >
                            Done
                        </MyButton>
                    </div>
                </div>
            )}
            {durationDistribution === "SECTION" && (
                <div className="flex flex-col gap-2 p-4">
                    <h1>Section 1</h1>
                    <h3>Increase By</h3>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeLimit.map((section, idx) => (
                                <SelectItem key={idx} value={section}>
                                    {section}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <h1>Section 2</h1>
                    <h3>Increase By</h3>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeLimit.map((section, idx) => (
                                <SelectItem key={idx} value={section}>
                                    {section}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="mt-4 flex justify-center">
                        <MyButton
                            buttonType="primary"
                            scale="large"
                            layoutVariant="default"
                            onClick={handleSubmit}
                        >
                            Done
                        </MyButton>
                    </div>
                </div>
            )}
            {durationDistribution === "QUESTION" && (
                <div className="flex flex-col gap-2 p-4">
                    <h1>Question 1</h1>
                    <h3>Increase By</h3>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeLimit.map((section, idx) => (
                                <SelectItem key={idx} value={section}>
                                    {section}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <h1>Question 2</h1>
                    <h3>Increase By</h3>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeLimit.map((section, idx) => (
                                <SelectItem key={idx} value={section}>
                                    {section}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="mt-4 flex justify-center">
                        <MyButton
                            buttonType="primary"
                            scale="large"
                            layoutVariant="default"
                            onClick={handleSubmit}
                        >
                            Done
                        </MyButton>
                    </div>
                </div>
            )}
        </div>
    );
};

export const IncreaseAssessmentTimeDialog = ({
    trigger,
    open,
    onOpenChange,
    durationDistribution,
}: ProvideDialogDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Increase Assessment Time"
            dialogWidth="w-[400px] max-w-[400px]"
            content={
                <IncreaseAssessmentTimeDialogContent durationDistribution={durationDistribution} />
            }
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
