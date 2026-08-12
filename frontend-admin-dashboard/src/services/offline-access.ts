import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    GET_INSITITUTE_SETTINGS,
    OFFLINE_ACCESS_EFFECTIVE,
    OFFLINE_ACCESS_RULES,
    OFFLINE_ADMIN_DEVICES,
    OFFLINE_ADMIN_DISCREPANCIES,
    OFFLINE_ADMIN_TELEMETRY_DOWNLOADS,
    OFFLINE_ADMIN_TELEMETRY_LEARNERS,
    PACKAGE_SETTING_DATA,
    PACKAGE_SETTING_SAVE,
} from '@/constants/urls';
import {
    DEFAULT_OFFLINE_ACCESS_SETTINGS,
    type OfflineAccessSettingsData,
    type OfflineDeviceDTO,
    type OfflineDownloadTelemetryDTO,
    type OfflineLearnerDownloadDTO,
    type OfflineManifestDTO,
    type OfflineRuleDTO,
    type OfflineRuleUpsertDTO,
    type OfflineSyncDiscrepancyDTO,
} from '@/types/offline-access';

const OFFLINE_ACCESS_SETTING_KEY = 'OFFLINE_ACCESS_SETTING';
const SAVE_INSTITUTE_SETTING_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

// ── Per-node rules (offline plan A1) ─────────────────────────────────────

export const getOfflineRules = async (packageSessionId: string): Promise<OfflineRuleDTO[]> => {
    const response = await authenticatedAxiosInstance.get<OfflineRuleDTO[]>(OFFLINE_ACCESS_RULES, {
        params: { packageSessionId },
    });
    return response.data ?? [];
};

export const getOfflineEffective = async (packageSessionId: string): Promise<OfflineManifestDTO> => {
    const response = await authenticatedAxiosInstance.get<OfflineManifestDTO>(OFFLINE_ACCESS_EFFECTIVE, {
        params: { packageSessionId },
    });
    return response.data;
};

/** Bulk upsert/delete rules. `allow: null` on a rule deletes it (UI "Inherit"). */
export const saveOfflineRules = async (rules: OfflineRuleUpsertDTO[]): Promise<void> => {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.post(
        OFFLINE_ACCESS_RULES,
        { rules },
        { params: { instituteId } }
    );
};

// ── Course-level default (package.course_setting.offlineDefaultEnabled) ──
// NOTE: this is a distinct blob from the institute-wide "Course Settings"
// admin screen (src/services/course-settings.ts posts to
// institute/setting/v1 with key COURSE_SETTING, which is never read by the
// backend's OfflineAccessResolver). The resolver reads
// package.course_setting via PackageSettingService, so the toggle must write
// there — via the per-package /package/setting/v1 endpoints, keyed by
// packageId (courseId), merging into whatever else already lives under the
// package's own COURSE_SETTING key so LMS/drip-condition data isn't clobbered.
const PACKAGE_COURSE_SETTING_KEY = 'COURSE_SETTING';

export const getCourseOfflineDefault = async (packageId: string): Promise<boolean> => {
    const response = await authenticatedAxiosInstance.get(PACKAGE_SETTING_DATA, {
        params: { packageId, settingKey: PACKAGE_COURSE_SETTING_KEY },
    });
    const data = response.data as Record<string, unknown> | null;
    return Boolean(data?.offlineDefaultEnabled);
};

export const saveCourseOfflineDefault = async (packageId: string, enabled: boolean): Promise<void> => {
    const existing = await authenticatedAxiosInstance.get(PACKAGE_SETTING_DATA, {
        params: { packageId, settingKey: PACKAGE_COURSE_SETTING_KEY },
    });
    const existingData = (existing.data as Record<string, unknown> | null) ?? {};
    const mergedData = { ...existingData, offlineDefaultEnabled: enabled };
    await authenticatedAxiosInstance.post(
        PACKAGE_SETTING_SAVE,
        { setting_name: 'Course Settings', setting_data: mergedData },
        { params: { packageId, settingKey: PACKAGE_COURSE_SETTING_KEY } }
    );
};

