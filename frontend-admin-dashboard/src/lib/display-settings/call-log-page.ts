import { useEffect, useState } from 'react';
import {
    DISPLAY_SETTINGS_UPDATED_EVENT,
    getDisplaySettings,
    getDisplaySettingsFromCache,
} from '@/services/display-settings';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import type { CallLogPageSettings } from '@/types/display-settings';

/**
 * Per-role gating for the Call Log page's Queue tab
 * (Display Settings → Call Log).
 *
 * <b>Defaults to OFF</b>, which is the opposite of most flags in this folder. The
 * assessment toggles default ON so an institute that never touched them keeps
 * seeing what it already had; the Queue tab is new, and it surfaces fleet-level
 * facts — that a fixed number of lines exists, and that this institute's calls
 * share them with other tenants — which nobody should meet unannounced. So it is
 * opt-in: reads test `=== true`, never `!== false`.
 */
export const useCallQueueTabVisible = (): boolean => {
    const read = (): boolean =>
        resolve(getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey())?.callLogPage);

    const [visible, setVisible] = useState<boolean>(read);

    useEffect(() => {
        let cancelled = false;
        const sync = () => {
            if (!cancelled) setVisible(read());
        };

        // A cold cache resolves to hidden, so unlike the defaults-ON flags there is
        // no flash of a tab that should not be there — the fetch can only ever turn
        // it on, never off.
        const roleKey = getActiveRoleDisplaySettingsKey();
        if (!getDisplaySettingsFromCache(roleKey)) {
            getDisplaySettings(roleKey)
                .then((settings) => {
                    if (!cancelled) setVisible(resolve(settings?.callLogPage));
                })
                .catch(() => {
                    /* stays hidden */
                });
        }

        // Keeps an open Call Log page in sync the moment an admin saves the setting.
        window.addEventListener(DISPLAY_SETTINGS_UPDATED_EVENT, sync);
        return () => {
            cancelled = true;
            window.removeEventListener(DISPLAY_SETTINGS_UPDATED_EVENT, sync);
        };
    }, []);

    return visible;
};

const resolve = (settings: CallLogPageSettings | undefined): boolean =>
    settings?.showCallQueueTab === true;
