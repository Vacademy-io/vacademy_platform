import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";

/**
 * Resolves whether learner chat is enabled for the current institute.
 *
 * Chat is OFF by default. The authoritative gate is the institute's
 * `settings.chat.enabled` flag from the notification-service institute
 * settings. This is FAIL-CLOSED: any missing flag, error, or unresolved
 * institute id resolves to `false` (chat hidden), matching off-by-default.
 *
 * The result is cached per-institute in module scope (~5 min TTL) so the
 * sidebar / course-detail tabs don't refetch on every render.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  ts: number;
  enabled: boolean;
}

const cacheByInstitute = new Map<string, CacheEntry>();

export async function getChatEnabled(): Promise<boolean> {
  const instituteId = await getInstituteId();
  // Fail closed: no institute resolved → treat chat as disabled.
  if (!instituteId) return false;

  const cached = cacheByInstitute.get(instituteId);
  if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) {
    return cached.enabled;
  }

  try {
    const res = await authenticatedAxiosInstance.get<{
      settings?: { chat?: { enabled?: boolean } };
    }>(
      `${BASE_URL}/notification-service/v1/institute-settings/institute/${instituteId}`
    );
    const enabled = res.data?.settings?.chat?.enabled === true;
    cacheByInstitute.set(instituteId, { ts: Date.now(), enabled });
    return enabled;
  } catch {
    // Fail closed on any error (network/auth/missing field).
    cacheByInstitute.set(instituteId, { ts: Date.now(), enabled: false });
    return false;
  }
}
