import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    FeeSearchFilterDTO,
    FinancalManagementPaginatedResponse,
    InstallmentDetailDTO,
    StudentFeeDueDTO,
    AllocateSelectedRequest,
} from '@/types/manage-finances';
import { BASE_URL, NOTIFICATION_SERVICE_BASE } from '@/constants/urls';

// ─── Fee Types for Institute ───────────────────────────────────────────────

export interface FeeTypeOption {
    id: string;
    name: string;
}

export const getFeeTypesQueryKey = () => ['FEE_TYPES_FOR_INSTITUTE'];

export const fetchFeeTypesForInstitute = async (): Promise<FeeTypeOption[]> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found');

    const response = await authenticatedAxiosInstance.get<FeeTypeOption[]>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/fee-types`,
        { params: { instituteId } }
    );
    return response.data;
};

// ─── Main Table Search ──────────────────────────────────────────────────────

export const getManageFinancesQueryKey = (filter: FeeSearchFilterDTO) => [
    'MANAGE_FINANCES_LOGS',
    filter.page,
    filter.size,
    JSON.stringify(filter.filters),
    filter.sortBy,
    filter.sortDirection,
];

export const fetchManageFinancesLogs = async (
    filter: FeeSearchFilterDTO
): Promise<FinancalManagementPaginatedResponse> => {
    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const response = await authenticatedAxiosInstance.post<FinancalManagementPaginatedResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/search`,
        filter,
        {
            params: { instituteId },
        }
    );
    return response.data;
};

// ─── Installment Details (Popup) ────────────────────────────────────────────

export const getInstallmentDetailsQueryKey = (studentId: string, cpoId: string) => [
    'INSTALLMENT_DETAILS',
    studentId,
    cpoId,
];

export const fetchInstallmentDetails = async (
    studentId: string,
    cpoId: string
): Promise<InstallmentDetailDTO[]> => {
    const response = await authenticatedAxiosInstance.get<InstallmentDetailDTO[]>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/payment-details`,
        {
            params: { studentId, cpoId },
        }
    );
    return response.data;
};

// ─── Student Dues (Pay Installments) ───────────────────────────────────────

export const getStudentDuesQueryKey = (userId: string) => ['STUDENT_DUES', userId];

export const fetchStudentDues = async (userId: string): Promise<StudentFeeDueDTO[]> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found');

    const response = await authenticatedAxiosInstance.post<StudentFeeDueDTO[]>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/${userId}/dues`,
        {},
        { params: { instituteId } }
    );
    return response.data;
};

// ─── Allocate Selected Payment ─────────────────────────────────────────────

export interface ReceiptLineItem {
    fee_type_name: string | null;
    cpo_name: string | null;
    due_date: string | null;
    amount_expected: number;
    amount_paid: number;
    balance: number;
    status: string;
}

export interface AllocatePaymentResponse {
    invoice_id?: string;
    receipt_number?: string;
    receipt_date?: string;
    download_url?: string;
    payment_mode?: string;
    transaction_id?: string;
    line_items?: ReceiptLineItem[];
    total_expected?: number;
    total_paid?: number;
    balance_due?: number;
    amount_paid_now?: number;
}

export const allocateSelectedPayment = async (
    userId: string,
    body: AllocateSelectedRequest
): Promise<AllocatePaymentResponse> => {
    const response = await authenticatedAxiosInstance.post<AllocatePaymentResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/${userId}/allocate-selected`,
        body
    );
    return response.data;
};

// ─── Adjustment APIs (submit / review / retract / pending) ────────────────

export interface AdjustmentSubmitRequest {
    student_fee_payment_id: string;
    user_id: string;
    adjustment_amount: number;
    adjustment_type: 'CONCESSION' | 'PENALTY';
    adjustment_reason?: string;
}

export interface AdjustmentResponse {
    student_fee_payment_id: string;
    user_id: string;
    adjustment_amount: number;
    adjustment_type: string | null;
    adjustment_status: string | null;
    adjustment_reason: string | null;
    status: string;
    amount_due: number;
}

export const submitAdjustment = async (
    body: AdjustmentSubmitRequest
): Promise<AdjustmentResponse> => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance.patch<AdjustmentResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/adjustment/submit`,
        body,
        { params: { instituteId } }
    );
    return response.data;
};

export interface AdjustmentReviewRequest {
    student_fee_payment_id: string;
    action: 'APPROVED' | 'REJECTED';
}

export const reviewAdjustment = async (
    body: AdjustmentReviewRequest
): Promise<AdjustmentResponse> => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance.patch<AdjustmentResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/adjustment/review`,
        body,
        { params: { instituteId } }
    );
    return response.data;
};

export interface AdjustmentRetractRequest {
    student_fee_payment_id: string;
}

export const retractAdjustment = async (
    body: AdjustmentRetractRequest
): Promise<AdjustmentResponse> => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance.patch<AdjustmentResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/adjustment/retract`,
        body,
        { params: { instituteId } }
    );
    return response.data;
};

export const getPendingAdjustmentsQueryKey = () => ['PENDING_ADJUSTMENTS'];

