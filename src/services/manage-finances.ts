import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { FeeSearchFilterDTO, FinancalManagementPaginatedResponse } from '@/types/manage-finances';

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

    const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';

    const response = await authenticatedAxiosInstance.post<FinancalManagementPaginatedResponse>(
        `${BASE_URL}/admin-core-service/v1/admin/student-fee/search`,
        filter,
        {
            params: { instituteId },
        }
    );
    return response.data;
};
