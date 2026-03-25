import { getInstituteId } from '@/constants/helper';
import { GET_INVITE_LINKS, MAKE_INVITE_LINK_DEFAULT } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

const fetchInviteLinks = async (packageSessionIds: string[], pageNo: number, pageSize: number) => {
    const instituteId = getInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INVITE_LINKS,
        params: { instituteId, pageNo, pageSize },
        data: {
            search_name: '',
            package_session_ids: packageSessionIds,
            payment_option_ids: [],
            sort_columns: {},
            tags: [],
        },
    });
    return response?.data;
};
export const handleFetchInviteLinks = (
    packageSessionIds: string[],
    pageNo: number,
    pageSize: number
) => {
    return {
        queryKey: ['GET_INVITE_LINKS', packageSessionIds, pageNo, pageSize],
        queryFn: async () => {
            const data = await fetchInviteLinks(packageSessionIds, pageNo, pageSize);
            return data;
        },
        staleTime: 60 * 60 * 1000,
    };
};

export const handleMakeInviteLinkDefault = async (
    packageSessionId: string,
    inviteLinkId: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: MAKE_INVITE_LINK_DEFAULT,
        params: { enrollInviteId: inviteLinkId, packageSessionId },
    });
    return response?.data;
};
