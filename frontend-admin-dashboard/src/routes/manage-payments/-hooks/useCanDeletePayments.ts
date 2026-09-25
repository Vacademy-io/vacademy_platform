import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import {
    DISPLAY_SETTINGS_UPDATED_EVENT,
    getDisplaySettingsFromCache,
    getDisplaySettingsWithFallback,
} from '@/services/display-settings';

const QUERY_KEY = 'can-delete-payments';

/**
 * May the viewer PERMANENTLY delete payments and invoices? Display Settings → Learner Management
 * → "delete payments & invoices", for the viewer's own role. OFF unless explicitly switched on —
 * a missing flag, a failed lookup and the loading state all read as false. The server checks the
 * same setting, so this only decides whether the buttons are shown.
 */
export function useCanDeletePayments(): boolean {
    const queryClient = useQueryClient();
    const roleKey = getActiveRoleDisplaySettingsKey();

    const { data } = useQuery({
        queryKey: [QUERY_KEY, roleKey],
        queryFn: async () => {
            const settings =
                getDisplaySettingsFromCache(roleKey) ?? (await getDisplaySettingsWithFallback(roleKey));
            return settings?.learnerManagement?.allowDeletePayments === true;
        },
        staleTime: 60_000,
    });

    // Turning the setting on or off takes effect without a reload.
    useEffect(() => {
        const refresh = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
        window.addEventListener(DISPLAY_SETTINGS_UPDATED_EVENT, refresh);
        return () => window.removeEventListener(DISPLAY_SETTINGS_UPDATED_EVENT, refresh);
    }, [queryClient]);

    return data === true;
}
