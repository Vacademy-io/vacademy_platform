// Types for Inventory Management System

export interface InventoryAvailability {
    packageSessionId: string;
    maxSeats: number | null;
    availableSlots: number | null;
    isUnlimited: boolean;
}

export interface UpdateCapacityRequest {
    max_seats: number | null;
    available_slots: number | null;
}

export interface PackageSessionInventory {
    id: string;
    packageName: string;
    levelName: string;
    sessionName: string;
    status: string;
    startTime: string | null;
    // Inventory fields (fetched separately)
    maxSeats?: number | null;
    availableSlots?: number | null;
    isUnlimited?: boolean;
    isLoadingInventory?: boolean;
}

export type ViewMode = 'table' | 'card';

export interface InventoryFilters {
    courseId?: string;
    levelId?: string;
    sessionId?: string;
    availabilityStatus?: 'all' | 'limited' | 'unlimited' | 'low';
}

export interface InventoryStats {
    totalSessions: number;
    unlimitedSessions: number;
    limitedSessions: number;
    lowAvailabilitySessions: number;
    totalCapacity: number;
    totalAvailable: number;
}
