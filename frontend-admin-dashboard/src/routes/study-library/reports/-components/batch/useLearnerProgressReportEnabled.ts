import { useEffect, useState } from 'react';

import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';

/**
 * Whether the per-learner "Student Progress" report tab is enabled for the
 * active role — Settings → Display → Course Page Settings →
 * `coursePage.showLearnerProgressReport`.
 *
 * Seeds from the localStorage cache so the tab does not flash in and out on a
 * warm load, then force-refreshes on mount (same pattern as the Course Details
 * page) so an admin toggling it in Settings sees the change on the next page
 * load rather than after the 24h cache TTL.
 *
 * Defaults to **true** on a cold cache and on fetch failure: only an explicit
 * `false` hides the tab, so institutes that have never touched the setting keep
 * it visible.
 */
export const useLearnerProgressReportEnabled = (): boolean => {
    const [enabled, setEnabled] = useState<boolean>(
        () =>
            getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey())?.coursePage
                ?.showLearnerProgressReport !== false
    );

    useEffect(() => {
        let isMounted = true;
        const roleKey = getActiveRoleDisplaySettingsKey();
        getDisplaySettings(roleKey, true)
            .then((settings) => {
                if (isMounted) {
                    setEnabled(settings?.coursePage?.showLearnerProgressReport !== false);
                }
            })
            .catch(() => {
                // Keep whatever the cache seeded — never hide the tab because a
                // settings fetch failed.
            });
        return () => {
            isMounted = false;
        };
    }, []);

    return enabled;
};
