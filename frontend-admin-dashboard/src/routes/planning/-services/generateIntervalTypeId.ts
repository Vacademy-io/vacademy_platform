import { useQuery } from '@tanstack/react-query';
import type { IntervalType } from '../-types/types';
import { GENERATE_INTERVAL_TYPE_ID } from '@/constants/urls';
import { format } from 'date-fns';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

interface GenerateIntervalTypeIdParams {
    intervalType: IntervalType;
    date: Date;
}

/**
 * Fetches the interval type ID from the backend
 * @param intervalType - The interval type
 * @param dateString - The date in YYYYMMDD format
 * @returns Promise with the generated interval type ID
 */
async function fetchIntervalTypeId(
    intervalType: IntervalType,
    dateString: string
): Promise<string> {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GENERATE_INTERVAL_TYPE_ID,
        params: {
            intervalType,
            dateYYYYMMDD: dateString,
        },
    });

    if (response.status !== 200) {
        throw new Error('Failed to generate interval type ID');
    }
    return response.data;
}

/**
 * Hook to generate interval type ID from backend
 * @param params - Interval type and date
 * @returns Query result with the generated interval type ID
 */
export function useGenerateIntervalTypeId(params: GenerateIntervalTypeIdParams | null) {
    const dateString = params?.date ? format(params.date, 'yyyy-MM-dd') : '';

    return useQuery({
        queryKey: ['generate-interval-type-id', params?.intervalType, dateString],
        queryFn: () => fetchIntervalTypeId(params!.intervalType, dateString),
        enabled: !!params?.intervalType && !!params?.date,
        staleTime: Infinity, // The ID for a given date and interval type never changes
    });
}
