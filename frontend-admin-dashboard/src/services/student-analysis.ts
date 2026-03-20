import { STUDENT_ANALYSIS_BASE } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    InitiateAnalysisRequest,
    InitiateAnalysisResponse,
    ReportListResponse,
    StudentReport,
} from '@/types/student-analysis';

/**
 * Initiate student analysis report generation
 * @param payload - Request payload containing user_id and date range
 * @param instituteId - Institute ID
 * @returns Response containing process_id and status
 */
export const initiateStudentAnalysis = async (
    payload: Omit<InitiateAnalysisRequest, 'institute_id'>,
    instituteId: string
): Promise<InitiateAnalysisResponse> => {
    try {
        const response = await authenticatedAxiosInstance.post(
            `${STUDENT_ANALYSIS_BASE}/initiate`,
            {
                ...payload,
                institute_id: instituteId,
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error initiating student analysis:', error);
        throw error;
    }
};

/**
 * Get all completed reports for a user
 * @param userId - User ID to fetch reports for
 * @param instituteId - Institute ID
 * @param page - Page number (default 0)
 * @param size - Page size (default 10)
 * @returns Paginated list of reports
 */
export const getStudentReports = async (
    userId: string,
    instituteId: string,
    page: number = 0,
    size: number = 10
): Promise<ReportListResponse> => {
    try {
        // Note: The API might not strictly require instituteId in the URL if it's inferred from the user or token,
        // but passing it as a query param or header is good practice if the API supports it.
        // Based on system-files.tsx, it often appends ?instituteId=...
        // However, the API definition in api.md didn't specify instituteId for GET /reports/user/{userId}.
        // But to be consistent with the "pattern", I'll just keep the signature and use it if needed.
        // If the API doesn't take it, I won't send it, but I'll keep the function signature consistent.
        // Actually, let's look at api.md again. It says "Institute Scope: Analysis is scoped to the specified institute_id".
        // But the GET endpoint is `/admin-core-service/v1/student-analysis/reports/user/{userId}`.
        // It doesn't explicitly ask for instituteId in query params.
        // But `system-files.tsx` appends `?instituteId=${instituteId}` to almost every request.
        // I will append it as a query param to be safe/consistent, assuming the backend might use it or ignore it.

        const response = await authenticatedAxiosInstance.get(
            `${STUDENT_ANALYSIS_BASE}/reports/user/${userId}`,
            {
                params: {
                    page,
                    size,
                    instituteId, // Adding it here just in case, or to match the pattern
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching student reports:', error);
        throw error;
    }
};

/**
 * Get report details by process ID
 * @param processId - Process ID of the report
 * @returns Report details including status and data
 */
export const getStudentReport = async (processId: string): Promise<StudentReport> => {
    try {
        const response = await authenticatedAxiosInstance.get(
            `${STUDENT_ANALYSIS_BASE}/report/${processId}`
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching student report details:', error);
        throw error;
    }
};
