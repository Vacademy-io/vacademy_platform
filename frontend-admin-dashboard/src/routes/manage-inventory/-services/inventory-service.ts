import { BASE_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { InventoryAvailability, UpdateCapacityRequest } from '../-types/inventory-types';

/**
 * Base URL for inventory management endpoints
 */
const INVENTORY_BASE = (packageSessionId: string) =>
    `${BASE_URL}/admin-core-service/package-session/${packageSessionId}/inventory`;

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
 * Batch fetch availability for multiple package sessions
 */
export const getMultipleInventoryAvailability = async (
    packageSessionIds: string[]
): Promise<Map<string, InventoryAvailability>> => {
    const results = new Map<string, InventoryAvailability>();

    // Fetch in parallel with error handling for individual failures
    const promises = packageSessionIds.map(async (id) => {
        try {
            const availability = await getInventoryAvailability(id);
            return { id, availability, error: null };
        } catch (error) {
            console.warn(`Failed to fetch inventory for session ${id}:`, error);
            return { id, availability: null, error };
        }
    });

    const responses = await Promise.all(promises);

    responses.forEach(({ id, availability }) => {
        if (availability) {
            results.set(id, availability);
        }
    });

    return results;
};
