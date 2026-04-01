// TODO: revert to imports from '@/constants/urls' before merging
// import { PAGINATED_BATCHES, BATCHES_SUMMARY } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    InventoryAvailability,
    UpdateCapacityRequest,
    PaginatedBatchesResponse,
    BatchAvailabilityMap,
    BatchesSummaryResponse,
    InventoryFilters,
    InventoryStats,
} from '../-types/inventory-types';

// TODO: revert to BASE_URL and imports before merging
const LOCAL_BASE = 'http://localhost:8072';
const PAGINATED_BATCHES = `${LOCAL_BASE}/admin-core-service/institute/v1/paginated-batches`;
const BATCHES_SUMMARY = `${LOCAL_BASE}/admin-core-service/institute/v1/batches-summary`;

/**
 * Base URL for inventory management endpoints
 */
const INVENTORY_BASE = (packageSessionId: string) =>
    `${LOCAL_BASE}/admin-core-service/package-session/${packageSessionId}/inventory`;

/**
 * Get availability for a specific package session
 */
export const getInventoryAvailability = async (
    packageSessionId: string
): Promise<InventoryAvailability> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${INVENTORY_BASE(packageSessionId)}/availability`,
    });
    return response.data;
};

/**
 * Update capacity (max_seats) for a package session
 * Pass null for unlimited capacity
 */
export const updateInventoryCapacity = async (
    packageSessionId: string,
    maxSeats: number | null,
    availableSlots: number | null
): Promise<any> => {
    const payload: UpdateCapacityRequest = { max_seats: maxSeats, available_slots: availableSlots };
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${INVENTORY_BASE(packageSessionId)}/update-capacity`,
        data: payload,
    });
    return response.data;
};

/**
 * Reserve a slot for a package session
 */
export const reserveInventorySlot = async (packageSessionId: string): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${INVENTORY_BASE(packageSessionId)}/reserve`,
    });
    return response.data;
};

/**
 * Release a slot for a package session
 */
export const releaseInventorySlot = async (packageSessionId: string): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${INVENTORY_BASE(packageSessionId)}/release`,
    });
    return response.data;
};

/**
 * Fetch paginated batches for the current institute
 */
export const fetchPaginatedBatches = async (
    filters: InventoryFilters,
    page: number,
    size: number
): Promise<PaginatedBatchesResponse> => {
    const instituteId = getCurrentInstituteId();

    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('size', String(size));

    if (filters.courseId) params.append('packageId', filters.courseId);
    if (filters.levelId) params.append('levelId', filters.levelId);
    if (filters.sessionId) params.append('sessionId', filters.sessionId);
    if (filters.search) params.append('search', filters.search);
    params.append('statuses', 'ACTIVE');
    params.append('sortBy', 'package_name');
    params.append('sortDirection', 'ASC');

    const response = await authenticatedAxiosInstance<PaginatedBatchesResponse>({
        method: 'GET',
        url: `${PAGINATED_BATCHES}/${instituteId}?${params.toString()}`,
    });

    return response.data;
};

/**
 * Fetch inventory availability for multiple package sessions in one call
 */
export const fetchBatchInventoryAvailability = async (
    packageSessionIds: string[]
): Promise<BatchAvailabilityMap> => {
    if (packageSessionIds.length === 0) return {};

    const response = await authenticatedAxiosInstance<BatchAvailabilityMap>({
        method: 'POST',
        url: `${LOCAL_BASE}/admin-core-service/package-session/inventory/batch-availability`,
        data: packageSessionIds,
    });

    return response.data;
};

/**
 * Fetch batches summary for filter dropdowns
 */
export const fetchBatchesSummary = async (): Promise<BatchesSummaryResponse> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<BatchesSummaryResponse>({
        method: 'GET',
        url: `${BATCHES_SUMMARY}/${instituteId}`,
    });

    return response.data;
};

/**
 * Fetch aggregated inventory stats for the entire institute
 */
export const fetchInventoryStats = async (): Promise<InventoryStats> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<InventoryStats>({
        method: 'GET',
        url: `${LOCAL_BASE}/admin-core-service/package-session/inventory/stats`,
        params: { instituteId },
    });

    return response.data;
};
