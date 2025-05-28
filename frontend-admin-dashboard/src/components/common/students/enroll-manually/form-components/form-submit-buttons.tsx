import { MyButton } from "@/components/design-system/button";
import { DialogFooter } from "@/components/ui/dialog";
import { useFormStore } from "@/stores/students/enroll-students-manually/enroll-manually-form-store";

export const FormSubmitButtons = ({
    stepNumber,
    finishButtonDisable,
    onNext,
}: {
    stepNumber: number;
    finishButtonDisable?: boolean;
    onNext?: () => void;
}) => {
    const { prevStep, skipStep } = useFormStore();

    // Define the handleFirstButton function
    const handleFirstButton = () => {
        if (stepNumber === 1) {
            skipStep();
        } else {
            prevStep();
        }
    };

    return (
        <DialogFooter className="flex w-full">
            <div className="flex w-full justify-between">
                <MyButton
                    buttonType="secondary"
                    scale="large"
                    layoutVariant="default"
                    onClick={handleFirstButton}
                    type="button"
                >
                    {stepNumber === 1 ? <span>Skip</span> : <span>Back</span>}
                </MyButton>
                <MyButton
                    buttonType="primary"
                    scale="large"
                    layoutVariant="default"
                    disable={finishButtonDisable}
                    onClick={onNext}
                    type="submit"
                >
                    {stepNumber === 5 ? <span>Finish</span> : <span>Next</span>}
                </MyButton>
            </div>
        </DialogFooter>
    );
};
