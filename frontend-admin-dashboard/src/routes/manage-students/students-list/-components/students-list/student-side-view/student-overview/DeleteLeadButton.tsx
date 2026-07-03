import { useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Trash } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { DELETE_AUDIENCE_LEAD } from '@/constants/urls';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// Soft-deletes a lead (sets audience_status=INACTIVE on the backend). Admin-only:
// the button is hidden for counsellors/other roles, and the backend re-checks.
export const DeleteLeadButton = () => {
    const { selectedStudent, setSelectedStudent } = useStudentSidebar();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);

    const responseId =
        (selectedStudent as unknown as Record<string, unknown>)?._response_id as string | null;

    const isAdmin = getUserRoles(getTokenFromCookie(TokenKey.accessToken)).includes('ADMIN');

    const mutation = useMutation({
        mutationFn: () =>
            authenticatedAxiosInstance.delete(DELETE_AUDIENCE_LEAD(responseId || '')),
        onSuccess: () => {
            toast.success('Lead deleted');
            queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setOpen(false);
            setSelectedStudent(null); // close the sidebar — the lead is gone
        },
        onError: (err: AxiosError<{ ex?: string }>) => {
            // Surfaces the backend's 403 (not admin) / 409 (converted) message.
            toast.error(err.response?.data?.ex || 'Failed to delete lead');
        },
    });

    if (!selectedStudent || !responseId || !isAdmin) return null;

    const footer = (
        <div className="flex w-full items-center justify-end gap-3">
            <MyButton
                type="button"
                buttonType="secondary"
                scale="medium"
                onClick={() => setOpen(false)}
            >
                Cancel
            </MyButton>
            <MyButton
                type="button"
                buttonType="primary"
                scale="medium"
                disable={mutation.isPending}
                className="!bg-danger-600 hover:!bg-danger-500"
                onClick={() => mutation.mutate()}
            >
                {mutation.isPending ? 'Deleting…' : 'Delete Lead'}
            </MyButton>
        </div>
    );

    return (
        <MyDialog
            trigger={
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    className="!border-danger-200 !text-danger-600 hover:!bg-danger-50"
                >
                    <Trash className="size-3.5" />
                    Delete Lead
                </MyButton>
            }
            heading="Delete this lead?"
            footer={footer}
            open={open}
            onOpenChange={setOpen}
            dialogWidth="max-w-md"
        >
            <p className="text-sm text-neutral-600">
                This lead will be removed from your lead lists and will no longer receive
                promotional emails or WhatsApp messages. This can be undone if they submit a form
                again.
            </p>
        </MyDialog>
    );
};
