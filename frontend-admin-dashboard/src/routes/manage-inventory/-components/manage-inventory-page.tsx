import { useState, useMemo } from 'react';
import { LayoutGrid, List, Package, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useInstituteFullQuery } from '@/services/student-list-section/getInstituteDetails';
import { InventoryTableView } from './inventory-table-view';
import { InventoryCardView } from './inventory-card-view';
import { InventoryFilters as InventoryFiltersComponent } from './inventory-filters';
import { InventoryStatsCards } from './inventory-stats-cards';
import { useMultipleInventoryAvailability } from '../-hooks/use-inventory-data';
import { InventoryFilters, ViewMode, PackageSessionInventory } from '../-types/inventory-types';

const ManageInventoryPage = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [filters, setFilters] = useState<InventoryFilters>({});

    // Fetch full institute data including batches_for_sessions
    const instituteFullQueryOptions = useInstituteFullQuery();
    const { isLoading: isLoadingInstitute } = useQuery(instituteFullQueryOptions);

    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const batchesForSessions = useMemo(
        () => instituteDetails?.batches_for_sessions || [],
        [instituteDetails?.batches_for_sessions]
    );

    // Get all package session IDs for inventory fetching
    const allPackageSessionIds = useMemo(
        () => batchesForSessions.map((batch) => batch.id),
        [batchesForSessions]
    );

    // Fetch inventory data for all sessions
    const {
        data: inventoryMap,
        isLoading: isLoadingInventory,
        refetch: refetchInventory,
    } = useMultipleInventoryAvailability(allPackageSessionIds);

    // Filter batches based on selected filters
    const filteredBatches = useMemo(() => {
        return batchesForSessions.filter((batch) => {
            if (filters.courseId && batch.package_dto.id !== filters.courseId) {
                return false;
            }
            if (filters.levelId && batch.level.id !== filters.levelId) {
                return false;
            }
            if (filters.sessionId && batch.session.id !== filters.sessionId) {
                return false;
            }

            // Filter by availability status
            if (
                filters.availabilityStatus &&
                filters.availabilityStatus !== 'all' &&
                inventoryMap
            ) {
                const inventory = inventoryMap.get(batch.id);
                if (inventory) {
                    switch (filters.availabilityStatus) {
                        case 'unlimited':
                            if (!inventory.isUnlimited) return false;
                            break;
                        case 'limited':
                            if (inventory.isUnlimited) return false;
                            break;
                        case 'low':
                            if (inventory.isUnlimited) return false;
                            if (inventory.maxSeats && inventory.availableSlots) {
                                const percentage =
                                    (inventory.availableSlots / inventory.maxSeats) * 100;
                                if (percentage > 20) return false;
                            }
                            break;
                    }
                }
            }

            return true;
        });
    }, [batchesForSessions, filters, inventoryMap]);

    // Transform batches into inventory items with inventory data
    const inventoryItems: PackageSessionInventory[] = useMemo(() => {
        return filteredBatches.map((batch) => {
            const inventory = inventoryMap?.get(batch.id);
            return {
                id: batch.id,
                packageName: batch.package_dto.package_name,
                levelName: batch.level.level_name,
                sessionName: batch.session.session_name,
                status: batch.status,
                startTime: batch.start_time,
                maxSeats: inventory?.maxSeats ?? undefined,
                availableSlots: inventory?.availableSlots ?? undefined,
                isUnlimited: inventory?.isUnlimited ?? undefined,
                isLoadingInventory: isLoadingInventory,
            };
        });
    }, [filteredBatches, inventoryMap, isLoadingInventory]);

    // Get available filter options
    const filterOptions = useMemo(() => {
        const courses = new Map<string, string>();
        const levels = new Map<string, string>();
        const sessions = new Map<string, string>();

        batchesForSessions.forEach((batch) => {
            courses.set(batch.package_dto.id, batch.package_dto.package_name);
            levels.set(batch.level.id, batch.level.level_name);
            sessions.set(batch.session.id, batch.session.session_name);
        });

        return {
            courses: Array.from(courses.entries()).map(([id, name]) => ({ id, name })),
            levels: Array.from(levels.entries()).map(([id, name]) => ({ id, name })),
            sessions: Array.from(sessions.entries()).map(([id, name]) => ({ id, name })),
        };
    }, [batchesForSessions]);

    return (
        <div className="container mx-auto space-y-6 py-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 shadow-lg">
                        <Package className="size-6 text-white" />
                    </div>
                    <div>
                        <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-3xl font-bold text-transparent dark:from-white dark:to-gray-400">
                            Manage Inventory
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage seats and capacity for your package sessions
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchInventory()}
                        disabled={isLoadingInventory}
                        className="gap-2"
                    >
                        <RefreshCw
                            className={`size-4 ${isLoadingInventory ? 'animate-spin' : ''}`}
                        />
                        Refresh
                    </Button>

                    {/* View Toggle */}
                    <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                        <Button
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('table')}
                            className="gap-2"
                        >
                            <List className="size-4" />
                            Table
                        </Button>
                        <Button
                            variant={viewMode === 'card' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('card')}
                            className="gap-2"
                        >
                            <LayoutGrid className="size-4" />
                            Cards
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <InventoryStatsCards inventoryItems={inventoryItems} isLoading={isLoadingInventory} />

            {/* Filters */}
            <InventoryFiltersComponent
                filters={filters}
                onFiltersChange={setFilters}
                filterOptions={filterOptions}
            />

            {/* Content */}
            {isLoadingInstitute ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="text-primary mb-4 size-12 animate-spin" />
                    <p className="text-muted-foreground">Loading package sessions...</p>
                </div>
            ) : batchesForSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 rounded-full bg-muted p-4">
                        <Package className="size-12 text-muted-foreground" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                        No Package Sessions Found
                    </h3>
                    <p className="max-w-md text-muted-foreground">
                        You don&apos;t have any package sessions configured yet. Create package
                        sessions to manage their inventory.
                    </p>
                </div>
            ) : viewMode === 'table' ? (
                <InventoryTableView items={inventoryItems} isLoading={isLoadingInventory} />
            ) : (
                <InventoryCardView items={inventoryItems} isLoading={isLoadingInventory} />
            )}
        </div>
    );
};

export default ManageInventoryPage;
