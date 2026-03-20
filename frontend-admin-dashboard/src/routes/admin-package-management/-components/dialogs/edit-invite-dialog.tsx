import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { EnrollInvite } from '../../-types/package-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEnrollInvite } from '../../-services/package-service';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface EditInviteDialogProps {
    invite: EnrollInvite;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EditInviteDialog = ({ invite, open, onOpenChange }: EditInviteDialogProps) => {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        id: invite.id,
        name: invite.name,
        invite_code: invite.invite_code,
        status: invite.status,
        start_date: invite.start_date,
        end_date: invite.end_date,
        institute_id: invite.institute_id,
    });

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            // Ensure dates are properly formatted if necessary, but assuming API handles standard formats or what it returned
            await updateEnrollInvite(formData);
        },
        onSuccess: () => {
            toast.success('Invite updated successfully');
            queryClient.invalidateQueries({ queryKey: ['enroll-invites'] });
            queryClient.invalidateQueries({ queryKey: ['enroll-invite-detail'] });
            onOpenChange(false);
        },
        onError: () => {
            toast.error('Failed to update invite');
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="z-[100] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Enroll Invite</DialogTitle>
                    <DialogDescription>Update the invite details.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="invite_name">Name</Label>
                        <Input
                            id="invite_name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="invite_code">Invite Code</Label>
                        <Input
                            id="invite_code"
                            value={formData.invite_code}
                            onChange={(e) =>
                                setFormData({ ...formData, invite_code: e.target.value })
                            }
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="invite_status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(val) => setFormData({ ...formData, status: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                                id="start_date"
                                type="datetime-local"
                                // Assuming format matches, otherwise might need conversion
                                value={
                                    formData.start_date ? formData.start_date.substring(0, 16) : ''
                                }
                                onChange={(e) =>
                                    setFormData({ ...formData, start_date: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                                id="end_date"
                                type="datetime-local"
                                value={formData.end_date ? formData.end_date.substring(0, 16) : ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, end_date: e.target.value })
                                }
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => mutate()} disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
