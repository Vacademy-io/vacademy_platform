import { useEffect, useState } from "react";
import { instituteSettingsCache } from "@/services/institute-settings-cache";
import { getInstituteDetails } from "@/services/signup-api";

/**
 * Whether module / chapter descriptions are shown on the learner's content cards.
 *
 * The flag lives at {@code COURSE_SETTING.data.courseViewSettings.showContentDescriptions}
 * in the institute settings JSON — admins toggle it via
 * Settings → Courses → "Show Module & Chapter Descriptions".
 *
 * Default when missing: true. Institutes that saved course settings before this
 * field existed have no value for it, and descriptions were visible then, so a
 * missing key must not hide them.
 *
 * Two-tier read (mirrors {@code useCouponsEnabled}):
 *   1. Immediate — the persistent {@link instituteSettingsCache}, so the first
 *      paint is right when the cache is already populated.
 *   2. Background — a live institute-details fetch, so a freshly-flipped admin
 *      toggle shows up without the learner clearing preferences or cold-
 *      restarting. The persistent cache early-returns when it already holds
 *      data, so on its own it would never pick the change up.
 */

// Short-TTL dedup so several cards rendering at once don't each fire a request.
const LIVE_FETCH_TTL_MS = 30_000;
const liveFetchCache = new Map<string, { value: boolean; ts: number }>();

type SettingsBlob = {
  COURSE_SETTING?: {
    data?: { courseViewSettings?: { showContentDescriptions?: boolean } };
  };
  setting?: {
    COURSE_SETTING?: {
      data?: { courseViewSettings?: { showContentDescriptions?: boolean } };
    };
  };
};

/**
 * Reads the flag from a parsed settings blob.
 *
 * Callers in this app disagree on the shape — some cached payloads nest the
 * settings under a `setting` key, others hold the keys at the top level — so
 * both are accepted. Only an explicit `false` hides descriptions.
 */
const readFlagFromSettingsObj = (parsed: unknown): boolean => {
  const s = parsed as SettingsBlob | null;
  const value =
    s?.COURSE_SETTING?.data?.courseViewSettings?.showContentDescriptions ??
    s?.setting?.COURSE_SETTING?.data?.courseViewSettings
      ?.showContentDescriptions;
  return value !== false;
};

const fetchLiveShowDescriptions = async (
  instituteId: string
): Promise<boolean> => {
  const cached = liveFetchCache.get(instituteId);
  if (cached && Date.now() - cached.ts < LIVE_FETCH_TTL_MS) {
    return cached.value;
  }

  try {
    const details = await getInstituteDetails(instituteId);
    // BE returns `setting` as a JSON string; tolerate an object too.
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
    // Fail open — a failed settings read must not blank out authored content.
    return true;
  }
};

export const useShowContentDescriptions = (): boolean => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const settings = await instituteSettingsCache.getCachedSettings();
        if (cancelled) return;
        setVisible(readFlagFromSettingsObj(settings));
      } catch {
        // Ignore — the live read below still runs.
      }

      try {
        const instituteId = await instituteSettingsCache.getCachedInstituteId();
        if (cancelled || !instituteId) return;
        const live = await fetchLiveShowDescriptions(instituteId);
        if (cancelled) return;
        setVisible(live);
      } catch {
        // Keep whatever the cached read resolved to.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return visible;
};
