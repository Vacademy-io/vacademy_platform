import { MyDropdown } from '@/components/design-system/dropdown';
import { MyButton } from '@/components/design-system/button';
import { DotsThree } from '@phosphor-icons/react';
import { useState, Suspense } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { useUpdateInviteLinkStatus } from '../-services/update-invite-link-status';
import { toast } from 'sonner';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { InviteLinkDataInterface } from '@/schemas/study-library/invite-links-schema';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { handleGetEnrollSingleInviteDetails } from './create-invite/-services/enroll-invite';
import { extractBatchesFromInviteDetails } from '../-utils/enrollInviteTransformers';
import GenerateInviteLinkDialog from './create-invite/GenerateInviteLinkDialog';
import { LoadingSpinner } from '@/components/ai-course-builder/LoadingSpinner';
import { handleGetPaymentDetails } from './create-invite/-services/get-payments';

interface InviteCardMenuOptionsProps {
    invite: InviteLinkDataInterface;
}

const EditInviteDialogContent = ({ invite }: { invite: InviteLinkDataInterface }) => {
    const [openEditDialog, setOpenEditDialog] = useState(true);
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    // Fetch invite details
    const { data: inviteLinkDetails } = useSuspenseQuery(
        handleGetEnrollSingleInviteDetails({ inviteId: invite.id })
    );

    // Fetch payment data (needed by GenerateInviteLinkDialog internally)
    useSuspenseQuery(handleGetPaymentDetails());

    // Extract batches from invite details
    const selectedBatches = extractBatchesFromInviteDetails(
        inviteLinkDetails,
        getDetailsFromPackageSessionId
    );

    // Find the parent course
    const parentBatch = selectedBatches[0];
    const selectedCourse = parentBatch
        ? {
              id: parentBatch.package_dto.package_name,
              name: parentBatch.package_dto.package_name,
          }
        : null;

    return (
        <GenerateInviteLinkDialog
            showSummaryDialog={openEditDialog}
            setShowSummaryDialog={setOpenEditDialog}
            selectedCourse={selectedCourse}
            selectedBatches={selectedBatches
                .filter((batch) => batch !== null)
                .map((batch) => ({
                    sessionId: batch.session.id,
                    levelId: batch.level.id,
                    sessionName: batch.session.session_name,
                    levelName: batch.level.level_name,
                    courseId: batch.package_dto.id,
                    courseName: batch.package_dto.package_name,
                    isParent: false,
                }))}
            inviteLinkId={invite.id}
            singlePackageSessionId={true}
            isEditInviteLink={true}
            setDialogOpen={setOpenEditDialog}
        />
    );
};

export const InviteCardMenuOptions = ({ invite }: InviteCardMenuOptionsProps) => {
    const queryClient = useQueryClient();
    const dropdownList = ['edit', 'delete'];
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const updateInviteStatusMutation = useUpdateInviteLinkStatus();

    const onDeleteInvite = async (invite: InviteLinkDataInterface) => {
        try {
            await updateInviteStatusMutation.mutateAsync({
                requestBody: {
                    learner_invitation_ids: [invite.id],
                    status: 'DELETED',
                },
            });
            queryClient.invalidateQueries({ queryKey: ['inviteList'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INVITE_LINKS'] });
            toast.success('Invite deleted!');
            setOpenDeleteDialog(false);
        } catch {
            toast.error('failed to delete the invite link!');
        }
    };

    const handleSelect = async (value: string) => {
        if (value == 'delete') {
            setOpenDeleteDialog(true);
        } else {
            setOpenEditDialog(true);
        }
    };

    return (
        <>
            <MyDropdown dropdownList={dropdownList} onSelect={handleSelect}>
                <MyButton buttonType="secondary" scale="medium" layoutVariant="icon">
                    <DotsThree />
                </MyButton>
            </MyDropdown>

            {openEditDialog && (
                <Suspense fallback={<LoadingSpinner />}>
                    <EditInviteDialogContent invite={invite} />
                </Suspense>
            )}

            <MyDialog
                open={openDeleteDialog}
                onOpenChange={() => setOpenDeleteDialog(!openDeleteDialog)}
                heading="Delete Dialog"
                footer={
                    <div className="flex w-full items-center justify-between py-2">
                        <MyButton buttonType="secondary" onClick={() => setOpenDeleteDialog(false)}>
                            Cancel
                        </MyButton>
                        <MyButton buttonType="primary" onClick={() => onDeleteInvite(invite)}>
                            Yes, I am sure
                        </MyButton>
                    </div>
                }
            >
                Are you sure you want to delete the {invite.name} invite?
            </MyDialog>
        </>
    );
};
