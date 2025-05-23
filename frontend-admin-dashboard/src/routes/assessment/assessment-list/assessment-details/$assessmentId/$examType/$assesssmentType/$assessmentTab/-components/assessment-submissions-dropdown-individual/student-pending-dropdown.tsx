import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MyButton } from "@/components/design-system/button";
import { DotsThree, WarningCircle } from "phosphor-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AssessmentRevaluateStudentInterface } from "@/types/assessments/assessment-overview";

const SendReminderComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Send Reminder</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    A reminder will be sent to{" "}
                    <span className="text-primary-500">{student.full_name}</span> who hasn’t yet
                    appeared for the Assessment
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={onClose}
                    >
                        Send
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const RemoveParticipantComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Remove Participant</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want remove{" "}
                    <span className="text-primary-500">{student.full_name}</span> from this
                    Assessment?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={onClose}
                    >
                        Remove
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const StudentPendingDropdown = ({ student }: { student: AssessmentRevaluateStudentInterface }) => {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const handleMenuOptionsChange = (value: string) => {
        setSelectedOption(value);
        setOpenDialog(true);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="w-6 !min-w-6"
                    >
                        <DotsThree />
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleMenuOptionsChange("Send Reminder")}
                    >
                        Send Reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleMenuOptionsChange("Remove Participants")}
                    >
                        Remove Participants
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {/* Dialog should be controlled by openDialog state */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === "Send Reminder" && (
                    <SendReminderComponent student={student} onClose={() => setOpenDialog(false)} />
                )}
                {selectedOption === "Remove Participants" && (
                    <RemoveParticipantComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
            </Dialog>
        </>
    );
};

export default StudentPendingDropdown;
