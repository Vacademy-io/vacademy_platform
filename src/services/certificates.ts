import LocalStorageUtils from "@/utils/localstorage";

type GenerateCertificateRequest = {
  user_id: string;
  package_session_id: string;
};

type GenerateCertificateResponse = {
  status: 200 | 202;
  url: string;
  generated_at: string; // ISO time when certificate was generated
};

const CACHE_KEY_PREFIX = "CERTIFICATE_GENERATION_STATUS_";
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function buildCacheKey(userId: string, packageSessionId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}_${packageSessionId}`;
}

export function getCachedCertificateStatus(
  userId: string,
  packageSessionId: string
): GenerateCertificateResponse | null {
  const cacheKey = buildCacheKey(userId, packageSessionId);
  const cached = LocalStorageUtils.get<{ savedAt: number; data: GenerateCertificateResponse }>(cacheKey);
  if (!cached) {
    console.log("[certificates] cache miss", { userId, packageSessionId });
    return null;
  }
  const isStale = Date.now() - cached.savedAt > THREE_HOURS_MS;
  if (isStale) {
    console.log("[certificates] cache stale -> evict", { userId, packageSessionId });
    LocalStorageUtils.remove(cacheKey);
    return null;
  }
  console.log("[certificates] cache hit", { userId, packageSessionId, status: cached.data.status });
  return cached.data;
}

export function setCachedCertificateStatus(
  userId: string,
  packageSessionId: string,
  data: GenerateCertificateResponse
): void {
  const cacheKey = buildCacheKey(userId, packageSessionId);
  LocalStorageUtils.set(cacheKey, { savedAt: Date.now(), data });
  console.log("[certificates] cache set", { userId, packageSessionId, status: data.status });
}

// Mock function that mimics backend API
export async function mockGenerateCertificate(
  payload: GenerateCertificateRequest
): Promise<GenerateCertificateResponse> {
  const { user_id, package_session_id } = payload;
  // Randomly decide scenario; 60% already generated, 40% newly generated
  const newlyGenerated = false;
  const url = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?u=${encodeURIComponent(
    user_id
  )}&p=${encodeURIComponent(package_session_id)}`;
  const generatedAt = new Date().toISOString();

  // Simulate slight network delay
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

  if (newlyGenerated) {
    console.log("[certificates] mock generate -> 200", { user_id, package_session_id });
    return { status: 200, url, generated_at: generatedAt };
  }
  console.log("[certificates] mock generate -> 202", { user_id, package_session_id });
  return { status: 202, url, generated_at: generatedAt };
}

export async function generateCertificateWithCache(
  payload: GenerateCertificateRequest,
  opts?: { bypassCache?: boolean }
): Promise<GenerateCertificateResponse> {
  const { user_id, package_session_id } = payload;
  if (!opts?.bypassCache) {
    const cached = getCachedCertificateStatus(user_id, package_session_id);
    if (cached) return cached;
  }

  const response = await mockGenerateCertificate(payload);
  setCachedCertificateStatus(user_id, package_session_id, response);
  console.log("[certificates] generateCertificateWithCache -> response", { status: response.status });
  return response;
}

export type { GenerateCertificateRequest, GenerateCertificateResponse };


