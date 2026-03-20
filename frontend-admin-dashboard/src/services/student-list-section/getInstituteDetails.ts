import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import axios from 'axios';
import {
    InstituteDetails,
    InstituteDetailsType,
    SubModuleType,
} from '@/schemas/student/student-list/institute-schema';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    HOLISTIC_INSTITUTE_ID,
    INIT_INSTITUTE,
    INIT_INSTITUTE_WITHOUT_BATCHES,
    INIT_INSTITUTE_SETUP,
    DOMAIN_ROUTING_RESOLVE,
} from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useTheme } from '@/providers/theme/theme-provider';
import { StorageKey } from '@/constants/storage/storage';
import useLocalStorage from '@/hooks/use-local-storage';
import { isNullOrEmptyOrUndefined } from '@/lib/utils';
import { NamingSettingsType } from '@/routes/settings/-constants/terms';

// Cache duration: 1 hour
const CACHE_STALE_TIME = 3600000;

// Fetch setup data (lightweight - no batches)
export const fetchInstituteSetup = async (): Promise<any> => {
    const INSTITUTE_ID = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${INIT_INSTITUTE_SETUP}/${INSTITUTE_ID}`,
    });

    // Transform the nested response to flat structure
    const setupData = response.data;
    const transformedData = {
        ...setupData.institute_info_dto,
        sub_modules: Array.isArray(setupData.institute_info_dto?.sub_modules)
            ? setupData.institute_info_dto?.sub_modules
            : [],
        sub_org_roles: setupData.sub_org_roles || [],
        dropdown_custom_fields: setupData.dropdown_custom_fields || [],
    };

    return transformedData;
};

// Fetch full institute details (includes batches_for_sessions - heavy)
export const fetchInstituteDetails = async (): Promise<InstituteDetailsType> => {
    const INSTITUTE_ID = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance<InstituteDetailsType>({
        method: 'GET',
        url: `${INIT_INSTITUTE}/${INSTITUTE_ID}`,
    });
    return response.data;
};

/**
 * Fetch institute details by institute ID (e.g. sub-org institute ID).
 * Uses details-non-batches for a lighter response (name, logo, etc. without batch data).
 */
export const fetchInstituteDetailsById = async (
    instituteId: string
): Promise<Pick<InstituteDetails, 'id' | 'institute_name' | 'institute_logo_file_id'>> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${INIT_INSTITUTE_WITHOUT_BATCHES}/${instituteId}`,
    });
    return response.data;
};

