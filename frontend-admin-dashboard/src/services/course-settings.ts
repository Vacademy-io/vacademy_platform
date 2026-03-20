import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import {
    CourseSettingsData,
    CourseSettingsRequest,
    CourseSettingsResponse,
    DEFAULT_COURSE_SETTINGS,
} from '@/types/course-settings';

const COURSE_SETTINGS_KEY = 'COURSE_SETTING';
const LOCALSTORAGE_KEY_PREFIX = 'course-settings-cache';
const LEGACY_LOCALSTORAGE_KEY = 'course-settings-cache';
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

/**
 * Build per-institute localStorage key
 */
const getLocalStorageKey = (instituteId: string | null | undefined): string | null => {
    if (!instituteId) return null;
    return `${LOCALSTORAGE_KEY_PREFIX}-${instituteId}`;
};

interface CachedCourseSettings {
    data: CourseSettingsData;
    timestamp: number;
    instituteId: string;
}

/**
 * Get cached course settings from localStorage
 */
const getCachedSettings = (): CourseSettingsData | null => {
    try {
        const instituteId = getInstituteId();
        if (!instituteId) return null;

        // Migration from legacy single-key cache to per-institute key
        const legacyCached = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
        if (legacyCached) {
            try {
                const legacyData: CachedCourseSettings = JSON.parse(legacyCached);
                if (legacyData?.instituteId === instituteId && legacyData?.data) {
                    const newKey = getLocalStorageKey(instituteId);
                    if (newKey) {
                        localStorage.setItem(
                            newKey,
                            JSON.stringify({
                                data: legacyData.data,
                                timestamp: legacyData.timestamp || Date.now(),
                                instituteId,
                            } as CachedCourseSettings)
                        );
                    }
                }
            } catch (e) {
                // ignore parse errors on legacy cache
            } finally {
                localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
            }
        }

        const key = getLocalStorageKey(instituteId);
        if (!key) return null;

        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const cachedData: CachedCourseSettings = JSON.parse(cached);

        // Check if cache has expired
        const now = Date.now();
        const cacheAge = now - cachedData.timestamp;
        const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000; // Convert to milliseconds

        if (cacheAge > expiryTime) {
            localStorage.removeItem(key);
            return null;
        }

        return mergeWithDefaults(cachedData.data);
    } catch (error) {
        console.error('Error reading cached course settings:', error);
        try {
            const instituteId = getInstituteId();
            const key = getLocalStorageKey(instituteId);
            if (key) localStorage.removeItem(key);
        } catch {
            // ignore
        }
        return null;
    }
};

/**
 * Save course settings to localStorage cache
 */
const setCachedSettings = (settings: CourseSettingsData): void => {
    try {
        const instituteId = getInstituteId();
        if (!instituteId) return;

        const key = getLocalStorageKey(instituteId);
        if (!key) return;

        const cacheData: CachedCourseSettings = {
            data: settings,
            timestamp: Date.now(),
            instituteId,
        };

        localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error caching course settings:', error);
    }
};

/**
 * Clear cached course settings
 */
export const clearCourseSettingsCache = (): void => {
    try {
        const instituteId = getInstituteId();
        const key = getLocalStorageKey(instituteId);
        if (key) localStorage.removeItem(key);
        // Clean legacy key as well just in case
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    } catch {
        // ignore
    }
};

/**
 * Get course settings synchronously from cache only (no API call)
 * Useful for cases where you need immediate access and don't want to wait for async
 */
export const getCourseSettingsFromCache = (): CourseSettingsData => {
    const cachedSettings = getCachedSettings();
    return cachedSettings || DEFAULT_COURSE_SETTINGS;
};

/**
 * Fetch course settings from API and update cache
 */
