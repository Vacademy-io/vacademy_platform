import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    FeeSearchFilterDTO,
    FinancalManagementPaginatedResponse,
    InstallmentDetailDTO,
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
