import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { INIT_INSTITUTE } from '@/constants/urls';
import { InstituteDetailsType } from '@/schemas/student/student-list/institute-schema';

export interface InstituteInfo {
    id: string;
    name: string;
    roles: string[];
    permissions: string[];
}

/**
 * Fetch institute details by ID
 */
export const fetchInstituteDetailsById = async (instituteId: string): Promise<InstituteDetailsType> => {
    try {
        const response = await authenticatedAxiosInstance<InstituteDetailsType>({
            method: 'GET',
            url: `${INIT_INSTITUTE}/${instituteId}`,
        });
        return response.data;
    } catch (error: any) {
        // Don't log 403 errors as they're expected for some institutes
        if (error?.response?.status !== 403) {
            console.error(`Error fetching institute details for ID ${instituteId}:`, error);
        }
        throw error;
    }
};

/**
 * Fetch institute details for multiple institutes
 */
export const fetchMultipleInstituteDetails = async (instituteIds: string[]): Promise<Record<string, InstituteDetailsType>> => {
    const instituteDetails: Record<string, InstituteDetailsType> = {};

    try {
        // Fetch institute details in parallel
        const promises = instituteIds.map(async (instituteId) => {
            try {
                const details = await fetchInstituteDetailsById(instituteId);
                return { id: instituteId, details };
            } catch (error: any) {
                // Don't log 403 errors as they're expected for some institutes
                if (error?.response?.status !== 403) {
                    console.error(`Failed to fetch details for institute ${instituteId}:`, error);
                }
                return { id: instituteId, details: null };
            }
        });

        const results = await Promise.all(promises);

        results.forEach(({ id, details }) => {
            instituteDetails[id] = details;
        });

        return instituteDetails;
    } catch (error) {
        console.error('Error fetching multiple institute details:', error);
        throw error;
    }
};

/**
 * Get institute name from details or fallback to ID
 */
export const getInstituteName = (instituteDetails: InstituteDetailsType | null, instituteId: string): string => {
    if (instituteDetails?.institute_name) {
        return instituteDetails.institute_name;
    }
    // Provide a more user-friendly fallback name
    return `Institute ${instituteId.slice(0, 8)}...`;
};
