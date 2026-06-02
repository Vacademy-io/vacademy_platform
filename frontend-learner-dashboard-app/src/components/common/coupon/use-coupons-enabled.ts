import { useEffect, useState } from "react";
import { instituteSettingsCache } from "@/services/institute-settings-cache";
import { getInstituteDetails } from "@/services/signup-api";

/**
 * Returns the institute-level "Coupons Enabled" flag.
 *
 * The flag is stored under {@code setting.COUPON_ENABLED_SETTING.data.enabled}
 * in the institute settings JSON (admin toggles it via
 * Settings → Coupons → "Enable coupon redemption for learners").
 *
 * Default when missing: false (institutes opt in deliberately).
 *
 * Two-tier read strategy to avoid stale-cache misses:
 *   1. Immediate: try the persistent {@link instituteSettingsCache} so the
 *      hook renders the right value on the first paint when the cache is
 *      already populated.
 *   2. Background: hit the public institute-details endpoint to refresh
 *      the flag. This is what makes a fresh admin toggle visible without
 *      requiring the learner to clear preferences or cold-restart — the
 *      persistent cache early-returns when it already has data, so it
 *      alone would never pick up a flipped toggle.
 *
 * Both reads fail closed (return false) when the call errors or the key is
 * missing.
 */

// Tiny in-memory dedup so repeat renders (multiple coupon surfaces, navigation
// between dialogs) don't all fire a fresh HTTP request. The TTL is short
// because admins toggling the setting want to see the effect on the next
// page visit, not a session later.
const LIVE_FETCH_TTL_MS = 30_000;
const liveFetchCache = new Map<string, { value: boolean; ts: number }>();

const readFlagFromSettingsObj = (parsed: unknown): boolean => {
    const s = parsed as { setting?: Record<string, { data?: { enabled?: boolean } }> } | null;
    return s?.setting?.COUPON_ENABLED_SETTING?.data?.enabled === true;
};

const fetchLiveCouponsEnabled = async (instituteId: string): Promise<boolean> => {
    const cached = liveFetchCache.get(instituteId);
    if (cached && Date.now() - cached.ts < LIVE_FETCH_TTL_MS) {
        return cached.value;
    }
    try {
        const details = await getInstituteDetails(instituteId);
        // BE returns `setting` as a JSON string (mirrors the persistent cache
        // shape). Tolerate the parsed-object case too in case BE changes.
        const rawSetting = (details as { setting?: unknown })?.setting;
        let parsed: unknown = null;
        if (typeof rawSetting === "string" && rawSetting.length > 0) {
            try {
                parsed = JSON.parse(rawSetting);
            } catch {
                parsed = null;
            }
        } else if (rawSetting && typeof rawSetting === "object") {
            parsed = rawSetting;
        }
        const value = readFlagFromSettingsObj(parsed);
        liveFetchCache.set(instituteId, { value, ts: Date.now() });
        return value;
    } catch {
        return false;
    }
};

export const useCouponsEnabled = (): boolean => {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Tier 1 — read the persistent cache so the first paint is correct
            // when the toggle was already enabled at signup/login.
            try {
                const settings = await instituteSettingsCache.getCachedSettings();
                if (cancelled) return;
                if (readFlagFromSettingsObj(settings)) {
                    setEnabled(true);
                }
            } catch {
                // Ignore — Tier 2 will still run.
            }

            // Tier 2 — live refetch so a freshly-flipped admin toggle is
            // visible without clearing preferences or cold-restarting the
            // learner app. Uses the cache's recorded institute id so the
            // hook stays route-agnostic and works on every checkout surface.
            const liveInstituteId = await instituteSettingsCache.getCachedInstituteId();
            if (cancelled || !liveInstituteId) return;
            const live = await fetchLiveCouponsEnabled(liveInstituteId);
            if (cancelled) return;
            setEnabled(live);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return enabled;
};
