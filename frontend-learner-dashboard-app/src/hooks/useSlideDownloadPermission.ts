import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { instituteSettingsCache } from "@/services/institute-settings-cache";
import { getInstituteDetails } from "@/services/signup-api";
import { getDecodedAccessTokenFromStorage } from "@/lib/auth/sessionUtility";
import {
  canDownloadSlideType,
  canPrintPdfSlide,
  SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY,
  type SlideDownloadPermissionData,
} from "@/constants/slide-download-permission";

/** Pull our setting's `data` out of a `{ KEY: { data } }` map. */
function pickSettingData(
  map: Record<string, any> | null | undefined
): SlideDownloadPermissionData | null {
  const data = map?.[SLIDE_DOWNLOAD_PERMISSION_SETTING_KEY]?.data;
  return data && typeof data === "object" ? (data as SlideDownloadPermissionData) : null;
}

/** From the raw `setting` JSON string the institute-details endpoint returns. */
function extractFromRaw(rawSetting: string | null | undefined): SlideDownloadPermissionData | null {
  if (!rawSetting) return null;
  try {
    const parsed = JSON.parse(rawSetting);
    const map = parsed?.setting && typeof parsed.setting === "object" ? parsed.setting : parsed;
    return pickSettingData(map);
  } catch {
    return null;
  }
}

/** From the already-parsed cached settings object. */
function extractFromCached(cached: any): SlideDownloadPermissionData | null {
  if (!cached || typeof cached !== "object") return null;
  const map = cached.setting && typeof cached.setting === "object" ? cached.setting : cached;
  return pickSettingData(map);
}

/**
 * Resolve, for the current user, whether each slide type may be downloaded.
 *
 * Reads the current user's roles from the access token, then resolves the
 * institute's SLIDE_DOWNLOAD_PERMISSION_SETTING. The setting is fetched FRESH
 * from the public institute-details endpoint (deduped + cached ~30s via React
 * Query), because the on-device `InstituteSettingsCache` is sticky — it only
 * fetches when missing, so an admin's change would otherwise not reach the
 * learner until logout. The sticky cache is used only as an instant fallback.
 *
 * Exposes a synchronous `canDownload(typeKey)`. Before anything resolves it
 * falls back to today's default behavior (via the resolver), so there is no
 * functional regression mid-load.
 */
export function useSlideDownloadPermission() {
  const [roles, setRoles] = useState<string[]>([]);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [cachedData, setCachedData] = useState<SlideDownloadPermissionData | null>(null);
  const [identityResolved, setIdentityResolved] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [cached, decoded, id] = await Promise.all([
          instituteSettingsCache.getCachedSettings(),
          getDecodedAccessTokenFromStorage(),
          instituteSettingsCache.getCachedInstituteId(),
        ]);

        const authorities = decoded?.authorities;
        let resolvedId = id;
        let userRoles: string[] = [];
        if (authorities && typeof authorities === "object") {
          if (!resolvedId) {
            // No cached id — fall back to the first institute on the token.
            resolvedId = Object.keys(authorities)[0] ?? null;
          }
          const forInstitute = resolvedId ? authorities[resolvedId] : undefined;
          userRoles = forInstitute?.roles?.length
            ? forInstitute.roles
            : Object.values(authorities).flatMap(
                (a) => (a as { roles?: string[] })?.roles ?? []
              );
        }

        if (mounted) {
          setRoles(userRoles);
          setInstituteId(resolvedId);
          setCachedData(extractFromCached(cached));
          setIdentityResolved(true);
        }
      } catch {
        if (mounted) setIdentityResolved(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { data: freshDetails } = useQuery({
    queryKey: ["slide-download-institute-setting", instituteId],
    queryFn: () => getInstituteDetails(instituteId as string),
    enabled: !!instituteId,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const data = useMemo<SlideDownloadPermissionData | null>(() => {
    const fresh = extractFromRaw(freshDetails?.setting);
    // Prefer the fresh server value; fall back to the on-device cache.
    return fresh ?? cachedData;
  }, [freshDetails, cachedData]);

  const canDownload = useCallback(
    (typeKey: string) => canDownloadSlideType(data, typeKey, roles),
    [data, roles]
  );

  const canPrintPdf = useCallback(() => canPrintPdfSlide(data, roles), [data, roles]);

  return { canDownload, canPrintPdf, isResolved: identityResolved };
}
