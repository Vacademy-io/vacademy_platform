import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Infinity as InfinityIcon, Users } from 'lucide-react';
import { PackageSessionInventory } from '../-types/inventory-types';
import { useUpdateCapacity } from '../-hooks/use-inventory-data';
import { toast } from 'sonner';

interface UpdateCapacityDialogProps {
    isOpen: boolean;
    onClose: () => void;
    item: PackageSessionInventory | null;
}

export const UpdateCapacityDialog = ({
    isOpen,
    onClose,
    item,
}: UpdateCapacityDialogProps) => {
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [maxSeats, setMaxSeats] = useState<string>('');
    const [availableSlots, setAvailableSlots] = useState<string>('');

    const updateCapacity = useUpdateCapacity();

    // Reset form when item changes
    useEffect(() => {
        if (item) {
            setIsUnlimited(item.isUnlimited ?? false);
            setMaxSeats(item.maxSeats?.toString() ?? '');
            setAvailableSlots(item.availableSlots?.toString() ?? '');
        }
    }, [item]);

    const handleSubmit = async () => {
        if (!item) return;

        const newMaxSeats = isUnlimited ? null : parseInt(maxSeats, 10);
        const newAvailableSlots =
            isUnlimited || availableSlots.trim() === '' ? null : parseInt(availableSlots, 10);

        if (!isUnlimited && (isNaN(newMaxSeats!) || newMaxSeats! < 0)) {
            toast.error('Please enter a valid capacity number');
            return;
        }

        if (
            !isUnlimited &&
            newAvailableSlots !== null &&
            (isNaN(newAvailableSlots) || newAvailableSlots < 0 || (newMaxSeats !== null && newAvailableSlots > newMaxSeats))
        ) {
            toast.error('Please enter a valid available slots number (0 to max seats)');
            return;
        }

        try {
            await updateCapacity.mutateAsync({
                packageSessionId: item.id,
                maxSeats: newMaxSeats,
                availableSlots: newAvailableSlots,
            });
            toast.success('Capacity updated successfully');
            onClose();
        } catch (error) {
            toast.error('Failed to update capacity');
        }
    };

    const handleClose = () => {
        if (!updateCapacity.isPending) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Update Capacity
                    </DialogTitle>
                    <DialogDescription>
                        Set the maximum capacity for this package session.
                    </DialogDescription>
                </DialogHeader>

                {item && (
                    <div className="space-y-6 py-4">
                        {/* Session Info */}
                        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                            <div className="text-sm font-medium text-foreground">
                                {item.packageName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {item.levelName} • {item.sessionName}
                            </div>
                            {!item.isUnlimited && item.maxSeats !== undefined && (
                                <div className="text-xs text-muted-foreground pt-1 border-t mt-2">
                                    Current: {item.availableSlots} / {item.maxSeats} available
                                </div>
                            )}
                            {item.isUnlimited && (
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 pt-1 border-t mt-2">
                                    Currently set to Unlimited
                                </div>
                            )}
                        </div>

                        {/* Unlimited Toggle */}
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isUnlimited ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-muted'}`}>
                                    <InfinityIcon className={`h-4 w-4 ${isUnlimited ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                                </div>
                                <div>
                                    <Label htmlFor="unlimited-toggle" className="text-sm font-medium cursor-pointer">
                                        Unlimited Capacity
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        No seat limit for this session
                                    </p>
                                </div>
                            </div>
                            <Switch
                                id="unlimited-toggle"
                                checked={isUnlimited}
                                onCheckedChange={setIsUnlimited}
                            />
                        </div>

                        {/* Max Seats Input */}
                        {!isUnlimited && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="max-seats">Maximum Seats</Label>
                                    <Input
                                        id="max-seats"
                                        type="number"
                                        min="0"
                                        placeholder="Enter maximum capacity"
                                        value={maxSeats}
                                        onChange={(e) => setMaxSeats(e.target.value)}
                                        className="text-lg"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Total stock or maximum capacity.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="available-slots">Available Slots (Override)</Label>
                                    <Input
                                        id="available-slots"
                                        type="number"
                                        min="0"
                                        max={maxSeats || undefined}
                                        placeholder="Optional: Override current availability"
                                        value={availableSlots}
                                        onChange={(e) => setAvailableSlots(e.target.value)}
                                        className="text-lg"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Leave empty to auto-calculate based on current enrollments. Update this to manually correct inventory.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={updateCapacity.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={
                            updateCapacity.isPending || (!isUnlimited && !maxSeats)
                        }
                        className="gap-2"
                    >
                        {updateCapacity.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
