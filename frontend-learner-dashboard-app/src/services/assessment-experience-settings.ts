import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import {
  ASSESSMENT_SETTING_KEY,
  DEFAULT_EXAM_EXPERIENCE,
  mergeExamExperience,
  type ExamExperienceSettings,
} from "@/types/assessment-experience";

const LS_KEY = `${ASSESSMENT_SETTING_KEY}_EXPERIENCE_CACHE_V1`;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The exam shell reads these settings on mount, mid-attempt, and often from two
 * components at once. A cold cache must never turn into two network round-trips
 * that delay the first question — hence the localStorage cache plus a shared
 * in-flight promise, mirroring `student-display-settings`.
 */
const inFlightByInstitute = new Map<string, Promise<ExamExperienceSettings>>();

function readCache(instituteId: string): ExamExperienceSettings | null {
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${instituteId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      ts: number;
      data: Partial<ExamExperienceSettings>;
    };
    if (!parsed?.ts || Date.now() - parsed.ts > ONE_DAY_MS) return null;
    return mergeExamExperience(parsed.data);
  } catch {
    return null;
  }
}

function writeCache(instituteId: string, data: ExamExperienceSettings): void {
  try {
    localStorage.setItem(
      `${LS_KEY}:${instituteId}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // Storage full / private mode — defaults still apply, so this is not fatal.
  }
}

async function fetchAndCache(
  instituteId: string
): Promise<ExamExperienceSettings> {
  try {
    const res = await authenticatedAxiosInstance.get<{
      data?: { examExperience?: Partial<ExamExperienceSettings> } | null;
    }>(`${BASE_URL}/admin-core-service/institute/setting/v1/get`, {
      params: { instituteId, settingKey: ASSESSMENT_SETTING_KEY },
    });
    const merged = mergeExamExperience(res.data?.data?.examExperience);
    writeCache(instituteId, merged);
    return merged;
  } catch {
    // Never block an exam on a settings call — fall back to the defaults.
    return DEFAULT_EXAM_EXPERIENCE;
  }
}

export async function getExamExperienceSettings(
  forceRefresh = false
): Promise<ExamExperienceSettings> {
  const instituteId = await getInstituteId();
  if (!instituteId) return DEFAULT_EXAM_EXPERIENCE;

  if (forceRefresh) return fetchAndCache(instituteId);

  const cached = readCache(instituteId);
  if (cached) return cached;

  const inFlight = inFlightByInstitute.get(instituteId);
  if (inFlight) return inFlight;

  const request = fetchAndCache(instituteId);
  inFlightByInstitute.set(instituteId, request);
  request.finally(() => {
    if (inFlightByInstitute.get(instituteId) === request) {
      inFlightByInstitute.delete(instituteId);
    }
  });
  return request;
}

export function clearExamExperienceSettingsCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${LS_KEY}:`)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (error) {
    console.error("Error clearing exam experience settings cache:", error);
  }
}
