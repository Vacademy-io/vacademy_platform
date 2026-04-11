import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MyButton } from '@/components/design-system/button';
import { CheckCircle, Clock, Eye, XCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import {
    ConcessionRequest,
    ConcessionStatus,
    CONCESSION_CATEGORIES,
    CONCESSION_STATUS_CONFIG,
} from '../-types/fee-concession-types';
import { ConcessionReviewDialog } from '../admission-form/-components/steps/Step5AFeeAssignment/ConcessionReviewDialog';

// Mock data until backend APIs are ready
const MOCK_CONCESSIONS: ConcessionRequest[] = [
    // Pending
    {
        id: 'conc_1',
        feeId: 'f1',
        feeName: 'Tuition Fee',
        originalAmount: 50000,
        concessionType: 'PERCENTAGE',
        concessionValue: 20,
        adjustedAmount: 40000,
        reason: 'Sibling already enrolled in Class 5. Family qualifies for sibling discount as per institute policy.',
        category: 'SIBLING_DISCOUNT',
        status: 'PENDING',
        requestedBy: 'Admin User',
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        studentName: 'Rahul Sharma',
        academicYear: '2025-26',
    },
    {
        id: 'conc_2',
        feeId: 'f2',
        feeName: 'Bus Fee',
        originalAmount: 12000,
        concessionType: 'FIXED',
        concessionValue: 5000,
        adjustedAmount: 7000,
        reason: 'Father is a staff member (Teaching Dept). Eligible for staff ward concession on transport.',
        category: 'STAFF_WARD',
        status: 'PENDING',
        requestedBy: 'Admin User',
        requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        studentName: 'Priya Patel',
        academicYear: '2025-26',
    },
    {
        id: 'conc_3',
        feeId: 'f1',
        feeName: 'Tuition Fee',
        originalAmount: 50000,
        concessionType: 'PERCENTAGE',
        concessionValue: 50,
        adjustedAmount: 25000,
        reason: 'Student scored 98% in previous board exam. Qualifies for merit-based scholarship.',
        category: 'MERIT_SCHOLARSHIP',
        status: 'PENDING',
        requestedBy: 'Admin User',
        requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        studentName: 'Ananya Gupta',
        academicYear: '2025-26',
    },
    // Historical - Approved
    {
        id: 'conc_4',
        feeId: 'f1',
        feeName: 'Tuition Fee',
        originalAmount: 50000,
        concessionType: 'PERCENTAGE',
        concessionValue: 15,
        adjustedAmount: 42500,
        reason: 'Single parent household. Financial hardship documented.',
        category: 'FINANCIAL_HARDSHIP',
        status: 'APPROVED',
        requestedBy: 'Admin User',
        requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: 'Principal Singh',
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        reviewRemarks: 'Verified documentation. Approved as per financial hardship policy.',
        studentName: 'Vikram Mehta',
        academicYear: '2025-26',
    },
    // Historical - Rejected
    {
        id: 'conc_5',
        feeId: 'f2',
        feeName: 'Lab Fee',
        originalAmount: 8000,
        concessionType: 'FIXED',
        concessionValue: 8000,
        adjustedAmount: 0,
        reason: 'Requesting full waiver of lab fee.',
        category: 'OTHER',
        status: 'REJECTED',
        requestedBy: 'Admin User',
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: 'Principal Singh',
        reviewedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        reviewRemarks: 'Full waiver not applicable. Student may reapply with partial concession.',
        studentName: 'Neha Reddy',
        academicYear: '2025-26',
    },
    // Historical - Approved
    {
        id: 'conc_6',
        feeId: 'f1',
        feeName: 'Tuition Fee',
        originalAmount: 50000,
        concessionType: 'PERCENTAGE',
        concessionValue: 10,
        adjustedAmount: 45000,
        reason: 'Elder sibling in Class 10. Sibling discount applicable.',
        category: 'SIBLING_DISCOUNT',
        status: 'APPROVED',
        requestedBy: 'Admin User',
        requestedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: 'Finance Head Joshi',
        reviewedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        reviewRemarks: 'Approved. Sibling enrollment verified.',
        studentName: 'Arjun Desai',
        academicYear: '2025-26',
    },
];

type TabValue = 'pending' | 'approved' | 'rejected';

export const PendingConcessionsPanel: React.FC = () => {
    const [selectedConcession, setSelectedConcession] = useState<ConcessionRequest | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [concessions, setConcessions] = useState<ConcessionRequest[]>(MOCK_CONCESSIONS);
    const [activeTab, setActiveTab] = useState<TabValue>('pending');

    const handleReview = (concession: ConcessionRequest) => {
        setSelectedConcession(concession);
        setIsReviewOpen(true);
    };

    const handleApprove = (concessionId: string, remarks?: string) => {
        setConcessions((prev) =>
            prev.map((c) =>
                c.id === concessionId
                    ? {
                          ...c,
                          status: 'APPROVED' as const,
                          reviewedBy: 'Principal Singh',
                          reviewedAt: new Date().toISOString(),
                          reviewRemarks: remarks || undefined,
                      }
                    : c
            )
        );
        setIsReviewOpen(false);
        setSelectedConcession(null);
        toast.success('Concession approved successfully', {
            description: remarks ? `Remarks: ${remarks}` : undefined,
        });
    };

    const handleReject = (concessionId: string, reason: string) => {
        setConcessions((prev) =>
            prev.map((c) =>
                c.id === concessionId
                    ? {
                          ...c,
                          status: 'REJECTED' as const,
                          reviewedBy: 'Principal Singh',
                          reviewedAt: new Date().toISOString(),
                          reviewRemarks: reason,
                      }
                    : c
            )
        );
        setIsReviewOpen(false);
        setSelectedConcession(null);
        toast.success('Concession rejected', {
            description: `Reason: ${reason}`,
        });
    };

    const pendingConcessions = concessions.filter((c) => c.status === 'PENDING');
    const approvedConcessions = concessions.filter((c) => c.status === 'APPROVED');
    const rejectedConcessions = concessions.filter((c) => c.status === 'REJECTED');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-semibold">Fee Concession Approvals</h2>
                <p className="text-gray-600">
                    Review and approve fee concession requests from admissions
                </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
                <TabsList>
                    <TabsTrigger value="pending" className="gap-2">
                        <Clock size={16} />
                        Pending
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                            {pendingConcessions.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="gap-2">
                        <CheckCircle size={16} />
                        Approved
                        <Badge className="ml-1 h-5 bg-green-100 px-1.5 text-xs text-green-700">
                            {approvedConcessions.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="gap-2">
                        <XCircle size={16} />
                        Rejected
                        <Badge className="ml-1 h-5 bg-red-100 px-1.5 text-xs text-red-700">
                            {rejectedConcessions.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                {/* Pending Tab */}
                <TabsContent value="pending" className="mt-4">
                    {pendingConcessions.length === 0 ? (
                        <EmptyState
                            icon={<CheckCircle size={48} className="mb-4 text-green-500" />}
                            message="All caught up! No fee concession requests pending approval."
                        />
                    ) : (
                        <ConcessionTable
                            concessions={pendingConcessions}
                            headerBg="bg-amber-50"
                            showActions
                            onReview={handleReview}
                        />
                    )}
                </TabsContent>

                {/* Approved Tab */}
                <TabsContent value="approved" className="mt-4">
                    {approvedConcessions.length === 0 ? (
                        <EmptyState
                            icon={<CheckCircle size={48} className="mb-4 text-gray-300" />}
                            message="No approved concessions yet."
                        />
                    ) : (
                        <ConcessionTable
                            concessions={approvedConcessions}
                            headerBg="bg-green-50"
                            showReviewInfo
                        />
                    )}
                </TabsContent>

                {/* Rejected Tab */}
                <TabsContent value="rejected" className="mt-4">
                    {rejectedConcessions.length === 0 ? (
                        <EmptyState
                            icon={<XCircle size={48} className="mb-4 text-gray-300" />}
                            message="No rejected concessions."
                        />
                    ) : (
                        <ConcessionTable
                            concessions={rejectedConcessions}
                            headerBg="bg-red-50"
                            showReviewInfo
                            showRejectionReason
                        />
                    )}
                </TabsContent>
            </Tabs>

            {/* Review Dialog */}
            {selectedConcession && (
                <ConcessionReviewDialog
                    open={isReviewOpen}
                    onOpenChange={setIsReviewOpen}
                    concession={selectedConcession}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
            )}
        </div>
    );
};

// --- Sub-components ---

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
    <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
            {icon}
            <p className="text-gray-600">{message}</p>
        </CardContent>
    </Card>
);

interface ConcessionTableProps {
    concessions: ConcessionRequest[];
    headerBg: string;
    showActions?: boolean;
    showReviewInfo?: boolean;
    showRejectionReason?: boolean;
    onReview?: (concession: ConcessionRequest) => void;
}

const ConcessionTable: React.FC<ConcessionTableProps> = ({
    concessions,
    headerBg,
    showActions,
    showReviewInfo,
    showRejectionReason,
    onReview,
}) => (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left text-sm">
            <thead className={`${headerBg} border-b`}>
                <tr>
                    <th className="px-4 py-3 font-semibold text-gray-600">Student</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Fee Type</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Original</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Concession</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Adjusted</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Category</th>
                    {showActions && (
                        <>
                            <th className="px-4 py-3 font-semibold text-gray-600">Requested</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 text-right">
                                Actions
                            </th>
                        </>
                    )}
                    {showRejectionReason && (
                        <th className="px-4 py-3 font-semibold text-gray-600">Reason</th>
                    )}
                    {showReviewInfo && (
                        <th className="px-4 py-3 font-semibold text-gray-600">Reviewed</th>
                    )}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {concessions.map((concession) => {
                    const categoryLabel =
                        CONCESSION_CATEGORIES.find((c) => c.value === concession.category)
                            ?.label || concession.category;
                    const concessionAmount =
                        concession.originalAmount - concession.adjustedAmount;

                    return (
                        <tr key={concession.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                                {concession.studentName || '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{concession.feeName}</td>
                            <td className="px-4 py-3 text-gray-700">
                                ₹ {concession.originalAmount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-red-600 font-medium">
                                - ₹ {concessionAmount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-green-700 font-semibold">
                                ₹ {concession.adjustedAmount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">
                                    {categoryLabel}
                                </Badge>
                            </td>
                            {showActions && (
                                <>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {formatDistanceToNow(
                                                new Date(concession.requestedAt),
                                                { addSuffix: true }
                                            )}
                                        </div>
                                        <span className="text-gray-400">
                                            by {concession.requestedBy}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <MyButton
                                            onClick={() => onReview?.(concession)}
                                            buttonType="secondary"
                                            scale="small"
                                        >
                                            <Eye size={14} className="mr-1" />
                                            Review
                                        </MyButton>
                                    </td>
                                </>
                            )}
                            {showRejectionReason && (
                                <td className="px-4 py-3 text-sm text-red-700 max-w-[300px]">
                                    {concession.reviewRemarks || '-'}
                                </td>
                            )}
                            {showReviewInfo && (
                                <td className="px-4 py-3 text-xs text-gray-500">
                                    {concession.reviewedAt && (
                                        <>
                                            <div>
                                                {format(
                                                    new Date(concession.reviewedAt),
                                                    'dd MMM yyyy, hh:mm a'
                                                )}
                                            </div>
                                            <div className="text-gray-400">
                                                by {concession.reviewedBy}
                                            </div>
                                        </>
                                    )}
                                </td>
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);
