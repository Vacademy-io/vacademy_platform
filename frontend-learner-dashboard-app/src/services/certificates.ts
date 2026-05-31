import { getInstituteIdSync } from "@/components/common/helper";
import { GENERATE_CERTIFICATE } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import LocalStorageUtils from "@/utils/localstorage";

type GenerateCertificateRequest = {
    user_id: string;
    package_session_id: string;
    // Learner's current completion percentage. REQUIRED for a fresh render:
    // the backend re-validates it against the institute's auto-issue threshold
    // and returns no certificate when it's missing or below the threshold.
    completion_percentage?: number;
    // Human-readable course name used for the {{COURSE_NAME}} token, the audit
    // row, and the issued-certificate email. Falls back to the package name on
    // the backend when omitted.
    course_name?: string;
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
    generatedAt,
    completionPercentage,
    courseName,
    regenerate,
}: {
    learnerId: string;
    packageSessionId: string;
    generatedAt: string;
    completionPercentage?: number;
    courseName?: string;
    // When true the backend bypasses the cached file id on the learner mapping
    // and re-renders against the *current* template. Used by the Refresh flow.
    regenerate?: boolean;
}) => {
    const instituteId = await getInstituteIdSync();
    // Field names are snake_case to match CertificationGenerationRequest
    // (@JsonNaming(SnakeCaseStrategy)) on the backend.
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: GENERATE_CERTIFICATE,
        params: {
            learnerId,
            packageSessionId,
            instituteId,
        },
        data: {
            completion_date: generatedAt,
            completion_percentage: completionPercentage,
            course_name: courseName,
            regenerate: regenerate ?? false,
        },
    });
    return response;
};

export async function generateCertificateWithCache(
    payload: GenerateCertificateRequest,
    opts?: { bypassCache?: boolean; regenerate?: boolean }
): Promise<GenerateCertificateResponse> {
    const { user_id, package_session_id, completion_percentage, course_name } =
        payload;

    // A regenerate request must always reach the backend so the freshly-saved
    // template is rendered; it also skips (and overwrites) the local cache that
    // would otherwise keep returning the stale PDF URL for up to 3 hours.
    const bypass = opts?.bypassCache || opts?.regenerate;
    if (!bypass) {
        const cached = getCachedCertificateStatus(user_id, package_session_id);
        if (cached) return cached;
    }

    const generatedAt = new Date().toISOString();
    const response = await generateCertificateUrl({
        learnerId: user_id,
        packageSessionId: package_session_id,
        generatedAt,
        completionPercentage: completion_percentage,
        courseName: course_name,
        regenerate: opts?.regenerate,
    });

    // The controller returns the certificate URL as the response body, with
    // HTTP 200 for a freshly-rendered certificate and 202 for a cached one.
    const url =
        typeof response?.data === "string"
            ? response.data
            : (response?.data?.url ?? "");
    const result: GenerateCertificateResponse = {
        status: response?.status === 200 ? 200 : 202,
        url,
        generated_at: generatedAt,
    };
    setCachedCertificateStatus(user_id, package_session_id, result);
    return result;
}

export type { GenerateCertificateRequest, GenerateCertificateResponse };