// Fetch domain routing details
export const fetchInstituteRoutingDetails = async (): Promise<any> => {
    try {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        let domain = hostname;
        let subdomain = '';

        if (hostname.includes('localhost')) {
            if (parts.length > 1) {
                domain = 'localhost';
                subdomain = parts.slice(0, -1).join('.');
            }
        } else {
            // Assume the last two parts are the domain (e.g. vacademy.io)
            if (parts.length > 2) {
                domain = parts.slice(-2).join('.');
                subdomain = parts.slice(0, -2).join('.');
            }
        }

        const response = await axios.get(DOMAIN_ROUTING_RESOLVE, {
            params: {
                domain,
                subdomain: subdomain || undefined,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching domain routing details:', error);
        return {};
    }
};

// Fetch lightweight data only (setup + routing, NO batches)
export const fetchLightweightInstituteData = async (): Promise<InstituteDetailsType> => {
    const [setupData, routingData] = await Promise.all([
        fetchInstituteSetup(),
        fetchInstituteRoutingDetails(),
    ]);

    // Merge setup + routing (no INIT_INSTITUTE call)
    const mergedData: InstituteDetailsType = {
        ...setupData,
        ...routingData,
        sub_org_roles: setupData?.sub_org_roles || [],
        dropdown_custom_fields: setupData?.dropdown_custom_fields || [],
        // Initialize empty batches - will be lazy loaded
        batches_for_sessions: [],
        levels: setupData?.levels || [],
        sessions: setupData?.sessions || [],
        subjects: setupData?.subjects || [],
        session_expiry_days: setupData?.session_expiry_days || [],
        student_statuses: setupData?.student_statuses || [],
        genders: setupData?.genders || [],
        tags: setupData?.tags || [],
    };

    return mergedData;
};

// Fetch both APIs in parallel and merge the results (full data including batches)
export const fetchBothInstituteAPIs = async (): Promise<InstituteDetailsType> => {
    const [instituteData, setupData, routingData] = await Promise.all([
        fetchInstituteDetails(),
        fetchInstituteSetup(),
        fetchInstituteRoutingDetails(),
    ]);

    // Merge: base institute data + setup data overlay (filters from setup take precedence) + routing data
    const mergedData: InstituteDetailsType = {
        ...instituteData,
        ...routingData, // Merge routing data (app links, etc)
        // Override/add filter-related fields from INIT_INSTITUTE_SETUP
        sub_org_roles: setupData?.sub_org_roles || [],
        dropdown_custom_fields: setupData?.dropdown_custom_fields || [],
        // Keep batches_for_sessions from INIT_INSTITUTE (setup-without-batches returns empty)
        batches_for_sessions: instituteData?.batches_for_sessions || [],
        // Ensure required arrays are never undefined
        levels: instituteData?.levels || [],
        sessions: instituteData?.sessions || [],
        subjects: instituteData?.subjects || [],
        session_expiry_days: instituteData?.session_expiry_days || [],
        student_statuses: instituteData?.student_statuses || [],
        genders: instituteData?.genders || [],
        tags: instituteData?.tags || [],
        sub_modules: Array.isArray(instituteData?.sub_modules) ? instituteData?.sub_modules : [],
    };

    return mergedData;
};

/**
 * Lightweight query - for initial page load
 * Only fetches setup + routing data (NO batches_for_sessions)
 * Fast and lightweight for pages that don't need batch data
 */
export const useInstituteLightweightQuery = () => {
    const setInstituteDetails = useInstituteDetailsStore((state) => state.setInstituteDetails);
    const { setValue } = useLocalStorage<NamingSettingsType[] | null>(
        StorageKey.NAMING_SETTINGS,
        null
    );
    const { setValue: setModules } = useLocalStorage<SubModuleType[] | null>(
        StorageKey.MODULES,
        null
    );
    const { setPrimaryColor } = useTheme();

    return {
        queryKey: ['GET_INSTITUTE_LIGHTWEIGHT', 'v1'],
        queryFn: async () => {
            const data = await fetchLightweightInstituteData();
            const INSTITUTE_ID = getCurrentInstituteId();

            // Try to parse settings if they exist
            try {
                if (data?.setting) {
                    const instituteSettings = JSON.parse(data.setting);
                    if (!isNullOrEmptyOrUndefined(instituteSettings)) {
                        const namingSettings = instituteSettings.setting?.NAMING_SETTING;
                        if (namingSettings) {
                            setValue(namingSettings.data.data);
                        }
                    }
                }
                if (data && !isNullOrEmptyOrUndefined(data.sub_modules)) {
                    setModules(data.sub_modules);
                }
            } catch (error) {
                console.error('Error setting naming settings:', error);
            }
            // Set holistic theme for specific institute ID
            if (INSTITUTE_ID === HOLISTIC_INSTITUTE_ID) {
                setPrimaryColor('holistic');
            } else {
                setPrimaryColor(data?.institute_theme_code || '#ED7424');
            }

            setInstituteDetails(data);
            return data;
        },
        staleTime: CACHE_STALE_TIME,
    };
};

/**
 * Full query - includes batches_for_sessions
 * Use this when you need batch data (course creation, student management, assessments)
 * This is heavier but cached aggressively
 */
export const useInstituteFullQuery = () => {
    const setInstituteDetails = useInstituteDetailsStore((state) => state.setInstituteDetails);
    const { setValue } = useLocalStorage<NamingSettingsType[] | null>(
        StorageKey.NAMING_SETTINGS,
        null
    );
    const { setValue: setModules } = useLocalStorage<SubModuleType[] | null>(
        StorageKey.MODULES,
        null
    );
    const { setPrimaryColor } = useTheme();

    return {
        queryKey: ['GET_INSTITUTE_FULL', 'v1'],
        queryFn: async () => {
            const data = await fetchBothInstituteAPIs();
            const INSTITUTE_ID = getCurrentInstituteId();

            // Try to parse settings if they exist
            try {
                if (data?.setting) {
                    const instituteSettings = JSON.parse(data.setting);
                    if (!isNullOrEmptyOrUndefined(instituteSettings)) {
                        const namingSettings = instituteSettings.setting?.NAMING_SETTING;
                        if (namingSettings) {
                            setValue(namingSettings.data.data);
                        }
                    }
                }
                if (data && !isNullOrEmptyOrUndefined(data.sub_modules)) {
                    setModules(data.sub_modules);
                }
            } catch (error) {
                console.error('Error setting naming settings:', error);
            }
            // Set holistic theme for specific institute ID
            if (INSTITUTE_ID === HOLISTIC_INSTITUTE_ID) {
                setPrimaryColor('holistic');
            } else {
                setPrimaryColor(data?.institute_theme_code || '#ED7424');
            }

            setInstituteDetails(data);
            return data;
        },
        staleTime: CACHE_STALE_TIME,
    };
};

/**
 * Main query hook - backward compatible
 * @deprecated Use useInstituteLightweightQuery for pages without batch needs,
 * or useInstituteFullQuery for pages that need batches_for_sessions
 */
export const useInstituteQuery = () => {
    const setInstituteDetails = useInstituteDetailsStore((state) => state.setInstituteDetails);
    const { setValue } = useLocalStorage<NamingSettingsType[] | null>(
        StorageKey.NAMING_SETTINGS,
        null
    );
    const { setValue: setModules } = useLocalStorage<SubModuleType[] | null>(
        StorageKey.MODULES,
        null
    );
    const { setPrimaryColor } = useTheme();

    return {
        queryKey: ['GET_BOTH_INSTITUTE_APIS', 'v4'],
        queryFn: async () => {
            const data = await fetchBothInstituteAPIs();
            const INSTITUTE_ID = getCurrentInstituteId();

            // Try to parse settings if they exist
            try {
                if (data?.setting) {
                    const instituteSettings = JSON.parse(data.setting);
                    if (!isNullOrEmptyOrUndefined(instituteSettings)) {
                        const namingSettings = instituteSettings.setting?.NAMING_SETTING;
                        if (namingSettings) {
                            setValue(namingSettings.data.data);
                        }
                    }
                }
                if (data && !isNullOrEmptyOrUndefined(data.sub_modules)) {
                    setModules(data.sub_modules);
                }
            } catch (error) {
                console.error('Error setting naming settings:', error);
            }
            // Set holistic theme for specific institute ID
            if (INSTITUTE_ID === HOLISTIC_INSTITUTE_ID) {
                setPrimaryColor('holistic');
            } else {
                setPrimaryColor(data?.institute_theme_code || '#ED7424');
            }

            setInstituteDetails(data);
            return data;
        },
        staleTime: CACHE_STALE_TIME,
    };
};

/** Query options for sub-org institute details (suborgId = institute ID of the sub-org) */
export const getSubOrgInstituteQuery = (suborgId: string | null) => ({
    queryKey: ['SUBORG_INSTITUTE_DETAILS', suborgId] as const,
    queryFn: () => fetchInstituteDetailsById(suborgId!),
    enabled: !!suborgId,
    staleTime: CACHE_STALE_TIME,
});
