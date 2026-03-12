import { z } from 'zod';

// Concession Types
export type ConcessionType = 'PERCENTAGE' | 'FIXED';
export type ConcessionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ConcessionCategory =
    | 'SIBLING_DISCOUNT'
    | 'STAFF_WARD'
    | 'MERIT_SCHOLARSHIP'
    | 'FINANCIAL_HARDSHIP'
    | 'OTHER';

export const CONCESSION_CATEGORIES: { value: ConcessionCategory; label: string }[] = [
    { value: 'SIBLING_DISCOUNT', label: 'Sibling Discount' },
    { value: 'STAFF_WARD', label: 'Staff Ward' },
    { value: 'MERIT_SCHOLARSHIP', label: 'Merit Scholarship' },
    { value: 'FINANCIAL_HARDSHIP', label: 'Financial Hardship' },
    { value: 'OTHER', label: 'Other' },
];

export const CONCESSION_STATUS_CONFIG: Record<
    ConcessionStatus,
    { label: string; color: string; bgColor: string }
> = {
    PENDING: { label: 'Pending Approval', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    APPROVED: { label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-100' },
    REJECTED: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// Concession Request Interface
export interface ConcessionRequest {
    id: string;
    feeId: string;
    feeName: string;
    originalAmount: number;
    concessionType: ConcessionType;
    concessionValue: number;
    adjustedAmount: number;
    reason: string;
    category: ConcessionCategory;
    status: ConcessionStatus;
    requestedBy: string;
    requestedAt: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewRemarks?: string;
    registrationId?: string;
    studentName?: string;
    academicYear?: string;
    cpoId?: string;
    cpoStatus?: 'ACTIVE' | 'PENDING_APPROVAL';
}

// Zod schema for ConcessionDialog form validation
export const concessionFormSchema = z
    .object({
        concessionType: z.enum(['PERCENTAGE', 'FIXED']),
        concessionValue: z.number().min(1, 'Value must be at least 1'),
        reason: z.string().min(1, 'Reason is required'),
        category: z.enum([
            'SIBLING_DISCOUNT',
            'STAFF_WARD',
            'MERIT_SCHOLARSHIP',
            'FINANCIAL_HARDSHIP',
            'OTHER',
        ]),
    })
    .refine(
        (data) => {
            if (data.concessionType === 'PERCENTAGE') {
                return data.concessionValue <= 100;
            }
            return true;
        },
        {
            message: 'Percentage cannot exceed 100',
            path: ['concessionValue'],
        }
    );

export type ConcessionFormValues = z.infer<typeof concessionFormSchema>;
