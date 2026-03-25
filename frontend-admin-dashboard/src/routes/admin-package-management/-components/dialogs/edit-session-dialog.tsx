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
import { PackageSessionDTO } from '../../-types/package-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBatchInventory } from '../../-services/package-service';
import { toast } from 'sonner';

interface EditSessionDialogProps {
    session: PackageSessionDTO;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EditSessionDialog = ({ session, open, onOpenChange }: EditSessionDialogProps) => {
    const queryClient = useQueryClient();

    // We don't have max seats in PackageSessionDTO currently,
    // but the update API takes it. We might need to fetch detailed session info first?
    // or assume we are just setting it to a new value.
    // Let's assume initialized to 0 or we don't show current value if not available.
    // Looking at PackageSessionDTO:
    // export interface PackageSessionDTO { id: string; ... }
    // It doesn't seem to have max_seats.
    // So we will just show an input to "Update Max Seats".

    const [maxSeats, setMaxSeats] = useState(100);

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            await updateBatchInventory(session.id, maxSeats);
        },
        onSuccess: () => {
            toast.success('Session inventory updated');
            queryClient.invalidateQueries({ queryKey: ['package-sessions'] });
            onOpenChange(false);
        },
        onError: () => {
            toast.error('Failed to update inventory');
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="z-[100] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Update Session Capacity</DialogTitle>
                    <DialogDescription>
                        Set the maximum number of seats for this session.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="seats">Max Seats</Label>
                        <Input
                            id="seats"
                            type="number"
                            value={maxSeats}
                            onChange={(e) => setMaxSeats(parseInt(e.target.value))}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => mutate()} disabled={isPending}>
                        Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
