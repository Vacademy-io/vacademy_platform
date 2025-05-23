import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useDeleteSession } from '@/services/study-library/session-management/deleteSession';
import { SessionData } from '@/types/study-library/session-types';
import { useState } from 'react';
import { toast } from 'sonner';

export const DeleteSessionDialog = ({
    triggerButton,
    session,
}: {
    triggerButton: JSX.Element;
    session: SessionData;
}) => {
    const [open, setOpen] = useState(false);

    const handleOpenChange = () => {
        setOpen(!open);
    };

    const deleteSessionMutation = useDeleteSession();

    const handleDeleteSession = (session: SessionData) => {
        deleteSessionMutation.mutate(
            { requestData: [session.session.id] },
            {
                onSuccess: () => {
                    toast.success('Session deleted successfully!');
                    setOpen(false);
                },
                onError: () => {
                    toast.error('Failed to delete session');
                },
            }
        );
    };

    return (
        <MyDialog
            heading="Delete Session"
            trigger={triggerButton}
            open={open}
            onOpenChange={handleOpenChange}
            dialogWidth="w-[500px]"
        >
            <div className="flex flex-col gap-6 p-4">
                <div>
                    <p className="text-danger-600">Attention</p>
                    <p>
                        All the data in the session will be deleted. Are you sure you want to delete
                        the session{' '}
                        <span className="text-primary-500">{session.session.session_name}</span>?
                    </p>
                </div>
                <div className="flex items-center justify-between">
                    <MyButton
                        buttonType="secondary"
                        onClick={() => {
                            setOpen(false);
                        }}
                    >
                        No
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        onClick={() => {
                            handleDeleteSession(session);
                        }}
                    >
                        Yes
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
};