const fetchCourseSettingsFromAPI = async (): Promise<CourseSettingsData> => {
    try {
        const instituteId = getInstituteId();

        if (!instituteId) {
            // Institute ID not yet available (common during login flow)
            // Return defaults without throwing - settings will be refreshed later
            console.warn('Course settings: Institute ID not available yet, using defaults');
            return DEFAULT_COURSE_SETTINGS;
        }

        const response = await authenticatedAxiosInstance.get<CourseSettingsResponse>(
            `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/admin-core-service/institute/setting/v1/get`,
            {
                params: {
                    instituteId,
                    settingKey: COURSE_SETTINGS_KEY,
                },
            }
        );

        let settings: CourseSettingsData;

        // If we get a successful response with data, use it
        if (response.data && response.data.data && Object.keys(response.data.data).length > 0) {
            settings = mergeWithDefaults(response.data.data);
        } else {
            // If no data found or response is null/empty, use default settings

            settings = DEFAULT_COURSE_SETTINGS;
        }

        // Cache the settings
        setCachedSettings(settings);
        return settings;
    } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { ex?: string; responseCode?: string } } };

        // Enhanced logging for development
        if (process.env.NODE_ENV === 'development') {
            console.error('[Course Settings] Error details:', {
                errorType: err.response?.status,
                errorCode: err.response?.data?.responseCode,
                errorMessage: err.response?.data?.ex,
                fullError: error,
            });
        }

        // Check if it's a 510 error (Setting not found or deserialization error)
        if (err.response?.status === 510) {
            console.warn('[Course Settings] 510 error received - using default settings. Error:', err.response?.data?.ex);
            const settings = DEFAULT_COURSE_SETTINGS;
            setCachedSettings(settings);
            return settings;
        }

        // For other errors, still return default settings but log the error
        const message = (error as Error)?.message || 'unknown error';
        console.warn('[Course Settings] Error loading course settings, using defaults:', message);
        return DEFAULT_COURSE_SETTINGS; // Don't cache error responses
    }
};

/**
 * Get course settings - tries cache first, then API if needed
 */
export const getCourseSettings = async (forceRefresh = false): Promise<CourseSettingsData> => {
    // If forcing refresh, skip cache and fetch from API
    if (forceRefresh) {
        return fetchCourseSettingsFromAPI();
    }

    // Try to get from cache first
    const cachedSettings = getCachedSettings();
    if (cachedSettings) {
        return cachedSettings;
    }

    // If no cache, fetch from API
    return fetchCourseSettingsFromAPI();
};

/**
 * Save course settings for the current institute and update cache
 */
export const saveCourseSettings = async (
    settings: CourseSettingsData
): Promise<CourseSettingsResponse> => {
    try {
        const instituteId = getInstituteId();

        if (!instituteId) {
            throw new Error('Institute ID not found. Please log in again.');
        }

        const requestData: CourseSettingsRequest = {
            setting_name: 'Course Creation Configuration',
            setting_data: settings,
        };

        const response = await authenticatedAxiosInstance.post<CourseSettingsResponse>(
            `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/admin-core-service/institute/setting/v1/save-setting`,
            requestData,
            {
                params: {
                    instituteId,
                    settingKey: COURSE_SETTINGS_KEY,
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        // Update cache with the saved settings
        const mergedSettings = mergeWithDefaults(settings);
        setCachedSettings(mergedSettings);

        return response.data;
    } catch (error) {
        console.error('Error saving course settings:', error);
        throw error;
    }
};

/**
 * Merge provided settings with defaults to ensure all fields are present
 */
export const mergeWithDefaults = (settings: Partial<CourseSettingsData>): CourseSettingsData => {
    return {
        courseInformation: {
            ...DEFAULT_COURSE_SETTINGS.courseInformation,
            ...settings.courseInformation,
        },
        courseStructure: {
            ...DEFAULT_COURSE_SETTINGS.courseStructure,
            ...settings.courseStructure,
        },
        catalogueSettings: {
            ...DEFAULT_COURSE_SETTINGS.catalogueSettings,
            ...settings.catalogueSettings,
        },
        courseViewSettings: {
            ...DEFAULT_COURSE_SETTINGS.courseViewSettings,
            ...settings.courseViewSettings,
        },
        outlineSettings: {
            ...DEFAULT_COURSE_SETTINGS.outlineSettings,
            ...settings.outlineSettings,
        },
        permissions: {
            ...DEFAULT_COURSE_SETTINGS.permissions,
            ...settings.permissions,
        },
        dripConditions: {
            ...DEFAULT_COURSE_SETTINGS.dripConditions,
            ...settings.dripConditions,
            conditions: settings.dripConditions?.conditions || [],
        },
    };
};
