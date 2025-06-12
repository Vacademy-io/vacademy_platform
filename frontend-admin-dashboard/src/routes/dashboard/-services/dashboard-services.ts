import {
    ADD_USER_ROLES_URL,
    DELETE_DISABLE_USER_URL,
    GET_DASHBOARD_ASSESSMENT_COUNT_URL,
    GET_DASHBOARD_URL,
    GET_INSTITUTE_USERS,
    INVITE_TEACHERS_URL,
    INVITE_USERS_URL,
    RESEND_INVITATION_URL,
    UPDATE_DASHBOARD_URL,
    UPDATE_USER_INVITATION_URL,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { RoleTypeSelectedFilter } from '../-components/RoleTypeComponent';
import { z } from 'zod';
import { inviteUsersSchema } from '../-components/InviteUsersComponent';
import { UserRolesDataEntry } from '@/types/dashboard/user-roles';
import { editDashboardProfileSchema } from '../-utils/edit-dashboard-profile-schema';

export const fetchInstituteDashboardDetails = async (instituteId: string | undefined) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_DASHBOARD_URL,
        params: {
            instituteId,
        },
    });
    return response.data;
};

export const fetchAssessmentsCountDetailsForInstitute = async (instituteId: string | undefined) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_DASHBOARD_ASSESSMENT_COUNT_URL,
        params: {
            instituteId,
        },
    });
    return response.data;
};

export const getInstituteDashboardData = (instituteId: string | undefined) => {
    return {
        queryKey: ['GET_INSTITUTE_DASHBOARD_DATA', instituteId],
        queryFn: async () => {
            const data = await fetchInstituteDashboardDetails(instituteId);
            return data;
        },
        staleTime: 3600000,
    };
};

export const getAssessmentsCountsData = (instituteId: string | undefined) => {
    return {
        queryKey: ['GET_ASSESSMENT_COUNT_DATA', instituteId],
        queryFn: async () => {
            const data = await fetchAssessmentsCountDetailsForInstitute(instituteId);
            return data;
        },
        staleTime: 3600000,
    };
};

export const fetchInstituteDashboardUsers = async (
    instituteId: string | undefined,
    selectedFilter: RoleTypeSelectedFilter
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: {
            instituteId,
        },
        data: {
            roles: selectedFilter.roles.map((role) => role.name),
            status: selectedFilter.status.map((status) => status.name),
        },
    });
    return response.data;
};

export const handleGetInstituteUsersForAccessControl = (
    instituteId: string | undefined,
    selectedFilter: RoleTypeSelectedFilter
) => {
    return {
        queryKey: ['GET_INSTITUTE_USERS_FOR_ACCESS_CONTROL', instituteId, selectedFilter],
        queryFn: async () => {
            const data = await fetchInstituteDashboardUsers(instituteId, selectedFilter);
            return data;
        },
        staleTime: 3600000,
    };
};

export const handleInviteUsers = async (
    instituteId: string | undefined,
    data: z.infer<typeof inviteUsersSchema>
) => {
    let url = INVITE_USERS_URL;
    const userData = {
        email: data.email,
        full_name: data.name,
        roles: data.roleType,
        root_user: false,
    };
    type UserPayload =
        | typeof userData
        | {
              user: typeof userData;
              batch_subject_mappings: typeof data.batch_subject_mappings;
              new_user: boolean;
          };
    let payload: UserPayload = userData;
    if (data.roleType.includes('TEACHER') && data.batch_subject_mappings) {
        url = INVITE_TEACHERS_URL;
        payload = {
            user: userData,
            // @ts-expect-error : batch_subject_mappings is not defined in the type
            batch_subject_mappings: data.batch_subject_mappings.map((batch) => ({
                batch_id: batch.batchId,
                subject_ids: batch.subjectIds,
            })),
            new_user: true,
        };
    }
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url,
        params: {
            instituteId,
        },
        data: payload,
    });
    return response.data;
};

export const handleDeleteDisableDashboardUsers = async (
    instituteId: string | undefined,
    status: string,
    userId: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: DELETE_DISABLE_USER_URL,
        params: {
            instituteId,
            status,
        },
        data: [userId],
    });
    return response.data;
};

export const handleAddUserDashboardRoles = async (
    roles: string[],
    userId: string,
    instituteId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: ADD_USER_ROLES_URL,
        data: {
            roles: roles,
            user_id: userId,
            institute_id: instituteId,
        },
    });
    return response.data;
};

export const handleUpdateUserInvitation = async (
    instituteId: string | undefined,
    data: z.infer<typeof inviteUsersSchema>,
    student: UserRolesDataEntry
) => {
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: UPDATE_USER_INVITATION_URL,
        params: {
            instituteId,
        },
        data: {
            ...student,
            full_name: data.name,
            email: data.email,
            roles: data.roleType,
        },
    });
    return response.data;
};

export const handleResendUserInvitation = async (userId: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: RESEND_INVITATION_URL,
        params: {
            userId,
        },
    });
    return response.data;
};

export const handleUpdateInstituteDashboard = async (
    data: z.infer<typeof editDashboardProfileSchema>,
    instituteId: string | undefined
) => {
    const convertedData = {
        institute_name: data.instituteName,
        id: instituteId,
        country: data.instituteCountry,
        state: data.instituteState,
        city: data.instituteCity,
        address: data.instituteAddress,
        pin_code: data.institutePinCode,
        phone: data.institutePhoneNumber,
        email: data.instituteEmail,
        website_url: data.instituteWebsite,
        institute_logo_file_id: data.instituteProfilePictureId,
        institute_theme_code: data.instituteThemeCode,
        language: '',
        description: '',
        type: data.instituteType,
        held_by: '',
        founded_date: '',
        module_request_ids: [],
        sub_modules: [],
        sessions: [],
        batches_for_sessions: [],
        levels: [],
        genders: [],
        student_statuses: [],
        subjects: [],
        session_expiry_days: [],
        letter_head_file_id: '',
    };
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: UPDATE_DASHBOARD_URL,
        data: convertedData,
        params: {
            instituteId,
        },
    });
    return response?.data;
};
