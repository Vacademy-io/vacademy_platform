import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { linkCounsellorToEnquiry } from '../-services/link-counsellor';
import { useUserAutosuggestDebounced, USER_ROLES } from '@/services/user-autosuggest';
import { X } from 'lucide-react';

interface AssignCounsellorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    enquiryId: string;
    onSuccess?: () => void;
}

export const AssignCounsellorDialog = ({
    open,
    onOpenChange,
    enquiryId,
    onSuccess,
}: AssignCounsellorDialogProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCounsellor, setSelectedCounsellor] = useState<{
        id: string;
        full_name: string;
    } | null>(null);

    const queryClient = useQueryClient();

    // Fetch counsellors with debounced search
    const { data: counsellors, isLoading: isLoadingCounsellors } = useUserAutosuggestDebounced(
        searchQuery,
        [USER_ROLES.ADMIN, USER_ROLES.COUNSELLOR],
        300
    );

    // Mutation to assign counsellor
    const assignMutation = useMutation({
        mutationFn: () => linkCounsellorToEnquiry(enquiryId, selectedCounsellor!.id),
        onSuccess: () => {
            toast.success('Counsellor assigned successfully');
            queryClient.invalidateQueries({ queryKey: ['enquiries'] });
            queryClient.invalidateQueries({
                queryKey: ['counsellor-details', selectedCounsellor!.id],
            });
            onSuccess?.();
            handleClose();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to assign counsellor');
        },
    });

    const handleAssign = () => {
        if (!selectedCounsellor) {
            toast.error('Please select a counsellor');
            return;
        }
        assignMutation.mutate();
    };

    const handleClose = () => {
        setSearchQuery('');
        setSelectedCounsellor(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Counsellor</DialogTitle>
                    <DialogDescription>
                        Search and select a counsellor to assign to this enquiry
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!selectedCounsellor ? (
                        <div>
                            <Label htmlFor="counsellorSearch">Search Counsellor</Label>
                            <Input
                                id="counsellorSearch"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type to search by name..."
                                className="mt-1"
                            />
                            {isLoadingCounsellors && (
                                <p className="mt-2 text-sm text-gray-500">Searching...</p>
                            )}
                            {counsellors && counsellors.length > 0 && (
                                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                                    {counsellors.map((counsellor) => (
                                        <button
                                            key={counsellor.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCounsellor({
                                                    id: counsellor.id,
                                                    full_name: counsellor.full_name,
                                                });
                                                setSearchQuery('');
                                            }}
                                            className="w-full border-b p-3 text-left transition-colors last:border-0 hover:bg-gray-50"
                                        >
                                            <div className="font-medium">
                                                {counsellor.full_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {counsellor.email}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {searchQuery &&
                                counsellors &&
                                counsellors.length === 0 &&
                                !isLoadingCounsellors && (
                                    <p className="mt-2 text-sm text-gray-500">
                                        No counsellors found
                                    </p>
                                )}
                        </div>
                    ) : (
                        <div>
                            <Label>Selected Counsellor</Label>
                            <div className="mt-1 flex items-center justify-between rounded-md border bg-gray-50 p-3">
                                <div>
                                    <div className="font-medium">
                                        {selectedCounsellor.full_name}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCounsellor(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <MyButton
                        buttonType="secondary"
                        onClick={handleClose}
                        disabled={assignMutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        onClick={handleAssign}
                        disabled={!selectedCounsellor || assignMutation.isPending}
                    >
                        {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
