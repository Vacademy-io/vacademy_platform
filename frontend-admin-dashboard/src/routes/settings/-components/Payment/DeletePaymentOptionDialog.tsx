import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { PaymentPlan } from '@/types/payment';
import {
    getInvitesByPaymentOptionId,
    updateInvitePaymentOption,
    deletePaymentOption,
    UpdatePaymentOptionRequest,
} from '@/services/payment-options';
import { toast } from 'sonner';
import { InviteLinkDataInterface } from '@/schemas/study-library/invite-links-schema';
import { MyButton } from '@/components/design-system/button';

interface DeletePaymentOptionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    paymentOption: PaymentPlan | null;
    allPaymentOptions: PaymentPlan[];
    onDeleted: () => void;
}

interface InvitePaymentUpdate {
    inviteId: string;
    selectedPaymentOptionId: string;
    packageSessionId: string;
    status: InviteLinkDataInterface['status'];
    error?: string;
}

export const DeletePaymentOptionDialog: React.FC<DeletePaymentOptionDialogProps> = ({
    isOpen,
    onClose,
    paymentOption,
    allPaymentOptions,
    onDeleted,
}) => {
    const [step, setStep] = useState<'loading' | 'select' | 'confirm'>('loading');
    const [linkedInvites, setLinkedInvites] = useState<InviteLinkDataInterface[]>([]);
    const [inviteUpdates, setInviteUpdates] = useState<InvitePaymentUpdate[]>([]);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoadingInvites, setIsLoadingInvites] = useState(false);

    const availablePaymentOptions = allPaymentOptions.filter((opt) => opt.id !== paymentOption?.id);

    // Load invites when dialog opens
    const loadLinkedInvites = useCallback(async () => {
        if (!paymentOption?.id) return;

        setIsLoadingInvites(true);
        try {
            const invites = await getInvitesByPaymentOptionId([paymentOption.id]);
            setLinkedInvites(invites);
            console.log('Linked invites:', invites[0]);

            // Initialize payment updates tracking
            const updates: InvitePaymentUpdate[] = invites.map((invite) => ({
                inviteId: invite.id,
                packageSessionId:
                    invite.package_session_to_payment_options[0]?.package_session_id || '',
                selectedPaymentOptionId: '',
                status: invite.status,
            }));
            setInviteUpdates(updates);

            setStep(invites.length > 0 ? 'select' : 'confirm');
        } catch (error) {
            console.error('Error loading invites:', error);
            toast.error('Failed to load linked invites');
            setStep('confirm');
        } finally {
            setIsLoadingInvites(false);
        }
    }, [paymentOption?.id]);

    // Auto-load invites when dialog opens
    useEffect(() => {
        if (isOpen && paymentOption?.id) {
            loadLinkedInvites();
        }
    }, [isOpen, paymentOption?.id, loadLinkedInvites]);

    const handlePaymentOptionSelect = (inviteId: string, paymentOptionId: string) => {
        setInviteUpdates((prev) =>
            prev.map((update) =>
                update.inviteId === inviteId
                    ? { ...update, selectedPaymentOptionId: paymentOptionId, status: 'pending' }
                    : update
            )
        );
    };

    const handleUpdateInvite = async (inviteId: string) => {
        const update = inviteUpdates.find((u) => u.inviteId === inviteId);
        if (!update || !update.selectedPaymentOptionId) {
            toast.error('Please select a payment option');
            return;
        }

        setInviteUpdates((prev) =>
            prev.map((u) => (u.inviteId === inviteId ? { ...u, status: 'updating' } : u))
        );

        try {
            const selectedPaymentOption = allPaymentOptions.find(
                (opt) => opt.id === update.selectedPaymentOptionId
            );

            if (!selectedPaymentOption) {
                throw new Error('Selected payment option not found');
            }

            const linkedInvite = linkedInvites.find((inv) => inv.id === inviteId);

            if (!linkedInvite) {
                throw new Error(`Invite with ID ${inviteId} not found in linked invites`);
            }

            // Build the update request based on the API structure
            const updateRequest: UpdatePaymentOptionRequest = {
                enroll_invite_id: inviteId,
                update_payment_options: [
                    {
                        old_package_session_payment_option_id: paymentOption?.id || '',
                        new_package_session_payment_option: {
                            package_session_id:
                                linkedInvite.package_session_to_payment_options[0]
                                    ?.package_session_id || '',
                            id: selectedPaymentOption.id,
                            payment_option: {
                                id: selectedPaymentOption.id,
                                name: selectedPaymentOption.name,
                                status: 'ACTIVE',
                                source: 'INSTITUTE',
                                source_id: '',
                                tag: selectedPaymentOption.tag,
                                type: selectedPaymentOption.type,
                                require_approval: selectedPaymentOption.requireApproval || false,
                                payment_plans: [],
                                payment_option_metadata_json: '',
                            },
                            enroll_invite_id: inviteId,
                            status: 'ACTIVE',
                        },
                    },
                ],
            };

            console.log('Sending update request:', JSON.stringify(updateRequest, null, 2));

            await updateInvitePaymentOption([updateRequest]);

            setInviteUpdates((prev) =>
                prev.map((u) =>
                    u.inviteId === inviteId
                        ? u.status === 'completed'
                            ? u
                            : { ...u, status: 'completed', error: undefined }
                        : u
                )
            );

            toast.success('Invite payment option updated successfully');
        } catch (error) {
            console.error('Error updating invite:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to update invite';
            setInviteUpdates((prev) =>
                prev.map((u) =>
                    u.inviteId === inviteId
                        ? u.status === 'failed'
                            ? u
                            : { ...u, status: 'failed', error: errorMessage }
                        : u
                )
            );
            toast.error(errorMessage);
        }
    };

    const handleDelete = async () => {
        if (!paymentOption?.id) return;

        // Check if all invites are updated (if there are any)
        if (linkedInvites.length > 0) {
            const allUpdated = inviteUpdates.every((u) => u.status === 'completed');
            if (!allUpdated) {
                toast.error('Please update all linked invites before deleting');
                return;
            }
        }

        if (deleteConfirmText.toLowerCase() !== 'delete') {
            toast.error('Please type "delete" to confirm');
            return;
        }

        setIsDeleting(true);
        try {
            await deletePaymentOption([paymentOption.id]);
            toast.success('Payment option deleted successfully');
            onDeleted();
            handleClose();
        } catch (error) {
            console.error('Error deleting payment option:', error);
            toast.error('Failed to delete payment option');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClose = () => {
        setStep('loading');
        setLinkedInvites([]);
        setInviteUpdates([]);
        setDeleteConfirmText('');
        onClose();
    };

    const getPaymentOptionName = (id: string) => {
        return allPaymentOptions.find((opt) => opt.id === id)?.name || 'Unknown';
    };

    const completedCount = inviteUpdates.filter((u) => u.status === 'completed').length;
    const totalInvites = inviteUpdates.length;

    if (!isOpen || !paymentOption) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className=" min-w-fit space-y-0 overflow-y-auto ">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="size-5 text-red-600" />
                        Delete Payment Option - {paymentOption.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 ">
                    {/* Loading State */}
                    {step === 'loading' && (
                        <div className="space-y-4 py-2">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="size-8 animate-spin text-primary-400" />
                                <p className="text-sm text-gray-600">Checking linked invites...</p>
                                <Button
                                    onClick={loadLinkedInvites}
                                    disabled={isLoadingInvites}
                                    className="mt-4"
                                >
                                    {isLoadingInvites ? 'Loading...' : 'Load Linked Invites'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Select Payment Options Step */}
                    {step === 'select' && linkedInvites.length > 0 && (
                        <div className="space-y-4 py-2">
                            <Alert>
                                <AlertTriangle className="size-4" />
                                <AlertDescription>
                                    This payment option is linked to {linkedInvites.length}{' '}
                                    {`invite(s). Please assign a different payment option to each
                                    invite first.`}
                                </AlertDescription>
                            </Alert>

                            <div className="text-sm font-medium text-gray-700">
                                Progress: {completedCount} of {totalInvites} completed
                            </div>

                            <div className="max-h-96 space-y-3 overflow-y-auto">
                                {linkedInvites.map((invite) => {
                                    const update = inviteUpdates.find(
                                        (u) => u.inviteId === invite.id
                                    );
                                    if (!update) return null;

                                    return (
                                        <Card
                                            key={invite.id}
                                            className="border border-gray-200 p-4"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        {invite.name}
                                                    </span>
                                                    <span
                                                        className={`rounded-full px-2 py-1 text-xs ${
                                                            update.status === 'completed'
                                                                ? 'bg-green-100 text-green-800'
                                                                : update.status === 'failed'
                                                                  ? 'bg-red-100 text-red-800'
                                                                  : update.status === 'updating'
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : 'bg-gray-100 text-gray-800'
                                                        }`}
                                                    >
                                                        {update.status === 'completed'
                                                            ? 'Updated'
                                                            : update.status === 'failed'
                                                              ? 'Failed'
                                                              : update.status === 'updating'
                                                                ? 'Updating...'
                                                                : 'Pending'}
                                                    </span>
                                                </div>

                                                {update.status !== 'completed' && (
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">
                                                            Select New Payment Option
                                                        </Label>
                                                        <Select
                                                            value={update.selectedPaymentOptionId}
                                                            onValueChange={(value) =>
                                                                handlePaymentOptionSelect(
                                                                    invite.id,
                                                                    value
                                                                )
                                                            }
                                                            disabled={update.status === 'updating'}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select payment option" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {availablePaymentOptions.map(
                                                                    (option) => (
                                                                        <SelectItem
                                                                            key={option.id}
                                                                            value={option.id}
                                                                        >
                                                                            {option.name}
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                            </SelectContent>
                                                        </Select>

                                                        <MyButton
                                                            onClick={() =>
                                                                handleUpdateInvite(invite.id)
                                                            }
                                                            disabled={
                                                                !update.selectedPaymentOptionId ||
                                                                update.status === 'updating'
                                                            }
                                                            buttonType="secondary"
                                                            size="sm"
                                                            className="w-full"
                                                        >
                                                            {update.status === 'updating' ? (
                                                                <>
                                                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                                                    Updating...
                                                                </>
                                                            ) : (
                                                                'Update'
                                                            )}
                                                        </MyButton>
                                                    </div>
                                                )}

                                                {update.status === 'completed' && (
                                                    <div className="text-sm text-green-700">
                                                        {`✓ Updated to: ${getPaymentOptionName(update.selectedPaymentOptionId)}`}
                                                    </div>
                                                )}

                                                {update.error && (
                                                    <div className="text-sm text-red-700">
                                                        Error: {update.error}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>

                            {completedCount === totalInvites && (
                                <MyButton onClick={() => setStep('confirm')} className="w-full ">
                                    All Updated - Continue to Delete
                                </MyButton>
                            )}
                        </div>
                    )}

                    {/* Confirmation Step */}
                    {step === 'confirm' && (
                        <div className="space-y-4 py-2">
                            {linkedInvites.length === 0 && (
                                <Alert>
                                    <AlertTriangle className="size-4" />
                                    <AlertDescription>
                                        This payment option has no linked invites and can be safely
                                        deleted.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <Alert className="border-red-200 bg-red-50">
                                <AlertTriangle className="size-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                    This action cannot be undone. Type &quot;delete&quot; below to
                                    confirm deletion.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <Label htmlFor="delete-confirm" className="text-sm">
                                    Type &quot;delete&quot; to confirm
                                </Label>
                                <Input
                                    id="delete-confirm"
                                    type="text"
                                    placeholder="Type 'delete' to confirm"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    disabled={isDeleting}
                                    className="font-mono"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Dialog Actions */}
                <div className="flex justify-end gap-3 pt-4">
                    <Button
                        onClick={handleClose}
                        variant="outline"
                        disabled={isDeleting || isLoadingInvites}
                    >
                        Cancel
                    </Button>
                    {step === 'confirm' && (
                        <MyButton
                            onClick={handleDelete}
                            disabled={
                                deleteConfirmText.toLowerCase() !== 'delete' ||
                                isDeleting ||
                                (linkedInvites.length > 0 && completedCount !== totalInvites)
                            }
                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Payment Option'
                            )}
                        </MyButton>
                    )}
                    {step === 'loading' && <Button disabled>Loading...</Button>}
                </div>
            </DialogContent>
        </Dialog>
    );
};
