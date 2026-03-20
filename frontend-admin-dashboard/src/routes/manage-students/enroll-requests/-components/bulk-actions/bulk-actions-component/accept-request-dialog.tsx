import { MyDialog } from '@/components/design-system/dialog';
import { toast } from 'sonner';
import { useEnrollRequestsDialogStore } from '../bulk-actions-store';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { getApproveEnrollmentRequestsData } from '../../../-services/get-enroll-requests';

// Interface to match the actual data structure from bulkActionInfo.selectedStudents
interface EnrollRequestItem {
    packageSessionIds: string[]; // or number[] if IDs are numeric
    userId: string; // or number
    enrollInviteId: string; // or number
}

export interface EnrollRequestAcceptData {
    items: EnrollRequestItem[];
}

export const AcceptRequestDialog = () => {
    const { isAcceptRequestOpen, bulkActionInfo, selectedStudent, closeAllDialogs } =
        useEnrollRequestsDialogStore();

    const pendingForApprovalStudentsBulk = bulkActionInfo?.selectedStudents?.filter(
        (student) => student.payment_status === 'PAYMENT_PENDING'
    );

    const enrollRequestData = {
        items: selectedStudent
            ? [
                  {
                      packageSessionIds: [selectedStudent.destination_package_session_id],
                      userId: selectedStudent.user_id,
                      enrollInviteId: selectedStudent.enroll_invite_id,
                  },
              ]
            : bulkActionInfo?.selectedStudents?.map((student) => ({
                  packageSessionIds: [student.destination_package_session_id],
                  userId: student.user_id,
                  enrollInviteId: student.enroll_invite_id,
              })) || [],
    };

    const handleEnrollRequestMutation = useMutation({
        mutationFn: async ({
            enrollRequestData,
        }: {
            enrollRequestData: EnrollRequestAcceptData;
        }) => {
            return getApproveEnrollmentRequestsData({ enrollRequestData });
        },
        onSuccess: () => {
            toast.success('Request accepted successfully');
            closeAllDialogs();
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                toast.error('Failed to accept request');
            } else {
                toast.error('An unexpected error occurred', {
                    className: 'error-toast',
                    duration: 2000,
                });
            }
        },
    });

    const handleAcceptRequestBulk = async () => {
        if (!bulkActionInfo) return;
        handleEnrollRequestMutation.mutate({
            enrollRequestData,
        });
    };

    const handleAcceptRequest = async () => {
        if (!selectedStudent) return;
        handleEnrollRequestMutation.mutate({
            enrollRequestData,
        });
    };

    return (
        <MyDialog
            heading="Accept Request"
            open={isAcceptRequestOpen}
            onOpenChange={closeAllDialogs}
            footer={
                <div className="flex w-full justify-between gap-2">
                    <button
                        className="rounded-lg border border-neutral-300 px-4 py-2 text-neutral-600 hover:bg-neutral-100"
                        onClick={closeAllDialogs}
                    >
                        Cancel
                    </button>
                    <button
                        className="hover:bg-primary-600 rounded-lg bg-primary-500 px-4 py-2 text-white"
                        onClick={selectedStudent ? handleAcceptRequest : handleAcceptRequestBulk}
                    >
                        Accept Request
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-neutral-600">
                    Are you sure you want to accept request for{' '}
                    {selectedStudent?.full_name || bulkActionInfo?.displayText}?
                </p>
                {pendingForApprovalStudentsBulk && pendingForApprovalStudentsBulk?.length > 0 && (
                    <p className="text-sm text-red-500">
                        *Note: Payment is still pending for {pendingForApprovalStudentsBulk?.length}{' '}
                        students
                    </p>
                )}
                {selectedStudent && selectedStudent.payment_status === 'PAYMENT_PENDING' && (
                    <p className="text-sm text-red-500">
                        *Note: Payment is still pending for this student
                    </p>
                )}
                <p className="text-sm text-neutral-500">
                    This will accept the request to the selected students via email.
                </p>
            </div>
        </MyDialog>
    );
};
