import { useMemo, useCallback } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { convertCapitalToTitleCase } from '@/lib/utils';

/**
 * Hook to get batch names from batch IDs (source_id)
 * Provides memoized batch name resolution for better performance
 */
export const useBatchNames = () => {
  const { instituteDetails } = useInstituteDetailsStore();

  // Memoize batch lookup map for better performance
  const batchLookupMap = useMemo(() => {
    if (!instituteDetails?.batches_for_sessions) {
      return new Map<string, string>();
    }

    const map = new Map<string, string>();
    instituteDetails.batches_for_sessions.forEach((batch) => {
      const batchName = convertCapitalToTitleCase(batch.level.level_name) +
        ' ' +
        convertCapitalToTitleCase(batch.package_dto.package_name) +
        ' ' +
        convertCapitalToTitleCase(batch.session.session_name);
      map.set(batch.id, batchName);
    });

    return map;
  }, [instituteDetails?.batches_for_sessions]);

  /**
   * Get batch name from batch ID
   */
  const getBatchName = useCallback((batchId: string): string => {
    if (!batchId || !batchLookupMap.size) {
      return 'N/A';
    }

    return batchLookupMap.get(batchId) || 'N/A';
  }, [batchLookupMap]);

  /**
   * Get batch names for multiple batch IDs
   */
  const getBatchNames = useCallback((batchIds: string[]): Map<string, string> => {
    const batchNamesMap = new Map<string, string>();

    batchIds.forEach(batchId => {
      batchNamesMap.set(batchId, getBatchName(batchId));
    });

    return batchNamesMap;
  }, [getBatchName]);

  /**
   * Get all unique batch IDs from responses
   */
  const getUniqueBatchIds = useCallback((responses: Array<{ source_id?: string }>): string[] => {
    const uniqueIds = new Set<string>();

    responses.forEach(response => {
      if (response.source_id) {
        uniqueIds.add(response.source_id);
      }
    });

    return Array.from(uniqueIds);
  }, []);

  return {
    getBatchName,
    getBatchNames,
    getUniqueBatchIds,
  };
};
