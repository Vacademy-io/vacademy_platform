import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getInstituteId } from "@/constants/helper";
import { BASE_URL } from "@/constants/urls";

// System-field visibility configured by the institute admin (admin dashboard →
// Settings → Custom Fields). Each key (FULL_NAME, GENDER, MOBILE_NUMBER, …) maps
// to whether that built-in field should be shown to the learner. We read the same
// CUSTOM_FIELD_SETTING blob the admin writes.
//
// Fails OPEN by design: any network/parse error, a missing setting, or an
// unknown field key all resolve to "visible" so we never blank out a learner's
// profile because a setting could not be loaded.

const SETTING_KEY = "CUSTOM_FIELD_SETTING";
const LS_KEY = "SYSTEM_FIELD_VISIBILITY_CACHE_V1";
const TTL_MS = 1000 * 60 * 60 * 24; // 24h, matching the other learner settings caches

export type SystemFieldVisibilityMap = Record<string, boolean>;

interface FixedFieldRenameDto {
  key?: string;
  visibility?: boolean;
}

// The setting blob's nesting depth has differed across save paths, so rather than
// hard-code `data.data.data`, walk the object and return the first
// `fixedFieldRenameDtos` array we find.
function extractFixedFieldDtos(payload: unknown): FixedFieldRenameDto[] {
  const seen = new Set<unknown>();
  const stack: unknown[] = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const arr = (node as Record<string, unknown>).fixedFieldRenameDtos;
    if (Array.isArray(arr)) return arr as FixedFieldRenameDto[];
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return [];
}

function readCache(instituteId: string): SystemFieldVisibilityMap | null {
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${instituteId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      ts: number;
      data: SystemFieldVisibilityMap;
    };
    if (!parsed?.ts || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeCache(instituteId: string, data: SystemFieldVisibilityMap): void {
  try {
    localStorage.setItem(
      `${LS_KEY}:${instituteId}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // noop
  }
}

export async function getSystemFieldVisibilityMap(
  forceRefresh = false
): Promise<SystemFieldVisibilityMap> {
  const instituteId = await getInstituteId();
  if (!instituteId) return {};

  if (!forceRefresh) {
    const cached = readCache(instituteId);
    if (cached) return cached;
  }

  try {
    const res = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/institute/setting/v1/get`,
      { params: { instituteId, settingKey: SETTING_KEY } }
    );
    const dtos = extractFixedFieldDtos(res?.data);
    const map: SystemFieldVisibilityMap = {};
    dtos.forEach((dto) => {
      if (dto?.key) map[dto.key] = dto.visibility !== false;
    });
    writeCache(instituteId, map);
    return map;
  } catch {
    return {}; // fail open
  }
}