// ── Institute-wide OFFLINE_ACCESS_SETTING (offline plan A6) ──────────────

export const getOfflineAccessSettings = async (): Promise<OfflineAccessSettingsData> => {
    const instituteId = getInstituteId();
    try {
        const response = await authenticatedAxiosInstance.get(GET_INSITITUTE_SETTINGS, {
            params: { instituteId, settingKey: OFFLINE_ACCESS_SETTING_KEY },
        });
        const stored = response.data?.data ?? null;
        if (!stored || typeof stored !== 'object') {
            return { ...DEFAULT_OFFLINE_ACCESS_SETTINGS };
        }
        return {
            enabled: Boolean(stored.enabled),
            revalidationDays:
                typeof stored.revalidationDays === 'number'
                    ? stored.revalidationDays
                    : DEFAULT_OFFLINE_ACCESS_SETTINGS.revalidationDays,
            maxDevices:
                typeof stored.maxDevices === 'number'
                    ? stored.maxDevices
                    : DEFAULT_OFFLINE_ACCESS_SETTINGS.maxDevices,
        };
    } catch {
        return { ...DEFAULT_OFFLINE_ACCESS_SETTINGS };
    }
};

export const saveOfflineAccessSettings = async (data: OfflineAccessSettingsData): Promise<void> => {
    const instituteId = getInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_INSTITUTE_SETTING_URL,
        { setting_name: 'Offline Access Settings', setting_data: data },
        { params: { instituteId, settingKey: OFFLINE_ACCESS_SETTING_KEY } }
    );
};

// ── Telemetry + discrepancies (offline plan A4/A5) ────────────────────────

export const getOfflineDownloadTelemetry = async (
    packageSessionId: string
): Promise<OfflineDownloadTelemetryDTO> => {
    const response = await authenticatedAxiosInstance.get<OfflineDownloadTelemetryDTO>(
        OFFLINE_ADMIN_TELEMETRY_DOWNLOADS,
        { params: { packageSessionId } }
    );
    return response.data;
};

/** Learners (per device) holding this batch offline. */
export const getOfflineLearnerDownloads = async (
    packageSessionId: string
): Promise<OfflineLearnerDownloadDTO[]> => {
    const response = await authenticatedAxiosInstance.get<OfflineLearnerDownloadDTO[]>(
        OFFLINE_ADMIN_TELEMETRY_LEARNERS,
        { params: { packageSessionId } }
    );
    return response.data ?? [];
};

export interface DiscrepancyPage {
    content: OfflineSyncDiscrepancyDTO[];
    totalElements: number;
    totalPages: number;
    number: number;
}

export const getOfflineDiscrepancies = async (
    packageSessionId: string,
    status: 'OPEN' | 'REVIEWED' | undefined,
    page = 0,
    size = 20
): Promise<DiscrepancyPage> => {
    const response = await authenticatedAxiosInstance.get<DiscrepancyPage>(OFFLINE_ADMIN_DISCREPANCIES, {
        params: { packageSessionId, status, page, size },
    });
    return response.data;
};

export const reviewOfflineDiscrepancy = async (id: string, status = 'REVIEWED'): Promise<void> => {
    await authenticatedAxiosInstance.put(`${OFFLINE_ADMIN_DISCREPANCIES}/${id}/review`, { status });
};

// ── Devices (admin) ───────────────────────────────────────────────────────

export const getOfflineDevicesForUser = async (userId: string): Promise<OfflineDeviceDTO[]> => {
    const response = await authenticatedAxiosInstance.get<OfflineDeviceDTO[]>(OFFLINE_ADMIN_DEVICES, {
        params: { userId },
    });
    return response.data ?? [];
};

export const revokeOfflineDevice = async (deviceId: string, reason?: string): Promise<void> => {
    await authenticatedAxiosInstance.post(`${OFFLINE_ADMIN_DEVICES}/${deviceId}/revoke`, { reason });
};
