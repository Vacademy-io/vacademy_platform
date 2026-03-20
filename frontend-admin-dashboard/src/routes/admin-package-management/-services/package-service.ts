import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    PAGINATED_BATCHES,
    BATCHES_BY_IDS,
    BATCHES_SUMMARY,
    GET_INVITE_LINKS,
    GET_SINGLE_INVITE_DETAILS,
    GET_COURSE_DETAILS,
    UPDATE_COURSE_BY_ID,
    DELETE_COURSE,
    GET_FACULTY_ASSIGNMENTS,
    UPDATE_FACULTY_ASSIGNMENTS,
    INVITE_TEACHERS_URL,
    GET_COURSE_BATCHES,
    UPDATE_BATCH_INVENTORY,
    DELETE_BATCHES,
    UPDATE_INVITE_URL,
    MAKE_INVITE_LINK_DEFAULT,
    UPDATE_INVITE_PAYMENT_OPTION_URL,
    DELETE_INVITES,
    SAVE_PAYMENT_OPTION,
    DELETE_PAYMENT_OPTION_URL,
    GET_INSTITUTE_USERS,
} from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    PaginatedBatchesResponse,
    BatchesSummaryResponse,
    PackageFilterRequest,
    EnrollInviteListResponse,
    EnrollInviteDetail,
    PackageDTO,
    UpdateCourseRequest,
    FacultyAssignmentRequest,
    UpdateEnrollInviteRequest,
    UpdateInvitePaymentOptionRequest,
    UpdatePaymentOptionRequest,
    InstructorDTO,
    FacultyAssignmentResponse,
    PackageSessionDTO,
} from '../-types/package-types';

export const fetchPaginatedBatches = async (
    filters: PackageFilterRequest
): Promise<PaginatedBatchesResponse> => {
    const instituteId = getCurrentInstituteId();

    const params = new URLSearchParams();
    params.append('page', String(filters.page));
    params.append('size', String(filters.size));

    if (filters.sessionId) params.append('sessionId', filters.sessionId);
    if (filters.levelId) params.append('levelId', filters.levelId);
    if (filters.packageId) params.append('packageId', filters.packageId);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortDirection) params.append('sortDirection', filters.sortDirection);
    if (filters.statuses && filters.statuses.length > 0) {
        filters.statuses.forEach((status) => params.append('statuses', status));
    }

    const response = await authenticatedAxiosInstance<PaginatedBatchesResponse>({
        method: 'GET',
        url: `${PAGINATED_BATCHES}/${instituteId}?${params.toString()}`,
    });

    return response.data;
};

export const fetchBatchesByIds = async (ids: string[]): Promise<{ content: unknown[] }> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${BATCHES_BY_IDS}/${instituteId}`,
        data: { ids },
    });

    return response.data;
};

export const fetchBatchesSummary = async (statuses?: string[]): Promise<BatchesSummaryResponse> => {
    const instituteId = getCurrentInstituteId();

    const params = new URLSearchParams();
    if (statuses && statuses.length > 0) {
        statuses.forEach((status) => params.append('statuses', status));
    }

    const response = await authenticatedAxiosInstance<BatchesSummaryResponse>({
        method: 'GET',
        url: `${BATCHES_SUMMARY}/${instituteId}${params.toString() ? `?${params.toString()}` : ''}`,
    });

    return response.data;
};

export const fetchEnrollInvites = async (
    packageSessionId: string
): Promise<EnrollInviteListResponse> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<EnrollInviteListResponse>({
        method: 'POST',
        url: `${GET_INVITE_LINKS}?instituteId=${instituteId}&pageNo=0&pageSize=10`,
        data: {
            search_name: '',
            package_session_ids: [packageSessionId],
            payment_option_ids: [],
            sort_columns: {},
            tags: [],
        },
    });

    return response.data;
};

export const fetchEnrollInviteDetail = async (
    enrollInviteId: string
): Promise<EnrollInviteDetail> => {
    const instituteId = getCurrentInstituteId() || '';
    const url = GET_SINGLE_INVITE_DETAILS.replace('{instituteId}', instituteId).replace(
        '{enrollInviteId}',
        enrollInviteId
    );

    const response = await authenticatedAxiosInstance<EnrollInviteDetail>({
        method: 'GET',
        url: `${url}?instituteId=${instituteId}&enrollInviteId=${enrollInviteId}`,
    });

    return response.data;
};

// Course Management
export const fetchPackageDetails = async (packageId: string): Promise<PackageDTO> => {
    const response = await authenticatedAxiosInstance<PackageDTO>({
        method: 'GET',
        url: `${GET_COURSE_DETAILS}?packageId=${packageId}`,
    });
    return response.data;
};

export const updatePackageDetails = async (
    courseId: string,
    data: UpdateCourseRequest
): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${UPDATE_COURSE_BY_ID}/${courseId}`,
        data,
    });
};

export const deletePackages = async (ids: string[]): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: DELETE_COURSE,
        data: ids,
    });
};

// Faculty Management
export const fetchFacultyAssignments = async (
    userId: string
): Promise<FacultyAssignmentResponse | FacultyAssignmentResponse[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_FACULTY_ASSIGNMENTS}?userId=${userId}`,
    });
    return response.data;
};

export const assignFaculty = async (data: FacultyAssignmentRequest): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'POST',
        url: INVITE_TEACHERS_URL,
        data,
    });
};

export const updateFacultyAssignment = async (data: FacultyAssignmentRequest): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: UPDATE_FACULTY_ASSIGNMENTS,
        data,
    });
};

export const fetchInstructors = async (name: string = ''): Promise<InstructorDTO[]> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: {
            instituteId,
            pageNumber: 0,
            pageSize: 50,
        },
        data: {
            roles: ['TEACHER'],
            status: ['ACTIVE'],
            name,
        },
    });
    return response.data?.content || [];
};

// Batch Management
export const fetchCourseBatches = async (courseId: string): Promise<PackageSessionDTO[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_COURSE_BATCHES}/${courseId}/batches`,
    });
    return response.data;
};

export const updateBatchInventory = async (
    packageSessionId: string,
    maxSeats: number
): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${UPDATE_BATCH_INVENTORY}/${packageSessionId}/inventory/update-capacity`,
        data: { max_seats: maxSeats },
    });
};

export const deleteBatches = async (ids: string[]): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: DELETE_BATCHES,
        data: ids,
    });
};

// Enroll Invite Management
export const updateEnrollInvite = async (data: UpdateEnrollInviteRequest): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: UPDATE_INVITE_URL,
        data,
    });
};

export const resetInviteConfig = async (
    enrollInviteId: string,
    packageSessionId: string
): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${MAKE_INVITE_LINK_DEFAULT}?enrollInviteId=${enrollInviteId}&packageSessionId=${packageSessionId}`,
    });
};

export const updateInvitePaymentOptions = async (
    data: UpdateInvitePaymentOptionRequest[]
): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: UPDATE_INVITE_PAYMENT_OPTION_URL,
        data,
    });
};

export const deleteEnrollInvites = async (ids: string[]): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: DELETE_INVITES,
        data: ids,
    });
};

// Payment Option Management
export const updatePaymentOption = async (data: UpdatePaymentOptionRequest): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'PUT',
        url: SAVE_PAYMENT_OPTION,
        data,
    });
};

export const deletePaymentOptions = async (ids: string[]): Promise<void> => {
    await authenticatedAxiosInstance({
        method: 'DELETE',
        url: DELETE_PAYMENT_OPTION_URL,
        data: ids,
    });
};
