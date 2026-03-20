import { getTokenDecodedData, getTokenFromCookie } from './sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { GET_FACULTY_USER_ACCESS_DETAILS } from '@/constants/urls';
import authenticatedAxiosInstance from './axiosInstance';
import type {
    UserAccessDetailsResponse,
    AccessMapping,
    SubOrgAccess,
    FacultyAccessData,
    LinkageType,
} from '@/types/faculty-access';

const FACULTY_ACCESS_STORAGE_KEY = 'faculty_access_data';
const SELECTED_SUBORG_STORAGE_KEY = 'selected_suborg_id';

/**
 * Check if the user has HAS_FACULTY_ASSIGNED permission for the current institute
 */
export const hasFacultyAssignedPermission = (instituteId?: string): boolean => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);

    if (!tokenData || !tokenData.authorities || !instituteId) {
        return false;
    }

    const authority = tokenData.authorities[instituteId];
    if (!authority || !authority.permissions) {
        return false;
    }

    return authority.permissions.includes('HAS_FACULTY_ASSIGNED');
};

/**
 * Fetch user access details from the API
 */
export const fetchUserAccessDetails = async (
    userId: string,
    instituteId: string
): Promise<UserAccessDetailsResponse> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_FACULTY_USER_ACCESS_DETAILS,
            params: {
                userId,
                instituteId,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching user access details:', error);
        throw error;
    }
};

/**
 * Process access mappings to extract sub-org data and global filters
 */
export const processAccessMappings = (
    accessMappings: AccessMapping[]
): {
    subOrgs: SubOrgAccess[];
    globalPackageIds: string[];
    globalPackageSessionIds: string[];
    permissions: string[];
} => {
    const subOrgMap = new Map<string, SubOrgAccess>();
    const globalPackageIds: string[] = [];
    const globalPackageSessionIds: string[] = [];
    const globalPermissions = new Set<string>();

    accessMappings.forEach((mapping) => {
        if (mapping.status !== 'ACTIVE') {
            return;
        }

        const subOrgId = mapping.suborgId;

        // Parse permissions (comma-separated string)
        const mappingPermissions = mapping.accessPermission
            ? mapping.accessPermission.split(',').map((p) => p.trim())
            : [];

        // Aggregate into global permissions
        mappingPermissions.forEach((p) => {
            if (p) globalPermissions.add(p);
        });

        // Collect global filters (if no sub-org ID is present)
        if (!subOrgId) {
            if (mapping.accessType === 'PACKAGE' && mapping.accessId) {
                if (!globalPackageIds.includes(mapping.accessId)) {
                    globalPackageIds.push(mapping.accessId);
                }
            } else if (mapping.accessType === 'PACKAGE_SESSION' && mapping.accessId) {
                if (!globalPackageSessionIds.includes(mapping.accessId)) {
                    globalPackageSessionIds.push(mapping.accessId);
                }
            }
            return;
        }

        const linkageType =
            mapping.linkageType ?? (mapping as AccessMapping & { linkage_type?: LinkageType }).linkage_type;

        if (!subOrgMap.has(subOrgId)) {
            subOrgMap.set(subOrgId, {
                subOrgId,
                subOrgName: mapping.name,
                instituteLogoFileId: mapping.instituteLogoFileId,
                linkageType,
                packageIds: [],
                packageSessionIds: [],
                permissions: [],
            });
        }

        const subOrg = subOrgMap.get(subOrgId)!;
        if (linkageType === 'PARTNERSHIP') {
            subOrg.linkageType = 'PARTNERSHIP';
        } else if (subOrg.linkageType !== 'PARTNERSHIP') {
            subOrg.linkageType = linkageType;
        }
        const subOrgPermissions = new Set(subOrg.permissions);
        mappingPermissions.forEach((p) => {
            if (p) subOrgPermissions.add(p);
        });
        subOrg.permissions = Array.from(subOrgPermissions);

        if (mapping.accessType === 'PACKAGE' && mapping.accessId) {
            if (!subOrg.packageIds.includes(mapping.accessId)) {
                subOrg.packageIds.push(mapping.accessId);
            }
        } else if (mapping.accessType === 'PACKAGE_SESSION' && mapping.accessId) {
            if (!subOrg.packageSessionIds.includes(mapping.accessId)) {
                subOrg.packageSessionIds.push(mapping.accessId);
            }
        }
    });

    return {
        subOrgs: Array.from(subOrgMap.values()),
        globalPackageIds,
        globalPackageSessionIds,
        permissions: Array.from(globalPermissions),
    };
};

/**
 * Check if the faculty user has a specific permission
 */
