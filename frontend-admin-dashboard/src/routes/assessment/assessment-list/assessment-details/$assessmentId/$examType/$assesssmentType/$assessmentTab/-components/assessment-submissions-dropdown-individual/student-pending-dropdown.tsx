import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MyButton } from '@/components/design-system/button';
import { DotsThree, WarningCircle } from '@phosphor-icons/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AssessmentRevaluateStudentInterface } from '@/types/assessments/assessment-overview';

// Internal menu-option keys — decoupled from the translated display labels below
// so branching logic never depends on the current locale's text.
const MENU_OPTION_SEND_REMINDER = 'SEND_REMINDER';
const MENU_OPTION_REMOVE_PARTICIPANTS = 'REMOVE_PARTICIPANTS';

const SendReminderComponent = ({
    student,
    onClose,
}: {
    student: AssessmentRevaluateStudentInterface;
    onClose: () => void;
}) => {
    const { t } = useTranslation('assessmentStudentPendingDropdown');
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                {t('dialogs.sendReminder.title')}
            </h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>{t('dialogs.attentionLabel')}</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    {t('dialogs.sendReminder.confirmMessagePrefix')}{' '}
                    <span className="text-primary-500">{student.full_name}</span>{' '}
                    {t('dialogs.sendReminder.confirmMessageSuffix')}
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={onClose}
                    >
                        {t('dialogs.sendReminder.send')}
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
    const { t } = useTranslation('assessmentStudentPendingDropdown');
    return (
        <DialogContent className="flex flex-col p-0">
            <h1 className="rounded-md bg-primary-50 p-4 text-primary-500">
                {t('dialogs.removeParticipant.title')}
            </h1>
            <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center text-danger-600">
                    <p>{t('dialogs.attentionLabel')}</p>
                    <WarningCircle size={18} />
                </div>
                <h1>
                    {t('dialogs.removeParticipant.confirmMessagePrefix')}{' '}
                    <span className="text-primary-500">{student.full_name}</span>{' '}
                    {t('dialogs.removeParticipant.confirmMessageSuffix')}
                </h1>
                <div className="flex justify-end">
                    <MyButton
                        type="button"
                        scale="large"
                        buttonType="primary"
                        className="mt-4 font-medium"
                        onClick={onClose}
                    >
                        {t('dialogs.removeParticipant.remove')}
                    </MyButton>
                </div>
            </div>
        </DialogContent>
    );
};

const StudentPendingDropdown = ({ student }: { student: AssessmentRevaluateStudentInterface }) => {
    const { t } = useTranslation('assessmentStudentPendingDropdown');
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
                        onClick={() => handleMenuOptionsChange(MENU_OPTION_SEND_REMINDER)}
                    >
                        {t('dropdown.sendReminder')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => handleMenuOptionsChange(MENU_OPTION_REMOVE_PARTICIPANTS)}
                    >
                        {t('dropdown.removeParticipants')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {/* Dialog should be controlled by openDialog state */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                {selectedOption === MENU_OPTION_SEND_REMINDER && (
                    <SendReminderComponent student={student} onClose={() => setOpenDialog(false)} />
                )}
                {selectedOption === MENU_OPTION_REMOVE_PARTICIPANTS && (
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
