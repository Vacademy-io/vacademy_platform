import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getInventoryAvailability,
    updateInventoryCapacity,
    reserveInventorySlot,
    releaseInventorySlot,
    getMultipleInventoryAvailability,
} from '../-services/inventory-service';
import { InventoryAvailability } from '../-types/inventory-types';

/**
 * Hook to fetch availability for a single package session
 */
export const useInventoryAvailability = (packageSessionId: string | undefined) => {
    return useQuery<InventoryAvailability>({
        queryKey: ['inventoryAvailability', packageSessionId],
        queryFn: () =>
            packageSessionId
                ? getInventoryAvailability(packageSessionId)
                : Promise.reject('No package session ID'),
        enabled: !!packageSessionId,
        staleTime: 1000 * 30, // 30 seconds
        retry: 2,
    });
};

/**
 * Hook to fetch availability for multiple package sessions
 */
export const useMultipleInventoryAvailability = (packageSessionIds: string[]) => {
    return useQuery<Map<string, InventoryAvailability>>({
        queryKey: ['inventoryAvailabilityBatch', packageSessionIds],
        queryFn: () => getMultipleInventoryAvailability(packageSessionIds),
        enabled: packageSessionIds.length > 0,
        staleTime: 1000 * 30, // 30 seconds
        retry: 1,
    });
};

/**
 * Hook to update capacity for a package session
 */
export const useUpdateCapacity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ packageSessionId, maxSeats, availableSlots }: { packageSessionId: string; maxSeats: number | null; availableSlots: number | null }) =>
            updateInventoryCapacity(packageSessionId, maxSeats, availableSlots),
        onSuccess: (_, variables) => {
            // Invalidate both single and batch queries
            queryClient.invalidateQueries({ queryKey: ['inventoryAvailability', variables.packageSessionId] });
            queryClient.invalidateQueries({ queryKey: ['inventoryAvailabilityBatch'] });
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
        onSuccess: (_, packageSessionId) => {
            queryClient.invalidateQueries({ queryKey: ['inventoryAvailability', packageSessionId] });
            queryClient.invalidateQueries({ queryKey: ['inventoryAvailabilityBatch'] });
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
        onSuccess: (_, packageSessionId) => {
            queryClient.invalidateQueries({ queryKey: ['inventoryAvailability', packageSessionId] });
            queryClient.invalidateQueries({ queryKey: ['inventoryAvailabilityBatch'] });
        },
    });
};