export const hasFacultyPermission = (permission: string): boolean => {
    const facultyData = getFacultyAccessData();
    if (!facultyData) return false;

    // Check if the permission exists in the aggregate permissions
    return facultyData.permissions.includes(permission);
};

/**
 * Get faculty access data from localStorage
 */
export const getFacultyAccessData = (): FacultyAccessData | null => {
    try {
        const data = localStorage.getItem(FACULTY_ACCESS_STORAGE_KEY);
        if (!data) {
            return null;
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading faculty access data from localStorage:', error);
        return null;
    }
};

/**
 * Save faculty access data to localStorage
 */
export const saveFacultyAccessData = (data: FacultyAccessData): void => {
    try {
        localStorage.setItem(FACULTY_ACCESS_STORAGE_KEY, JSON.stringify(data));
        // Also sync the standalone selected sub-org ID for components that use getSelectedSubOrgId
        if (data.selectedSubOrgId) {
            localStorage.setItem(SELECTED_SUBORG_STORAGE_KEY, data.selectedSubOrgId);
        }
    } catch (error) {
        console.error('Error saving faculty access data to localStorage:', error);
    }
};

/**
 * Get selected sub-org ID from localStorage
 */
export const getSelectedSubOrgId = (): string | null => {
    try {
        return localStorage.getItem(SELECTED_SUBORG_STORAGE_KEY);
    } catch (error) {
        console.error('Error reading selected sub-org ID from localStorage:', error);
        return null;
    }
};

/**
 * Set selected sub-org ID in localStorage
 */
export const setSelectedSubOrgId = (subOrgId: string): void => {
    try {
        localStorage.setItem(SELECTED_SUBORG_STORAGE_KEY, subOrgId);
    } catch (error) {
        console.error('Error saving selected sub-org ID to localStorage:', error);
    }
};

/**
 * Clear faculty access data from localStorage
 */
export const clearFacultyAccessData = (): void => {
    try {
        localStorage.removeItem(FACULTY_ACCESS_STORAGE_KEY);
        localStorage.removeItem(SELECTED_SUBORG_STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing faculty access data from localStorage:', error);
    }
};

/**
 * Get accessible package and session IDs for the selected sub-org
 */
export const getAccessiblePackageFilters = (): {
    package_ids: string[];
    package_session_ids: string[];
} | null => {
    const facultyData = getFacultyAccessData();
    const selectedSubOrgId = getSelectedSubOrgId();

    if (!facultyData) {
        return null;
    }

    // If a sub-org is selected, return its filters
    if (selectedSubOrgId) {
        const subOrg = facultyData.subOrgs.find((s) => s.subOrgId === selectedSubOrgId);
        if (subOrg) {
            return {
                package_ids: subOrg.packageIds,
                package_session_ids: subOrg.packageSessionIds,
            };
        }
    }

    // Fallback to global filters if no sub-org is selected
    if (facultyData.globalPackageIds.length > 0 || facultyData.globalPackageSessionIds.length > 0) {
        return {
            package_ids: facultyData.globalPackageIds,
            package_session_ids: facultyData.globalPackageSessionIds,
        };
    }

    return null;
};

/**
 * Get the effective institute logo file ID, considering selected sub-org
 */
export const getEffectiveInstituteLogoFileId = (
    defaultLogoId?: string
): string | undefined => {
    const facultyData = getFacultyAccessData();
    const selectedSubOrgId = getSelectedSubOrgId();

    if (facultyData && selectedSubOrgId) {
        const subOrg = facultyData.subOrgs.find((s) => s.subOrgId === selectedSubOrgId);
        if (subOrg && subOrg.instituteLogoFileId) {
            return subOrg.instituteLogoFileId;
        }
    }

    return defaultLogoId;
};

/**
 * Get the effective institute name (sub-org name for faculty with selected sub-org, else default)
 */
export const getEffectiveInstituteName = (defaultName?: string): string | undefined => {
    const facultyData = getFacultyAccessData();
    const selectedSubOrgId = getSelectedSubOrgId();

    if (facultyData && selectedSubOrgId) {
        const subOrg = facultyData.subOrgs.find((s) => s.subOrgId === selectedSubOrgId);
        if (subOrg?.subOrgName) {
            return subOrg.subOrgName;
        }
    }

    return defaultName;
};

/**
 * Get the linkage type of the selected sub-org (e.g. PARTNERSHIP for "Powered by" display)
 */
export const getSelectedSubOrgLinkageType = (): LinkageType | undefined => {
    const facultyData = getFacultyAccessData();
    const selectedSubOrgId = getSelectedSubOrgId();

    if (facultyData && selectedSubOrgId) {
        const subOrg = facultyData.subOrgs.find((s) => s.subOrgId === selectedSubOrgId);
        return subOrg?.linkageType;
    }

    return undefined;
};
