import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INVITE_LINKS } from '@/constants/urls';
import { EnrollInviteProjection } from '../-types/bulk-assign-types';

interface InviteListResponse {
    content: EnrollInviteProjection[];
    total_elements: number;
    total_pages: number;
}

const fetchInvitesForPackageSession = async ({
    instituteId,
    packageSessionId,
    pageNo = 0,
    pageSize = 20,
}: {
    instituteId: string;
    packageSessionId: string;
    pageNo?: number;
    pageSize?: number;
}): Promise<InviteListResponse> => {
    const response = await authenticatedAxiosInstance.post<InviteListResponse>(
        `${GET_INVITE_LINKS}?instituteId=${instituteId}&pageNo=${pageNo}&pageSize=${pageSize}`,
        {
            package_session_ids: [packageSessionId],
            sort_columns: { created_at: 'desc' },
        }
    );
    return response.data;
};

export const useInvitesForPackageSession = ({
    instituteId,
    packageSessionId,
    pageNo = 0,
    pageSize = 20,
    enabled = true,
}: {
    instituteId: string;
    packageSessionId: string;
    pageNo?: number;
    pageSize?: number;
    enabled?: boolean;
}) => {
    return useQuery({
        queryKey: ['invites-for-ps', instituteId, packageSessionId, pageNo, pageSize],
        queryFn: () =>
            fetchInvitesForPackageSession({ instituteId, packageSessionId, pageNo, pageSize }),
        enabled: enabled && !!instituteId && !!packageSessionId,
        staleTime: 5 * 60 * 1000,
    });
};
