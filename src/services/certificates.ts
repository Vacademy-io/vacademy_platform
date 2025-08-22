import { getInstituteIdSync } from "@/components/common/helper";
import { GENERATE_CERTIFICATE } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
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
    const cached = LocalStorageUtils.get<{
        savedAt: number;
        data: GenerateCertificateResponse;
    }>(cacheKey);
    if (!cached) {
        return null;
    }
    const isStale = Date.now() - cached.savedAt > THREE_HOURS_MS;
    if (isStale) {
        LocalStorageUtils.remove(cacheKey);
        return null;
    }
    return cached.data;
}

export function setCachedCertificateStatus(
    userId: string,
    packageSessionId: string,
    data: GenerateCertificateResponse
): void {
    const cacheKey = buildCacheKey(userId, packageSessionId);
    LocalStorageUtils.set(cacheKey, { savedAt: Date.now(), data });
}

export const generateCertificateUrl = async ({
    learnerId,
    packageSessionId,
}: {
    learnerId: string;
    packageSessionId: string;
}) => {
    const instituteId = await getInstituteIdSync();
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: GENERATE_CERTIFICATE,
        params: {
            learnerId,
            packageSessionId,
            instituteId,
        },
    });
    return response?.data;
};

// Mock function that mimics backend API
export async function mockGenerateCertificate(
    payload: GenerateCertificateRequest
): Promise<GenerateCertificateResponse> {
    const { user_id, package_session_id } = payload;
    // Randomly decide scenario; 60% already generated, 40% newly generated
    const newlyGenerated = false;
    const url = await generateCertificateUrl({
        learnerId: user_id,
        packageSessionId: package_session_id,
    });
    const generatedAt = new Date().toISOString();

    // Simulate slight network delay
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

    if (newlyGenerated) {
        return { status: 200, url, generated_at: generatedAt };
    }
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
    return response;
}

export type { GenerateCertificateRequest, GenerateCertificateResponse };
