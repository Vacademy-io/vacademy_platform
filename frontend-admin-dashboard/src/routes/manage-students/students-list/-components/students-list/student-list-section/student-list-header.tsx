import { MyButton } from '@/components/design-system/button';
import { EnrollStudentsButton } from '../../../../../../components/common/students/enroll-students-button';
import { useRouter } from '@tanstack/react-router';
import { BulkDialogProvider } from '../../../-providers/bulk-dialog-provider';
import { MyDialog } from '@/components/design-system/dialog';
import { useState } from 'react';
import { DropdownItemType } from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { useGetBatchesQuery } from '@/routes/manage-institute/batches/-services/get-batches';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import RootErrorComponent from '@/components/core/deafult-error';
import { InviteLink } from '@/routes/manage-students/-components/InviteLink';
import { CreateInvite } from '@/routes/manage-students/invite/-components/create-invite/CreateInvite';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { NoCourseDialog } from '@/components/common/students/no-course-dialog';

const InviteLinksDialog = ({
    currentSession,
    openInviteLinksDialog,
    handleOpenChange,
}: {
    currentSession?: DropdownItemType;
    openInviteLinksDialog: boolean;
    handleOpenChange: () => void;
}) => {
    const router = useRouter();

    const { data, isLoading, isError } = useGetBatchesQuery({
        sessionId: currentSession?.id || '',
    });

    const footer = (
        <div className="flex w-full items-center justify-between">
            <MyButton
                buttonType="secondary"
                onClick={() => router.navigate({ to: '/manage-students/invite' })}
            >
                Go to Invite Page
            </MyButton>
            <CreateInvite />
        </div>
    );

    return (
        <MyDialog
            heading="Invite Links"
            open={openInviteLinksDialog}
            onOpenChange={handleOpenChange}
            footer={footer}
        >
            {isLoading ? (
                <DashboardLoader />
            ) : isError ? (
                <RootErrorComponent />
            ) : (
                <div className="flex flex-col gap-3">
                    {currentSession?.id ? (
                        data?.flatMap((batch) =>
                            batch.batches.map((b, index) => (
                                <div className="flex flex-col gap-1" key={index}>
                                    <p className="text-subtitle font-semibold text-primary-500">
                                        {b.batch_name}
                                    </p>
                                    <div className="flex gap-2 text-body ">
                                        <InviteLink inviteCode={b.invite_code} linkLen={40} />
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        <p>No batches found</p>
                    )}
                </div>
            )}
        </MyDialog>
    );
};

export const StudentListHeader = ({ currentSession }: { currentSession?: DropdownItemType }) => {
    const [openInviteLinksDialog, setOpenInviteLinksDialog] = useState(false);
    const { instituteDetails } = useInstituteDetailsStore();
    const [isOpen, setIsOpen] = useState(false);
    const handleOpenChange = () => {
        setOpenInviteLinksDialog(!openInviteLinksDialog);
    };
    return (
        <div className="flex items-center justify-between">
            <div className="text-h3 font-semibold">Learner List</div>
            <div className="flex items-center gap-4">
                <MyButton
                    onClick={() => {
                        setOpenInviteLinksDialog(true);
                    }}
                    scale="large"
                    buttonType="secondary"
                >
                    Invite Learner
                </MyButton>
                <BulkDialogProvider>
                    {!instituteDetails?.batches_for_sessions.length ? (
                        <div className="flex flex-col items-center gap-1">
                            <NoCourseDialog
                                isOpen={isOpen}
                                setIsOpen={setIsOpen}
                                type="Enroll Students"
                                content="You need to create a course and add a subject in it before"
                                trigger={<MyButton scale="large">Enroll Students</MyButton>}
                            />
                        </div>
                    ) : (
                        <EnrollStudentsButton />
                    )}
                </BulkDialogProvider>
            </div>
            <InviteLinksDialog
                currentSession={currentSession}
                openInviteLinksDialog={openInviteLinksDialog}
                handleOpenChange={handleOpenChange}
            />
        </div>
    );
};
