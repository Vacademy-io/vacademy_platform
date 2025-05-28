import { MyButton } from '@/components/design-system/button';
import { StepOneForm } from './forms/step-one-form';
import { StepTwoForm } from './forms/step-two-form';
import { StepThreeForm } from './forms/step-three-form';
import { StepFourForm } from './forms/step-four-form';
import { StepFiveForm } from './forms/step-five-form';
import { useFormStore } from '@/stores/students/enroll-students-manually/enroll-manually-form-store';
import { MyDialog } from '@/components/design-system/dialog';
import { StudentTable } from '@/types/student-table-types';
import { useEffect, useRef, useState } from 'react';
import { FormSubmitButtons } from './form-components/form-submit-buttons';

interface EnrollManuallyButtonProps {
    triggerButton?: JSX.Element;
    initialValues?: StudentTable;
    forceOpen?: boolean;
    onClose?: () => void;
}

export const EnrollManuallyButton = ({
    triggerButton,
    initialValues,
    forceOpen,
    onClose,
}: EnrollManuallyButtonProps) => {
    const [openDialog, setOpenDialog] = useState(!!forceOpen);
    const { resetForm } = useFormStore();
    const currentStep = useFormStore((state) => state.currentStep);
    const [nextButtonDisable, setNextButtonDisable] = useState(true);
    const handleNextButtonDisable = (value: boolean) => setNextButtonDisable(value);

    const step1FormSubmitRef = useRef(() => {});
    const step2FormSubmitRef = useRef(() => {});
    const step3FormSubmitRef = useRef(() => {});
    const step4FormSubmitRef = useRef(() => {});
    const step5FormSubmitRef = useRef(() => {});

    const submitFn1 = (fn: () => void) => (step1FormSubmitRef.current = fn);
    const submitFn2 = (fn: () => void) => (step2FormSubmitRef.current = fn);
    const submitFn3 = (fn: () => void) => (step3FormSubmitRef.current = fn);
    const submitFn4 = (fn: () => void) => (step4FormSubmitRef.current = fn);
    const submitFn5 = (fn: () => void) => (step5FormSubmitRef.current = fn);

    const handleOpenDialog = (open: boolean) => {
        setOpenDialog(open);
        if (!open) {
            // Reset form when dialog is closed
            resetForm();
            // Call onClose callback if provided
            if (!open && onClose) {
                onClose();
            }
        }
    };

    // Update openDialog when forceOpen changes
    useEffect(() => {
        if (forceOpen !== undefined) {
            setOpenDialog(forceOpen);
        }
    }, [forceOpen]);

    const renderFooter = () => {
        switch (currentStep) {
            case 1:
                return (
                    <FormSubmitButtons
                        stepNumber={1}
                        finishButtonDisable={nextButtonDisable}
                        onNext={() => step1FormSubmitRef.current()}
                    />
                );
            case 2:
                return (
                    <FormSubmitButtons stepNumber={2} onNext={() => step2FormSubmitRef.current()} />
                );
            case 3:
                return (
                    <FormSubmitButtons stepNumber={3} onNext={() => step3FormSubmitRef.current()} />
                );
            case 4:
                return (
                    <FormSubmitButtons stepNumber={4} onNext={() => step4FormSubmitRef.current()} />
                );
            case 5:
                return (
                    <FormSubmitButtons
                        stepNumber={5}
                        finishButtonDisable={nextButtonDisable}
                        onNext={() => step5FormSubmitRef.current()}
                    />
                );
            default:
                return (
                    <FormSubmitButtons
                        stepNumber={1}
                        finishButtonDisable={nextButtonDisable}
                        onNext={() => step1FormSubmitRef.current()}
                    />
                );
        }
    };

    const renderCurrentStep = (initialValues?: StudentTable) => {
        switch (currentStep) {
            case 1:
                return (
                    <StepOneForm
                        initialValues={initialValues}
                        handleNextButtonDisable={handleNextButtonDisable}
                        submitFn={submitFn1}
                    />
                );
            case 2:
                return <StepTwoForm initialValues={initialValues} submitFn={submitFn2} />;
            case 3:
                return <StepThreeForm initialValues={initialValues} submitFn={submitFn3} />;
            case 4:
                return <StepFourForm initialValues={initialValues} submitFn={submitFn4} />;
            case 5:
                return (
                    <StepFiveForm
                        initialValues={initialValues}
                        handleNextButtonDisable={handleNextButtonDisable}
                        submitFn={submitFn5}
                        handleOpenDialog={handleOpenDialog}
                    />
                );
            default:
                return (
                    <StepOneForm
                        initialValues={initialValues}
                        handleNextButtonDisable={handleNextButtonDisable}
                        submitFn={submitFn1}
                    />
                );
        }
    };

    // Determine the dialog title based on whether it's a re-enrollment
    const dialogTitle = initialValues ? 'Re-enroll Learner' : 'Enroll Learner';

    return (
        <MyDialog
            trigger={
                triggerButton ? (
                    triggerButton
                ) : (
                    <MyButton buttonType="secondary" scale="large" layoutVariant="default">
                        Enroll Manually
                    </MyButton>
                )
            }
            heading={dialogTitle}
            dialogWidth="w-[800px]"
            footer={renderFooter()}
            open={openDialog}
            onOpenChange={handleOpenDialog}
        >
            <>{renderCurrentStep(initialValues)}</>
        </MyDialog>
    );
};
