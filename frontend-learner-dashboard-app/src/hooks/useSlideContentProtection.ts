import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { instituteSettingsCache } from "@/services/institute-settings-cache";
import { getInstituteDetails } from "@/services/signup-api";
import { getDecodedAccessTokenFromStorage } from "@/lib/auth/sessionUtility";
import { normalizeRoleKey } from "@/constants/slide-download-permission";

const SLIDE_CONTENT_PROTECTION_SETTING_KEY = "SLIDE_CONTENT_PROTECTION_SETTING";
const DEV_BYPASS_STORAGE_KEY = "slideAccessDevBypass";

interface ProtectionData {
  version?: number;
  roles?: Record<string, boolean>;
  enabled?: boolean; // legacy institute-wide shape
}

/**
 * Dev escape hatch: `?access=dev` disables the protection for the rest of the
 * browser session (persisted in sessionStorage). Escape hatch, not a lock.
 */
function isDevBypass(): boolean {
  try {
    // Tolerant parse: look for an `access=dev` token anywhere in the URL,
    // splitting on `?`, `&` and `#`. This still works when someone appends
    // "?access=dev" to a URL that already has a query string (producing a stray
    // second "?", e.g. ...&sessionId=xyz?access=dev) — not only when it is a
    // well-formed query param.
    const hasAccessDev = window.location.href.split(/[?&#]/).some((token) => {
      const [key, value] = token.split("=");
      return key === "access" && value === "dev";
    });
    if (hasAccessDev) {
      sessionStorage.setItem(DEV_BYPASS_STORAGE_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(DEV_BYPASS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function pickProtection(map: Record<string, any> | null | undefined): ProtectionData | null {
  const data = map?.[SLIDE_CONTENT_PROTECTION_SETTING_KEY]?.data;
  return data && typeof data === "object" ? (data as ProtectionData) : null;
}

function fromRaw(rawSetting: string | null | undefined): ProtectionData | null {
  if (!rawSetting) return null;
  try {
    const parsed = JSON.parse(rawSetting);
    const map = parsed?.setting && typeof parsed.setting === "object" ? parsed.setting : parsed;
    return pickProtection(map);
  } catch {
    return null;
  }
}

function fromCached(cached: any): ProtectionData | null {
  if (!cached || typeof cached !== "object") return null;
  const map = cached.setting && typeof cached.setting === "object" ? cached.setting : cached;
  return pickProtection(map);
}

/**
 * Protection applies if ANY of the user's held roles has it enabled (so turning
 * it on for a role reliably protects users with that role). Falls back to the
 * legacy institute-wide `enabled` flag when no per-role map is present.
 */
function isProtectedForRoles(data: ProtectionData | null, roleNames: string[]): boolean {
  if (!data) return false;
  if (data.roles && typeof data.roles === "object") {
    return roleNames.map(normalizeRoleKey).some((r) => data.roles![r] === true);
  }
  return !!data.enabled;
}

/**
 * Whether slide content protection (disable right-click + DevTools/view-source
 * shortcuts) is active for the current user. Per-role, fetched fresh from the
 * public institute-details endpoint (shared/deduped key) so admin changes apply
 * on the next slide load. Always false under the `?access=dev` bypass.
 */
export function useSlideContentProtection(): { protectionEnabled: boolean } {
  const [roles, setRoles] = useState<string[]>([]);
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [cachedData, setCachedData] = useState<ProtectionData | null>(null);

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
          setCachedData(fromCached(cached));
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
    queryKey: ["slide-download-institute-setting", instituteId],
    queryFn: () => getInstituteDetails(instituteId as string),
    enabled: !!instituteId,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const protectionEnabled = useMemo(() => {
    if (isDevBypass()) return false;
    const data = freshDetails?.setting != null ? fromRaw(freshDetails.setting) : cachedData;
    return isProtectedForRoles(data, roles);
  }, [freshDetails, cachedData, roles]);

  return { protectionEnabled };
}
