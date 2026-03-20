import { MyButton } from '@/components/design-system/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useFormStore } from '@/stores/students/enroll-students-manually/enroll-manually-form-store';

export const FormSubmitButtons = ({
    stepNumber,
    finishButtonDisable,
    onNext,
    onAsyncNext,
    loadingText,
}: {
    stepNumber: number;
    finishButtonDisable?: boolean;
    /** Sync click handler for Next buttons */
    onNext?: () => void;
    /** Async click handler for Finish button - provides double-submit prevention */
    onAsyncNext?: () => Promise<void>;
    /** Loading text to show while async operation is in progress */
    loadingText?: string;
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

    // Determine if we should use async mode (typically for the Finish button)
    const useAsyncMode = stepNumber === 5 && onAsyncNext;

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
                    // Use onAsyncClick for Finish button if async handler is provided
                    onAsyncClick={useAsyncMode ? onAsyncNext : undefined}
                    onClick={!useAsyncMode ? onNext : undefined}
                    loadingText={loadingText || 'Finishing...'}
                    type="submit"
                >
                    {stepNumber === 5 ? <span>Finish</span> : <span>Next</span>}
                </MyButton>
            </div>
        </DialogFooter>
    );
};
