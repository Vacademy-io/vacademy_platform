import { useEffect, useState } from "react";
import { instituteSettingsCache } from "@/services/institute-settings-cache";

/**
 * Returns the institute-level "Coupons Enabled" flag.
 *
 * The flag is stored under {@code setting.COUPON_ENABLED_SETTING.data.enabled}
 * in the institute settings JSON (admin toggles it via
 * Settings → Coupons → "Enable coupon redemption for learners").
 *
 * Default when missing: false (institutes opt in deliberately).
 *
 * The cache is a singleton populated on signup/login and persisted via
 * @capacitor/preferences, so this hook is essentially a synchronous read
 * after the first render. Learners see the new state on cold-restart of the
 * app — there is no live invalidation across the admin/learner boundary.
 */
export const useCouponsEnabled = (): boolean => {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const settings = await instituteSettingsCache.getCachedSettings();
                if (cancelled) return;
                const flag = settings?.setting?.COUPON_ENABLED_SETTING?.data?.enabled;
                setEnabled(flag === true);
            } catch {
                // Missing setting or cache miss → fail closed (off).
                if (!cancelled) setEnabled(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return enabled;
};
