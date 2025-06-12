import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useCreateInvite } from '../../-services/create-invite';
import { CreateInviteDialog } from './CreateInviteDialog';
import { useRef, useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { Copy, Plus } from 'phosphor-react';
import { InviteForm } from '../../-schema/InviteFormSchema';
import formDataToRequestData from '../../-utils/formDataToRequestData';
import { CreateInvitationRequestType } from '../../-types/create-invitation-types';
import { toast } from 'sonner';
import createInviteLink from '../../-utils/createInviteLink';
import { useInviteFormContext } from '../../-context/useInviteFormContext';
import { MyDialog } from '@/components/design-system/dialog';

export const CreateInvite = () => {
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    const [openInvitationLinkDialog, setOpenInvitationLinkDialog] = useState<boolean>(false);
    const formSubmitRef = useRef<() => void>(() => {});
    const [openCreateInviteDialog, setOpenCreateInviteDialog] = useState(false);
    const [disableCreateInviteButton, setDisableCreateInviteButton] = useState<boolean>(true);
    const { form } = useInviteFormContext();
    const { setValue } = form;

    const { getPackageSessionId } = useInstituteDetailsStore();

    const createInviteMutation = useCreateInvite();

    const handleDisableCreateInviteButton = (value: boolean) => {
        setDisableCreateInviteButton(value);
    };

    const onOpenChangeCreateInviteDialog = () => {
        setOpenCreateInviteDialog(!openCreateInviteDialog);
    };

    const handleCopyClick = (link: string) => {
        navigator.clipboard
            .writeText(link)
            .then(() => {
                setCopySuccess(link);
                setTimeout(() => {
                    setCopySuccess(null);
                }, 2000);
            })
            .catch((err) => {
                console.log('Failed to copy link: ', err);
                toast.error('Copy failed');
            });
    };

    const CreateInviteButton = (
        <MyButton>
            <Plus /> Create Invite Link
        </MyButton>
    );

    const inviteSubmitButton = (
        <div className="flex w-full items-center justify-end">
            <MyButton onClick={() => formSubmitRef.current()} disable={disableCreateInviteButton}>
                Create
            </MyButton>
        </div>
    );

    const onCreateInvite = async (invite: InviteForm) => {
        const requestData = formDataToRequestData(invite, getPackageSessionId);
        try {
            const { data: responseData }: { data: CreateInvitationRequestType } =
                await createInviteMutation.mutateAsync({ requestBody: requestData });
            toast.success('invitation created');
            const link = createInviteLink(responseData?.learner_invitation?.invite_code || '');
            setInviteLink(link);
            setValue('batches', {
                maxCourses: 0,
                courseSelectionMode: 'institute',
                preSelectedCourses: [],
                learnerChoiceCourses: [],
            });
            setOpenCreateInviteDialog(false);
            setOpenInvitationLinkDialog(true);
        } catch {
            toast.error('failed to create invitation');
        }
    };

    return (
        <>
            <CreateInviteDialog
                triggerButton={CreateInviteButton}
                submitButton={inviteSubmitButton}
                submitForm={(fn: () => void) => {
                    formSubmitRef.current = fn;
                }}
                onCreateInvite={onCreateInvite}
                open={openCreateInviteDialog}
                onOpenChange={onOpenChangeCreateInviteDialog}
                inviteLink={inviteLink}
                setInviteLink={setInviteLink}
                handleDisableCreateInviteButton={handleDisableCreateInviteButton}
            />
            <MyDialog
                heading="Invitation Link"
                open={openInvitationLinkDialog}
                onOpenChange={setOpenInvitationLinkDialog}
                footer={
                    <div className="flex w-full items-center justify-between">
                        <MyButton buttonType="secondary">Review Invitation</MyButton>
                        <MyButton onClick={() => setOpenInvitationLinkDialog(false)}>
                            Close
                        </MyButton>
                    </div>
                }
                dialogWidth="w-[50vw] overflow-x-hidden"
            >
                <div className="flex w-fit items-center gap-4 overflow-x-hidden">
                    <p className="w-[50%] truncate rounded-lg border border-neutral-300 p-2 text-neutral-500">
                        {inviteLink}
                    </p>
                    <div className="flex items-center gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            layoutVariant="icon"
                            onClick={() => inviteLink && handleCopyClick(inviteLink)}
                            type="button"
                        >
                            <Copy />
                        </MyButton>
                        {copySuccess === inviteLink && (
                            <span className="text-caption text-primary-500">Copied!</span>
                        )}
                    </div>
                </div>
            </MyDialog>
        </>
    );
};
