import React, { useState } from 'react';
import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
    DialogDescription as ShadDialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import {
    ConcessionRequest,
    CONCESSION_CATEGORIES,
    CONCESSION_STATUS_CONFIG,
} from '@/routes/admissions/-types/fee-concession-types';

interface ConcessionReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    concession: ConcessionRequest;
    onApprove: (concessionId: string, remarks?: string) => void;
    onReject: (concessionId: string, reason: string) => void;
    isApproving?: boolean;
    isRejecting?: boolean;
}

export function ConcessionReviewDialog({
    open,
    onOpenChange,
    concession,
    onApprove,
    onReject,
    isApproving = false,
    isRejecting = false,
}: ConcessionReviewDialogProps) {
    const [remarks, setRemarks] = useState('');
    const [mode, setMode] = useState<'review' | 'reject'>('review');

    const categoryLabel =
        CONCESSION_CATEGORIES.find((c) => c.value === concession.category)?.label ||
        concession.category;
    const statusConfig = CONCESSION_STATUS_CONFIG[concession.status];
    const concessionAmount = concession.originalAmount - concession.adjustedAmount;

    const handleApprove = () => {
        onApprove(concession.id, remarks.trim() || undefined);
    };

    const handleReject = () => {
        if (remarks.trim()) {
            onReject(concession.id, remarks.trim());
        }
    };

    return (
        <ShadDialog open={open} onOpenChange={onOpenChange}>
            <ShadDialogContent className="max-w-lg">
                <ShadDialogHeader>
                    <ShadDialogTitle>Review Concession Request</ShadDialogTitle>
                    <ShadDialogDescription>
                        Review and approve or reject this fee concession request.
                    </ShadDialogDescription>
                </ShadDialogHeader>

                {/* Student & Fee Details */}
                <div className="space-y-3">
                    {concession.studentName && (
                        <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
                            <span className="text-sm text-gray-600">Student</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {concession.studentName}
                            </span>
                        </div>
                    )}

                    <div className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Fee Type</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {concession.feeName}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Original Amount</span>
                            <span className="text-sm font-medium text-gray-800">
                                ₹ {concession.originalAmount.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Concession</span>
                            <span className="text-sm font-medium text-red-600">
                                - ₹ {concessionAmount.toLocaleString()}{' '}
                                ({concession.concessionType === 'PERCENTAGE'
                                    ? `${concession.concessionValue}%`
                                    : `₹${concession.concessionValue.toLocaleString()} flat`})
                            </span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-2">
                            <span className="text-sm font-semibold text-gray-800">
                                Adjusted Amount
                            </span>
                            <span className="text-base font-bold text-green-700">
                                ₹ {concession.adjustedAmount.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Category</span>
                            <Badge variant="outline">{categoryLabel}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Status</span>
                            <Badge
                                variant="outline"
                                className={`${statusConfig.bgColor} ${statusConfig.color} border-none`}
                            >
                                {statusConfig.label}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Requested By</span>
                            <span className="text-sm text-gray-800">{concession.requestedBy}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Requested At</span>
                            <span className="text-sm text-gray-800">
                                {new Date(concession.requestedAt).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="rounded-lg border bg-amber-50 p-3">
                        <span className="text-xs font-semibold text-gray-600 block mb-1">
                            Reason / Justification
                        </span>
                        <p className="text-sm text-gray-800">{concession.reason}</p>
                    </div>

                    {/* Actions — only show for PENDING concessions */}
                    {concession.status === 'PENDING' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {mode === 'reject'
                                        ? 'Rejection Reason *'
                                        : 'Remarks (optional)'}
                                </label>
                                <Textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder={
                                        mode === 'reject'
                                            ? 'Enter reason for rejection...'
                                            : 'Add any remarks...'
                                    }
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <MyButton
                                    type="button"
                                    scale="small"
                                    buttonType="primary"
                                    onClick={handleApprove}
                                    disabled={isApproving}
                                    className="flex-1"
                                >
                                    <CheckCircle size={16} className="mr-1" />
                                    {isApproving ? 'Approving...' : 'Approve'}
                                </MyButton>
                                <MyButton
                                    type="button"
                                    scale="small"
                                    buttonType="secondary"
                                    onClick={() => {
                                        if (mode === 'reject') {
                                            handleReject();
                                        } else {
                                            setMode('reject');
                                        }
                                    }}
                                    disabled={
                                        isRejecting || (mode === 'reject' && !remarks.trim())
                                    }
                                    className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                                >
                                    <XCircle size={16} className="mr-1" />
                                    {isRejecting
                                        ? 'Rejecting...'
                                        : mode === 'reject'
                                          ? 'Confirm Reject'
                                          : 'Reject'}
                                </MyButton>
                            </div>
                        </>
                    )}

                    {/* Show review details for already reviewed concessions */}
                    {concession.status !== 'PENDING' && concession.reviewedBy && (
                        <div className="rounded-lg border bg-gray-50 p-3 space-y-1">
                            <span className="text-xs font-semibold text-gray-600 block">
                                Review Details
                            </span>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Reviewed By</span>
                                <span className="text-gray-800">{concession.reviewedBy}</span>
                            </div>
                            {concession.reviewedAt && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Reviewed At</span>
                                    <span className="text-gray-800">
                                        {new Date(concession.reviewedAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {concession.reviewRemarks && (
                                <div className="mt-1">
                                    <span className="text-xs text-gray-500">Remarks:</span>
                                    <p className="text-sm text-gray-800">
                                        {concession.reviewRemarks}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ShadDialogContent>
        </ShadDialog>
    );
}
