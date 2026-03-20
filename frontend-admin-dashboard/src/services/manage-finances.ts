import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    FeeSearchFilterDTO,
    FinancalManagementPaginatedResponse,
    InstallmentDetailDTO,
    StudentFeeDueDTO,
    AllocateSelectedRequest,
} from '@/types/manage-finances';
import { BASE_URL } from '@/constants/urls';

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

export const allocateSelectedPayment = async (
    userId: string,
    body: AllocateSelectedRequest
): Promise<void> => {
    await authenticatedAxiosInstance.post(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/${userId}/allocate-selected`,
        body
    );
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
