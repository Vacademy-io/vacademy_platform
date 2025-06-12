// StudentMenuOptions.tsx
import { MyDropdown } from '../../dropdown';
import { MyButton } from '../../button';
import { DotsThree } from '@phosphor-icons/react';
import { useDialogStore } from '../../../../routes/manage-students/students-list/-hooks/useDialogStore';
import { StudentTable } from '@/types/student-table-types';
import { useState } from 'react';
import { EnrollManuallyButton } from '@/components/common/students/enroll-manually/enroll-manually-button';

const getMenuOptions = (status?: string) => {
    if (status === 'INACTIVE') {
        // return ["View Student Portal", "Re-enroll Student", "Delete Student"];
        return ['Re-enroll Student'];
    }

    // return [
    //     "View Student Portal",
    //     "Change Batch",
    //     "Extend Session",
    //     "Re-register for Next Session",
    //     "Terminate Registration",
    //     "Delete Student",
    // ];
    return ['Change Batch', 'Terminate Registration', 'Re-register for Next Session'];
};

export const StudentMenuOptions = ({ student }: { student: StudentTable }) => {
    const {
        openChangeBatchDialog,
        openExtendSessionDialog,
        openReRegisterDialog,
        openTerminateRegistrationDialog,
        openDeleteDialog,
    } = useDialogStore();

    const [showReEnrollDialog, setShowReEnrollDialog] = useState(false);
    const menuOptions = getMenuOptions(student.status);

    const handleMenuOptionsChange = (value: string) => {
        switch (value) {
            case 'Re-enroll Student':
                setShowReEnrollDialog(true);
                break;
            case 'Change Batch':
                openChangeBatchDialog(student);
                break;
            case 'Extend Session':
                openExtendSessionDialog(student);
                break;
            case 'Re-register for Next Session':
                openReRegisterDialog(student);
                break;
            case 'Terminate Registration':
                openTerminateRegistrationDialog(student);
                break;
            case 'Delete Student':
                openDeleteDialog(student);
                break;
            // Handle View Student Portal if needed
            case 'View Student Portal':
                // Add portal view logic here
                break;
        }
    };

    return (
        <>
            <MyDropdown dropdownList={menuOptions} onSelect={handleMenuOptionsChange}>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="icon"
                    className="flex items-center justify-center"
                >
                    <DotsThree />
                </MyButton>
            </MyDropdown>

            {/* Always render the button but with programmatic open control */}
            <EnrollManuallyButton
                initialValues={student}
                triggerButton={<div className="hidden" />}
                forceOpen={showReEnrollDialog}
                onClose={() => setShowReEnrollDialog(false)}
            />
        </>
    );
};
