import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_SUB_ORG_ADMINS, GET_SUB_ORG_MEMBERS } from '@/constants/urls';

export interface SubOrgAdmin {
    user_id: string;
    name: string;
    role: string;
}

export interface SubOrgAdminsResponse {
    user_id: string;
    package_session_id: string;
    sub_org_id: string;
    admins: SubOrgAdmin[];
    total_admins: number;
}

export interface SubOrgMember {
    id: string;
    user_id: string;
    package_session_id: string;
    sub_org_id: string;
    user: {
        id: string;
        username: string;
        email: string;
        full_name: string;
        mobile_number: string;
        roles: string[];
    };
    status: string;
}

export interface SubOrgMembersResponse {
    sub_org_details: {
        id: string;
        name: string;
        status: string;
        [key: string]: any;
    };
    student_mappings: SubOrgMember[];
}

export const fetchSubOrgAdmins = async (
    userId: string,
    packageSessionId: string,
    subOrgId: string
): Promise<SubOrgAdminsResponse> => {
    const response = await authenticatedAxiosInstance.get<SubOrgAdminsResponse>(
        `${GET_SUB_ORG_ADMINS}`,
        {
            params: {
                userId,
                packageSessionId,
                subOrgId,
            },
        }
    );
    return response.data;
};

export const fetchSubOrgMembers = async (
    packageSessionId: string,
    subOrgId: string
): Promise<SubOrgMembersResponse> => {
    const response = await authenticatedAxiosInstance.get<SubOrgMembersResponse>(
        `${GET_SUB_ORG_MEMBERS}`,
        {
            params: {
                package_session_id: packageSessionId,
                sub_org_id: subOrgId,
            },
        }
    );
    return response.data;
};
