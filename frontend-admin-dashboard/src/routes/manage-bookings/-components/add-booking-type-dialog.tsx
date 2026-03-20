import { useState } from 'react';
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
import { useCreateBookingType } from '../-hooks/use-booking-data';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';

interface AddBookingTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AddBookingTypeDialog = ({ open, onOpenChange }: AddBookingTypeDialogProps) => {
    const [type, setType] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const instituteId = getInstituteId();
    const { mutate: createType, isPending } = useCreateBookingType();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!instituteId) return;

        createType(
            {
                type,
                code,
                description,
                institute_id: instituteId,
            },
            {
                onSuccess: () => {
                    toast.success('Booking Type created successfully');
                    onOpenChange(false);
                    setType('');
                    setCode('');
                    setDescription('');
                },
                onError: (error) => {
                    toast.error('Failed to create booking type');
                    console.error(error);
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add Booking Type</DialogTitle>
                        <DialogDescription>
                            Create a new booking type for your institute.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type Name
                            </Label>
                            <Input
                                id="type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. School Visit"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="code" className="text-right">
                                Code
                            </Label>
                            <Input
                                id="code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. SCHOOL_VISIT"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Creating...' : 'Create Type'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
