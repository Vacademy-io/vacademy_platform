import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    updateInventoryCapacity,
    reserveInventorySlot,
    releaseInventorySlot,
    fetchPaginatedBatches,
    fetchBatchInventoryAvailability,
    fetchBatchesSummary,
    fetchInventoryStats,
} from '../-services/inventory-service';
import {
    PaginatedBatchesResponse,
    BatchAvailabilityMap,
    BatchesSummaryResponse,
    InventoryFilters,
    InventoryStats,
} from '../-types/inventory-types';

/**
 * Hook to fetch paginated batches with server-side filtering
 */
export const usePaginatedBatches = (filters: InventoryFilters, page: number, size: number) => {
    return useQuery<PaginatedBatchesResponse>({
        queryKey: ['paginatedBatches', filters, page, size],
        queryFn: () => fetchPaginatedBatches(filters, page, size),
        staleTime: 1000 * 30,
    });
};

/**
 * Hook to fetch inventory availability for a list of package session IDs in one call
 */
export const useBatchInventoryAvailability = (packageSessionIds: string[]) => {
    return useQuery<BatchAvailabilityMap>({
        queryKey: ['batchInventoryAvailability', packageSessionIds],
        queryFn: () => fetchBatchInventoryAvailability(packageSessionIds),
        enabled: packageSessionIds.length > 0,
        staleTime: 1000 * 30,
    });
};

/**
 * Hook to fetch batches summary for filter dropdowns
 */
export const useBatchesSummary = () => {
    return useQuery<BatchesSummaryResponse>({
        queryKey: ['batchesSummary'],
        queryFn: fetchBatchesSummary,
        staleTime: 1000 * 60 * 5, // 5 minutes — filter options don't change often
    });
};

/**
 * Hook to fetch aggregated inventory stats for the entire institute
 */
export const useInventoryStats = () => {
    return useQuery<InventoryStats>({
        queryKey: ['inventoryStats'],
        queryFn: fetchInventoryStats,
        staleTime: 1000 * 30,
    });
};

/**
 * Hook to update capacity for a package session
 */
export const useUpdateCapacity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            packageSessionId,
            maxSeats,
            availableSlots,
        }: {
            packageSessionId: string;
            maxSeats: number | null;
            availableSlots: number | null;
        }) => updateInventoryCapacity(packageSessionId, maxSeats, availableSlots),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['batchInventoryAvailability'] });
            queryClient.invalidateQueries({ queryKey: ['inventoryStats'] });
        },
    });
};

/**
 * Hook to reserve a slot for a package session
 */
export const useReserveSlot = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (packageSessionId: string) => reserveInventorySlot(packageSessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['batchInventoryAvailability'] });
            queryClient.invalidateQueries({ queryKey: ['inventoryStats'] });
        },
    });
};

/**
 * Hook to release a slot for a package session
 */
export const useReleaseSlot = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (packageSessionId: string) => releaseInventorySlot(packageSessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['batchInventoryAvailability'] });
            queryClient.invalidateQueries({ queryKey: ['inventoryStats'] });
        },
    });
};
