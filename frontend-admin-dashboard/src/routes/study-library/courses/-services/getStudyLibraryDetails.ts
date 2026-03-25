// services/study-library/getStudyLibraryDetails.ts
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { INIT_STUDY_LIBRARY, INIT_COURSE_STUDY_LIBRARY } from '@/constants/urls';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// Get institute ID helper
const getInstituteId = () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);

    const authorities = tokenData?.authorities;
    if (!authorities) return undefined;

    const instituteIds = Object.keys(authorities);

    // Prioritize institute where the user is NOT a STUDENT
    const nonStudentInstituteId = instituteIds.find((id) => {
        const roles = authorities[id]?.roles;
        return roles && !roles.includes('STUDENT');
    });

    return nonStudentInstituteId || instituteIds[0];
};

// Fetch all courses study library data (no courseId)
export const fetchStudyLibraryDetails = async () => {
    const INSTITUTE_ID = getInstituteId();
    const response = await authenticatedAxiosInstance.get(INIT_STUDY_LIBRARY, {
        params: {
            instituteId: INSTITUTE_ID,
        },
    });
    return response.data;
};

// Fetch study library data for a specific course
export const fetchCourseStudyLibraryDetails = async (courseId: string) => {
    const INSTITUTE_ID = getInstituteId();
    const response = await authenticatedAxiosInstance.get(INIT_COURSE_STUDY_LIBRARY, {
        params: {
            courseId,
            instituteId: INSTITUTE_ID,
        },
    });
    return response.data;
};

export const useStudyLibraryQuery = (courseId?: string) => {
    const { setStudyLibraryData, setInitLoading } = useStudyLibraryStore();

    return {
        queryKey: courseId
            ? ['GET_INIT_STUDY_LIBRARY', 'course', courseId]
            : ['GET_INIT_STUDY_LIBRARY'],
        queryFn: async () => {
            setInitLoading(true);
            try {
                // Use course-init API when courseId is available
                const data = courseId
                    ? await fetchCourseStudyLibraryDetails(courseId)
                    : await fetchStudyLibraryDetails();
                setStudyLibraryData(data);
                return data;
            } finally {
                setInitLoading(false);
            }
        },
        staleTime: 3600000,
    };
};
