import { AssessmentSubmissionsBulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { ReactNode } from 'react';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MyButton } from '@/components/design-system/button';
import { useSubmissionsBulkActionsDialogStorePending } from '../bulk-actions-zustand-store/useSubmissionsBulkActionsDialogStorePending';

interface BulkActionsMenuProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: SubmissionStudentData[];
    trigger: ReactNode;
}

export const BulkActionsMenuPending = ({ selectedStudents, trigger }: BulkActionsMenuProps) => {
    const { openBulkSendReminderDialog, openBulkRemoveParticipantsDialog } =
        useSubmissionsBulkActionsDialogStorePending();

    const handleMenuOptionsChange = (value: string) => {
        const validStudents = selectedStudents.filter((student) => student && student.user_id);

        if (validStudents.length === 0) {
            console.error('No valid students selected');
            return;
        }

        const bulkActionInfo: AssessmentSubmissionsBulkActionInfo = {
            selectedStudentIds: validStudents.map((student) => student.user_id),
            selectedStudents: validStudents,
            displayText: `${validStudents.length} students`,
        };

        switch (value) {
            case 'Send Reminder':
                openBulkSendReminderDialog(bulkActionInfo);
                break;
            case 'Remove Participants':
                openBulkRemoveParticipantsDialog(bulkActionInfo);
                break;
        }
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
                        {trigger}
                    </MyButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleMenuOptionsChange('Send Reminder')}
                    >
                        Send Reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleMenuOptionsChange('Remove Participants')}
                    >
                        Remove Participants
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
};
