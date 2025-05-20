import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { SelectedReleaseResultFilterInterface } from "../AssessmentSubmissionsTab";
import { getReleaseStudentResult } from "../../-services/assessment-details-services";
import { toast } from "sonner";
import { Route } from "../..";
import { getInstituteId } from "@/constants/helper";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { MyButton } from "@/components/design-system/button";
import { WarningCircle } from "phosphor-react";

export const AssessmentGlobalLevelReleaseResultAssessment = () => {
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();
    const [releaseResultDialog, setReleaseResultDialog] = useState(false);
    const getRleaseResultMutation = useMutation({
        mutationFn: ({
            assessmentId,
            instituteId,
            methodType,
            selectedReleaseFilter,
        }: {
            assessmentId: string;
            instituteId: string | undefined;
            methodType: string;
            selectedReleaseFilter: SelectedReleaseResultFilterInterface;
        }) => getReleaseStudentResult(assessmentId, instituteId, methodType, selectedReleaseFilter),
        onSuccess: () => {
            toast.success(
                "Result for this assessment has been released for all students. Participants need to check their email!",
                {
                    className: "success-toast",
                    duration: 4000,
                },
            );
            setReleaseResultDialog(false);
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleReleaseResultForAllStudents = () => {
        getRleaseResultMutation.mutate({
            assessmentId,
            instituteId,
            methodType: "ASSESSMENT_ALL",
            selectedReleaseFilter: {
                attempt_ids: [],
            },
        });
    };
    return (
        <Dialog open={releaseResultDialog} onOpenChange={setReleaseResultDialog}>
            <DialogTrigger>
                <MyButton
                    type="button"
                    scale="large"
                    buttonType="secondary"
                    className="font-medium"
                >
                    Release Result
                </MyButton>
            </DialogTrigger>
            <DialogContent className="flex flex-col p-0">
                <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                    Release Result For All Students
                </h1>
                <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center text-danger-600">
                        <p>Attention</p>
                        <WarningCircle size={18} />
                    </div>
                    <h1>Are you sure you want to release result for all students?</h1>
                    <div className="flex justify-end">
                        <MyButton
                            type="button"
                            scale="large"
                            buttonType="primary"
                            className="mt-4 font-medium"
                            onClick={handleReleaseResultForAllStudents}
                        >
                            Yes
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
