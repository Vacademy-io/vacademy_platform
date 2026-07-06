import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useEligibleAssigneesDebounced } from '@/services/user-autosuggest';
import { X } from 'lucide-react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ASSIGN_COUNSELOR_TO_LEAD } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

interface AssignCounselorToLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    userName?: string;
    /** Called after successful assignment with counselor info */
    onSuccess?: (counselorId: string, counselorName: string) => void;
    /** Additional query keys to invalidate after assignment */
    invalidateKeys?: string[][];
}

async function assignCounselorToLead(
    userId: string,
    instituteId: string,
    counselorId: string,
    counselorName: string
) {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: ASSIGN_COUNSELOR_TO_LEAD,
        params: { userId, instituteId, counselorId, counselorName },
    });
    return response.data;
}

/** Omitting counselorId removes the current assignment — the lead returns to
 *  the unassigned pool (no-op server-side when nothing was assigned). */
async function removeCounselorFromLead(userId: string, instituteId: string) {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: ASSIGN_COUNSELOR_TO_LEAD,
        params: { userId, instituteId },
    });
    return response.data;
}

export const AssignCounselorToLeadDialog = ({
    open,
    onOpenChange,
    userId,
    userName,
    onSuccess,
    invalidateKeys = [],
}: AssignCounselorToLeadDialogProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCounselor, setSelectedCounselor] = useState<{
        id: string;
        full_name: string;
    } | null>(null);

    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    // RBAC-scoped: the backend intersects with the caller's user-to-user
    // descendants when the institute has configured a leads team and the
    // caller is in it. Outside that gate it falls back to institute-wide,
    // so this is a safe drop-in replacement for the old role-based hook.
    const { data: counselors, isLoading } = useEligibleAssigneesDebounced(searchQuery, 300);

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
        for (const key of invalidateKeys) {
            queryClient.invalidateQueries({ queryKey: key });
        }
    };

    const mutation = useMutation({
        mutationFn: () =>
            assignCounselorToLead(userId, instituteId, selectedCounselor!.id, selectedCounselor!.full_name),
        onSuccess: () => {
            toast.success('Counselor assigned successfully');
            invalidateAll();
            onSuccess?.(selectedCounselor!.id, selectedCounselor!.full_name);
            handleClose();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to assign counselor');
        },
    });

    // Remove the current assignment — lead goes back to the unassigned pool.
    // Server-side no-op when nothing was assigned, so it's safe to offer always.
    const removeMutation = useMutation({
        mutationFn: () => removeCounselorFromLead(userId, instituteId),
        onSuccess: () => {
            toast.success('Counselor removed — lead is unassigned');
            invalidateAll();
            handleClose();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to remove counselor');
        },
    });

    const handleClose = () => {
        setSearchQuery('');
        setSelectedCounselor(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>
                        Assign Counselor{userName ? ` — ${userName}` : ''}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!selectedCounselor ? (
                        <div>
                            <Label htmlFor="counselorSearch">Search Counselor</Label>
                            <Input
                                id="counselorSearch"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type to search by name..."
                                className="mt-1"
                                autoFocus
                            />
                            {isLoading && (
                                <p className="mt-2 text-sm text-gray-500">Searching...</p>
                            )}
                            {counselors && counselors.length > 0 && (
                                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                                    {counselors.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCounselor({ id: c.id, full_name: c.full_name });
                                                setSearchQuery('');
                                            }}
                                            className="w-full border-b p-3 text-left transition-colors last:border-0 hover:bg-gray-50"
                                        >
                                            <div className="font-medium">{c.full_name}</div>
                                            <div className="text-sm text-gray-500">{c.email}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {searchQuery && counselors && counselors.length === 0 && !isLoading && (
                                <p className="mt-2 text-sm text-gray-500">No counselors found</p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <Label>Selected Counselor</Label>
                            <div className="mt-1 flex items-center justify-between rounded-md border bg-gray-50 p-3">
                                <div className="font-medium">{selectedCounselor.full_name}</div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCounselor(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                    <MyButton
                        buttonType="text"
                        className="text-danger-600 hover:bg-danger-50"
                        onClick={() => removeMutation.mutate()}
                        disabled={mutation.isPending || removeMutation.isPending}
                    >
                        {removeMutation.isPending ? 'Removing...' : 'Remove counselor'}
                    </MyButton>
                    <div className="flex gap-2">
                        <MyButton
                            buttonType="secondary"
                            onClick={handleClose}
                            disabled={mutation.isPending || removeMutation.isPending}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            onClick={() => mutation.mutate()}
                            disabled={!selectedCounselor || mutation.isPending || removeMutation.isPending}
                        >
                            {mutation.isPending ? 'Assigning...' : 'Assign'}
                        </MyButton>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
