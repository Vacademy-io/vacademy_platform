import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchPaymentLogs, getPaymentLogsQueryKey } from '@/services/payment-logs';
import { PaymentLogsTable } from '@/routes/manage-payments/-components/PaymentLogsTable';
import type { BatchForSession, PaymentLogsResponse } from '@/types/payment-logs';

const PAGE_SIZE = 20;

/** Sort payment log entries by date, most recent first (by payment_log.date then user_plan.created_at) */
function sortByDateRecentFirst(data: PaymentLogsResponse): PaymentLogsResponse {
    const sorted = [...data.content].sort((a, b) => {
        const dateA = a.payment_log?.date || a.user_plan?.created_at || '';
        const dateB = b.payment_log?.date || b.user_plan?.created_at || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return { ...data, content: sorted };
}

export const StudentPaymentHistory = () => {
    const { selectedStudent } = useStudentSidebar();
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const [currentPage, setCurrentPage] = useState(0);

    const batchesForSessions: BatchForSession[] = useMemo(() => {
        const batches = instituteDetails?.batches_for_sessions;
        return batches && Array.isArray(batches)
            ? (batches as unknown as BatchForSession[])
            : [];
    }, [instituteDetails]);

    const hasOrgAssociatedBatches = useMemo(() => {
        return batchesForSessions.some((batch) => batch.is_org_associated === true);
    }, [batchesForSessions]);

    const requestFilters = useMemo(
        () => ({
            sort_columns: { createdAt: 'DESC' as const },
            ...(selectedStudent?.user_id && { user_id: selectedStudent.user_id }),
        }),
        [selectedStudent?.user_id]
    );

    const {
        data: paymentLogsData,
        isLoading: isLoadingPayments,
        error: paymentsError,
        refetch: refetchPaymentLogs,
    } = useQuery({
        queryKey: getPaymentLogsQueryKey(currentPage, PAGE_SIZE, requestFilters),
        queryFn: () => fetchPaymentLogs(currentPage, PAGE_SIZE, requestFilters),
        staleTime: 30000,
        enabled: Boolean(selectedStudent?.user_id),
    });

    const packageSessionsMap = useMemo(() => {
        const map: Record<string, string> = {};
        batchesForSessions.forEach((batch) => {
            const packageName = batch.package_dto.package_name;
            const sessionName = batch.session.session_name;
            const levelName = batch.level.level_name;
            map[batch.id] = `${packageName} - ${sessionName} - ${levelName}`;
        });
        return map;
    }, [batchesForSessions]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!selectedStudent?.user_id) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-gray-600">Select a learner to view payment history.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-neutral-600">
                Payment History for <span className="font-medium text-neutral-800">{selectedStudent.full_name}</span>
            </p>
            <PaymentLogsTable
                data={paymentLogsData ? sortByDateRecentFirst(paymentLogsData) : undefined}
                isLoading={isLoadingPayments}
                error={paymentsError as Error}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                packageSessions={packageSessionsMap}
                hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                hideUserColumn
                onRefresh={() => refetchPaymentLogs()}
            />
        </div>
    );
};
