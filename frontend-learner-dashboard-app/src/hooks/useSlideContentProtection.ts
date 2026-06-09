import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { instituteSettingsCache } from "@/services/institute-settings-cache";
import { getInstituteDetails } from "@/services/signup-api";

const SLIDE_CONTENT_PROTECTION_SETTING_KEY = "SLIDE_CONTENT_PROTECTION_SETTING";
const DEV_BYPASS_STORAGE_KEY = "slideAccessDevBypass";

/**
 * Dev escape hatch: appending `?access=dev` to any URL disables the protection
 * for the rest of the browser session (persisted in sessionStorage so it
 * survives in-app navigation). This is an escape hatch, not a lock — anyone can
 * append it — consistent with the protection being best-effort deterrence.
 */
function isDevBypass(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("access") === "dev") {
      sessionStorage.setItem(DEV_BYPASS_STORAGE_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(DEV_BYPASS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function enabledFromRaw(rawSetting: string | null | undefined): boolean {
  if (!rawSetting) return false;
  try {
    const parsed = JSON.parse(rawSetting);
    const map = parsed?.setting && typeof parsed.setting === "object" ? parsed.setting : parsed;
    return !!map?.[SLIDE_CONTENT_PROTECTION_SETTING_KEY]?.data?.enabled;
  } catch {
    return false;
  }
}

function enabledFromCached(cached: any): boolean {
  if (!cached || typeof cached !== "object") return false;
  const map = cached.setting && typeof cached.setting === "object" ? cached.setting : cached;
  return !!map?.[SLIDE_CONTENT_PROTECTION_SETTING_KEY]?.data?.enabled;
}

/**
 * Returns whether the institute has enabled slide content protection
 * (disable right-click + DevTools/view-source shortcuts) for the learner app.
 *
 * Like the download permission, this is fetched FRESH from the public
 * institute-details endpoint (shared/deduped React Query key) so an admin's
 * change applies on the next slide load rather than only after logout, with the
 * sticky on-device cache as an instant fallback. Always returns `false` when the
 * `?access=dev` bypass is active.
 */
export function useSlideContentProtection(): { protectionEnabled: boolean } {
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [cachedEnabled, setCachedEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [cached, id] = await Promise.all([
          instituteSettingsCache.getCachedSettings(),
          instituteSettingsCache.getCachedInstituteId(),
        ]);
        if (mounted) {
          setInstituteId(id);
          setCachedEnabled(enabledFromCached(cached));
        }
      } catch {
        // best-effort
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { data: freshDetails } = useQuery({
    // Same key as the download hook so the institute-details fetch is shared.
    queryKey: ["slide-download-institute-setting", instituteId],
    queryFn: () => getInstituteDetails(instituteId as string),
    enabled: !!instituteId,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const protectionEnabled = useMemo(() => {
    if (isDevBypass()) return false;
    if (freshDetails?.setting != null) return enabledFromRaw(freshDetails.setting);
    return cachedEnabled;
  }, [freshDetails, cachedEnabled]);

  return { protectionEnabled };
}
