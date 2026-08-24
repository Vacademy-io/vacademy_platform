import { toast } from 'sonner';

import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { CredentialDeliveryModePicker } from '@/components/templates/CredentialDeliveryModePicker';
import { useCredentialDeliveryChoice } from '@/components/templates/use-credential-delivery-choice';
import { useShareCredentials } from '@/routes/manage-students/students-list/-services/share-credentials';
import {
    getCredentialTemplateConfig,
    setCredentialTemplateConfig,
} from '@/services/student-list-section/updateStudentCredentials';
import { getInstituteId } from '@/constants/helper';
import { buildSampleLearnerCredentialsTemplate } from './sample-learner-credentials-template';

interface ShareCredentialsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Learners to send to — one for the individual action, the selection for the bulk one. */
    userIds: string[];
    /** Who the credentials are going to, as the admin sees them named on screen. */
    recipientLabel?: string;
}

/**
 * The one "Share Credentials" dialog, used by both the learner list and the enroll-requests
 * screen, for both the single-learner and the bulk action.
 *
 * <p>Those four entry points had four copies of the same confirm dialog, which is why only some of
 * them ever gained a fix. They differ solely in which store holds the open flag and which learners
 * are selected, so that is all the wrappers still decide.
 *
 * <p>The body of the email is the admin's choice at send time: the platform's built-in credentials
 * mail, or the institute's own template rendered around the username and password variables.
 */
export const ShareCredentialsDialog = ({
    open,
    onOpenChange,
    userIds,
    recipientLabel,
}: ShareCredentialsDialogProps) => {
    const shareCredentialsMutation = useShareCredentials();

    const { mode, setMode, selectedTemplate, handleTemplateSelect } = useCredentialDeliveryChoice({
        enabled: open,
        loadBoundTemplateId: async () => {
            const instituteId = getInstituteId();
            if (!instituteId) return null;
            return (await getCredentialTemplateConfig(instituteId, 'EMAIL')).template_id;
        },
        saveBoundTemplateId: async (templateId) => {
            const instituteId = getInstituteId();
            if (!instituteId) return;
            await setCredentialTemplateConfig(instituteId, 'EMAIL', templateId);
        },
    });

    const handleShareCredentials = async () => {
        if (!userIds.length) return;
        if (mode === 'TEMPLATE' && !selectedTemplate) {
            toast.error('Select an email template, or switch to the system default');
            return;
        }

        try {
            const result = await shareCredentialsMutation.mutateAsync({
                userIds,
                mode,
                templateId: mode === 'TEMPLATE' ? selectedTemplate?.id : undefined,
            });

            // Template sends are resolved per learner, so a batch can partly succeed and a single
            // send can legitimately deliver nothing (no template bound, no email on file).
            // Reporting a blanket success would hide both.
            if (result.sent > 0 && result.failed === 0) {
                toast.success('Credentials shared successfully');
                onOpenChange(false);
            } else if (result.sent > 0) {
                toast.warning(`Sent to ${result.sent}. ${result.failed} could not be sent.`);
                onOpenChange(false);
            } else {
                toast.error(result.message || 'Nothing was sent');
            }
        } catch {
            toast.error('Failed to share credentials');
        }
    };

    const isSending = shareCredentialsMutation.isPending;

    return (
        <MyDialog
            heading="Share Credentials"
            open={open}
            onOpenChange={onOpenChange}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex w-full justify-end gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        disable={isSending}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        disable={isSending}
                        onClick={handleShareCredentials}
                    >
                        {isSending ? 'Sending…' : 'Share Credentials'}
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-body text-neutral-600">
                    Send login credentials to{' '}
                    <span className="font-medium">{recipientLabel || 'the selected learners'}</span>{' '}
                    by email.
                </p>

                <CredentialDeliveryModePicker
                    mode={mode}
                    onModeChange={setMode}
                    selectedTemplate={selectedTemplate}
                    onTemplateSelect={handleTemplateSelect}
                    defaultDescription="The built-in credentials email, sent exactly as it is today."
                    templateDescription="Your own branded email, using the username and password variables."
                    buildSample={buildSampleLearnerCredentialsTemplate}
                    disabled={isSending}
                />
            </div>
        </MyDialog>
    );
};
