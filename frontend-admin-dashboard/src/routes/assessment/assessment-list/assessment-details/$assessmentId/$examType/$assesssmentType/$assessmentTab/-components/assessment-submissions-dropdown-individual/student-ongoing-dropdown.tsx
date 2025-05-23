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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { timeLimit } from "@/constants/dummy-data";

const CloseSubmissionComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">Close Submission</h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>Attention</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    Are you sure you want to close Assessment submission of{" "}
                    <span className="text-primary-500">{student.full_name}</span>?
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={onClose}
                    >
                        Close
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const IncreaseAssessmentTimeComponent = ({
    student,
    distributionDuration,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    distributionDuration: string;
    onClose: () => void;
}) => {
    console.log(student);
    const [selectedSection, setSelectedSection] = useState<string>(timeLimit[0] as string);

    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                Increase Assessment Time
            </h1>
            {distributionDuration === "ASSESSMENT" && (
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-4">
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
                    <div className="flex justify-center">
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            className="mt-4 font-medium"
                            onClick={onClose}
                        >
                            Close
                        </MyButton>
                    </div>
                </div>
            )}
            {distributionDuration === "SECTION" && (
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-4">
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
                    <div className="flex justify-center">
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            className="mt-4 font-medium"
                            onClick={onClose}
                        >
                            Close
                        </MyButton>
                    </div>
                </div>
            )}
            {distributionDuration === "QUESTION" && (
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-4">
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
                    <div className="flex justify-center">
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            className="mt-4 font-medium"
                            onClick={onClose}
                        >
                            Close
                        </MyButton>
                    </div>
                </div>
            )}
        </DialogContent>
    );
};

const StudentOngoingDropdown = ({ student }: { student: AssessmentRevaluateStudentInterface }) => {
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
                        onClick={() => handleMenuOptionsChange("Increase Submission Time")}
                    >
                        Increase Submission Time
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleMenuOptionsChange("Close Submission")}
                    >
                        Close Submission
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {/* Dialog should be controlled by openDialog state */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === "Increase Submission Time" && (
                    <IncreaseAssessmentTimeComponent
                        student={student}
                        distributionDuration="ASSESSMENT"
                        onClose={() => setOpenDialog(false)}
                    />
                )}
                {selectedOption === "Close Submission" && (
                    <CloseSubmissionComponent
                        student={student}
                        onClose={() => setOpenDialog(false)}
                    />
                )}
            </Dialog>
        </>
    );
};

export default StudentOngoingDropdown;