export const fetchPendingAdjustments = async (): Promise<StudentFeeDueDTO[]> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found');

    const response = await authenticatedAxiosInstance.post<StudentFeeDueDTO[]>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/adjustment/pending`,
        {},
        { params: { instituteId } }
    );
    return response.data;
};

// ─── Fee Adjustment Settings ──────────────────────────────────────────────

export const fetchFeeAdjustmentSettings = async (): Promise<{ approvalRoles?: string[] }> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found');

    const response = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/institute/setting/v1/get`,
        { params: { instituteId, settingKey: 'FEE_ADJUSTMENT_SETTINGS' } }
    );
    return response.data?.data ?? {};
};

// ─── Generate Invoice for Selected Installments ────────────────────────────

export interface GenerateInvoiceResponse {
    file_id: string;
    download_url: string;
}

export const generateInvoiceForInstallments = async (
    userId: string,
    installmentIds: string[]
): Promise<GenerateInvoiceResponse> => {
    const instituteId = getInstituteId();
    if (!instituteId) throw new Error('Institute ID not found');

    const response = await authenticatedAxiosInstance.post<GenerateInvoiceResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/${userId}/generate-invoice`,
        { installment_ids: installmentIds },
        { params: { instituteId } }
    );
    return response.data;
};

// ─── Receipt URL for a specific paid installment ───────────────────────────

export interface InstallmentReceiptResponse {
    invoice_id: string;
    receipt_number: string;
    download_url: string;
}

export const getReceiptUrlForInstallment = async (
    installmentId: string
): Promise<InstallmentReceiptResponse> => {
    const response = await authenticatedAxiosInstance.get<InstallmentReceiptResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/installment/${installmentId}/receipt-url`
    );
    return response.data;
};

// ─── Email Helpers ──────────────────────────────────────────────────────────

const DEFAULT_PRIMARY_COLOR = '#ED7424';

const buildEmailHtml = (opts: {
    title: string;
    greeting: string;
    message: string;
    buttonLabel: string;
    buttonUrl: string;
    primaryColor?: string;
}) => {
    const color = opts.primaryColor || DEFAULT_PRIMARY_COLOR;
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin-bottom: 8px;">${opts.title}</h2>
            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6;">
                Dear <strong>${opts.greeting}</strong>,
            </p>
            <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6;">
                ${opts.message}
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${opts.buttonUrl}" target="_blank"
                   style="display: inline-block; padding: 12px 32px; background-color: ${color}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    ${opts.buttonLabel}
                </a>
            </div>
            <p style="color: #888; font-size: 13px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
                This is an auto-generated email. Please do not reply.
            </p>
        </div>
    `.trim();
};

// ─── Send Invoice Email ─────────────────────────────────────────────────────

export const sendInvoiceEmail = async (
    email: string,
    studentName: string,
    downloadUrl: string,
    primaryColor?: string
): Promise<void> => {
    const htmlBody = buildEmailHtml({
        title: 'Fee Invoice',
        greeting: studentName,
        message: 'Please find your fee invoice below. You can download it by clicking the button.',
        buttonLabel: 'Download Invoice',
        buttonUrl: downloadUrl,
        primaryColor,
    });

    await authenticatedAxiosInstance.post(`${NOTIFICATION_SERVICE_BASE}/send`, {
        instituteId: '',
        channel: 'EMAIL',
        recipients: [{ email }],
        options: {
            emailSubject: `Fee Invoice - ${studentName}`,
            emailBody: htmlBody,
            emailType: 'UTILITY_EMAIL',
            source: 'fee-invoice',
        },
    });
};

// ─── Send Payment Link Email ────────────────────────────────────────────────

export const sendPaymentLinkEmail = async (
    email: string,
    recipientName: string,
    paymentLink: string,
    feeName: string,
    amount: number,
    currency: string,
    primaryColor?: string
): Promise<void> => {
    const currencySymbol = currency === 'INR' ? '₹' : currency;
    const htmlBody = buildEmailHtml({
        title: 'Application Fee Payment',
        greeting: recipientName,
        message: `Please complete the payment of <strong>${currencySymbol}${amount.toLocaleString('en-IN')}</strong> for <strong>${feeName}</strong> by clicking the button below.`,
        buttonLabel: 'Pay Now',
        buttonUrl: paymentLink,
        primaryColor,
    });

    await authenticatedAxiosInstance.post(`${NOTIFICATION_SERVICE_BASE}/send`, {
        instituteId: '',
        channel: 'EMAIL',
        recipients: [{ email }],
        options: {
            emailSubject: `Payment Link - ${feeName}`,
            emailBody: htmlBody,
            emailType: 'UTILITY_EMAIL',
            source: 'payment-link',
        },
    });
};
// ─── Collection Dashboard ──────────────────────────────────────────────────

export interface DashboardCollectionRequest {
    instituteId: string;
    sessionId: string;
    feeTypeIds: string[];
}

export interface DashboardCollectionResponse {
    projectedRevenue: number;
    expectedToDate: number;
    collectedToDate: number;
    totalOverdue: number;
    classWiseBreakdown: Array<{
        packageSessionId: string;
        className: string;
        projectedRevenue: number;
        expectedToDate: number;
        collectedToDate: number;
        overdue: number;
    }>;
    paymentModeBreakdown: Array<{
        vendor: string;
        amount: number;
    }>;
}

export const getCollectionDashboardQueryKey = (req: DashboardCollectionRequest) => ['collection-dashboard', req];

export const fetchDashboardCollectionData = async (
    req: DashboardCollectionRequest
): Promise<DashboardCollectionResponse> => {
    const response = await authenticatedAxiosInstance.post(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/dashboard/collection`,
        req
    );
    return response.data;
};
