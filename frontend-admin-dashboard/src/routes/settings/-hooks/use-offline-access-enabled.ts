import { useQuery } from '@tanstack/react-query';
import { getOfflineAccessSettings } from '@/services/offline-access';

/**
 * Institute-wide OFFLINE_ACCESS_SETTING master switch, for UI that must follow
 * it (the Downloads course-details tab and its per-role Display Settings row).
 *
 * Shares the `offline-access-settings` query key with the Offline Access editor
 * and the course-details tab strip, so flipping the master switch there settles
 * every dependent control on the next cache invalidation.
 *
 * Unknown (loading/error) counts as ENABLED so a row never flickers into a
 * locked-off state before the setting has actually loaded — same rule the
 * course-details tab strip uses.
 */
export function useOfflineAccessEnabled(): boolean {
    const { data } = useQuery({
        queryKey: ['offline-access-settings'],
        queryFn: getOfflineAccessSettings,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
    return data ? data.enabled === true : true;
}
