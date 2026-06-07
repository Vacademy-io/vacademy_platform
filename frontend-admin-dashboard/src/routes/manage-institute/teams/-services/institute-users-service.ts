import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_USERS } from '@/constants/urls';

export interface InstituteUser {
    id: string;
    full_name: string;
    email: string | null;
    mobile_number?: string | null;
    profile_pic_file_id?: string | null;
    roles?: string[];
}

/**
 * Fetch every non-student member of the institute. Used by the Org Chart
 * "Add member" dialog. The auth_service filter is OR-additive on roles, so
 * we pass every supported non-student role explicitly.
 */
export async function fetchEligibleOrgUsers(instituteId: string): Promise<InstituteUser[]> {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: { instituteId, pageNumber: 0, pageSize: 500 },
        data: {
            roles: ['ADMIN', 'TEACHER', 'COUNSELLOR', 'MARKETER', 'EVALUATOR'],
            status: ['ACTIVE'],
        },
    });
    const raw = Array.isArray(response.data) ? response.data : response.data?.content ?? [];
    return raw.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        full_name: (u.full_name as string) ?? '',
        email: (u.email as string) || null,
        mobile_number: (u.mobile_number as string) ?? null,
        profile_pic_file_id: (u.profile_pic_file_id as string) ?? null,
        roles: Array.isArray((u as { roles?: { role_name?: string }[] }).roles)
            ? ((u as { roles: { role_name?: string }[] }).roles)
                  .map((r) => r.role_name)
                  .filter((r): r is string => !!r)
            : [],
    }));
}
