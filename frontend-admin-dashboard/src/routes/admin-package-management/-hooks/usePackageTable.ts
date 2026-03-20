import { useQuery } from '@tanstack/react-query';
import { fetchPaginatedBatches, fetchBatchesSummary } from '../-services/package-service';
import { PackageFilterRequest } from '../-types/package-types';

export const usePackageTable = (filters: PackageFilterRequest) => {
    const {
        data: packageData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['paginated-batches', filters],
        queryFn: () => fetchPaginatedBatches(filters),
        staleTime: 60000,
    });

    return {
        packageData,
        isLoading,
        error,
        refetch,
    };
};

export const useBatchesSummary = (statuses?: string[]) => {
    const {
        data: summaryData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['batches-summary', statuses],
        queryFn: () => fetchBatchesSummary(statuses),
        staleTime: 300000, // 5 minutes cache for summary
    });

    return {
        summaryData,
        isLoading,
        error,
    };
};
