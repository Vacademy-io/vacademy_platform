import React from 'react';
import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
    DialogDescription as ShadDialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getConcessionHistory } from '../-services/concession-services';
import {
    ConcessionRequest,
    CONCESSION_CATEGORIES,
    CONCESSION_STATUS_CONFIG,
} from '../-types/fee-concession-types';

interface ConcessionHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    registrationId: string;
    studentName?: string;
}

export function ConcessionHistoryDialog({
    open,
    onOpenChange,
    registrationId,
    studentName,
}: ConcessionHistoryDialogProps) {
    const {
        data: history,
        isLoading,
    } = useQuery<ConcessionRequest[]>({
        queryKey: ['concession-history', registrationId],
        queryFn: () => getConcessionHistory(registrationId),
        enabled: open && !!registrationId,
    });

    const historyArray = history || [];

    return (
        <ShadDialog open={open} onOpenChange={onOpenChange}>
            <ShadDialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <ShadDialogHeader>
                    <ShadDialogTitle>Concession History</ShadDialogTitle>
                    <ShadDialogDescription>
                        {studentName
                            ? `Audit log of all fee concession actions for ${studentName}`
                            : 'Audit log of all fee concession actions'}
                    </ShadDialogDescription>
                </ShadDialogHeader>

                {isLoading ? (
                    <DashboardLoader />
                ) : historyArray.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <p className="text-sm">No concession history found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {historyArray.map((entry) => {
                            const statusConfig = CONCESSION_STATUS_CONFIG[entry.status];
                            const categoryLabel =
                                CONCESSION_CATEGORIES.find((c) => c.value === entry.category)
                                    ?.label || entry.category;
                            const concessionAmount =
                                entry.originalAmount - entry.adjustedAmount;

                            return (
                                <div
                                    key={entry.id}
                                    className="relative border-l-2 border-gray-200 pl-4 pb-4"
                                >
                                    {/* Timeline dot */}
                                    <div
                                        className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${
                                            entry.status === 'APPROVED'
                                                ? 'bg-green-500'
                                                : entry.status === 'REJECTED'
                                                  ? 'bg-red-500'
                                                  : 'bg-amber-500'
                                        }`}
                                    />

                                    <div className="rounded-lg border bg-white p-3 shadow-sm">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-gray-900">
                                                {entry.feeName}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={`${statusConfig.bgColor} ${statusConfig.color} border-none text-xs`}
                                            >
                                                {statusConfig.label}
                                            </Badge>
                                        </div>

                                        {/* Amount details */}
                                        <div className="text-xs space-y-0.5 text-gray-600">
                                            <div className="flex justify-between">
                                                <span>Original:</span>
                                                <span>
                                                    ₹ {entry.originalAmount.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-red-600">
                                                <span>Concession ({categoryLabel}):</span>
                                                <span>
                                                    - ₹ {concessionAmount.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between font-semibold text-gray-800">
                                                <span>Adjusted:</span>
                                                <span>
                                                    ₹ {entry.adjustedAmount.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Reason */}
                                        <div className="mt-2 text-xs text-gray-500">
                                            <span className="font-medium">Reason:</span>{' '}
                                            {entry.reason}
                                        </div>

                                        {/* Timeline events */}
                                        <div className="mt-2 space-y-1 text-xs text-gray-500">
                                            <div>
                                                Submitted by {entry.requestedBy} on{' '}
                                                {new Date(entry.requestedAt).toLocaleString()}
                                            </div>
                                            {entry.reviewedBy && entry.reviewedAt && (
                                                <div>
                                                    {entry.status === 'APPROVED'
                                                        ? 'Approved'
                                                        : 'Rejected'}{' '}
                                                    by {entry.reviewedBy} on{' '}
                                                    {new Date(
                                                        entry.reviewedAt
                                                    ).toLocaleString()}
                                                </div>
                                            )}
                                            {entry.reviewRemarks && (
                                                <div className="italic">
                                                    Review remarks: {entry.reviewRemarks}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ShadDialogContent>
        </ShadDialog>
    );
}
