import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ContactListRequest, ContactListResponse } from '../-types/contact-types';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { GET_CONTACTS_LIST } from '@/constants/urls';

const FETCH_CONTACTS_URL = GET_CONTACTS_LIST;

export const fetchContacts = async (
    request: Omit<ContactListRequest, 'institute_id'>
): Promise<ContactListResponse> => {
    const institute_id = getCurrentInstituteId() || '';
    const payload: ContactListRequest = {
        ...request,
        institute_id,
        // Default values as per requirement (can be overridden by request)
        include_institute_users: request.include_institute_users ?? true,
        include_audience_respondents: request.include_audience_respondents ?? true,
    };

    const response = await authenticatedAxiosInstance.post<ContactListResponse>(
        FETCH_CONTACTS_URL,
        payload
    );
    return response.data;
};

export const useContactList = (
    request: Omit<ContactListRequest, 'institute_id'>
) => {
    return useQuery({
        queryKey: ['contacts', request],
        queryFn: () => fetchContacts(request),
        enabled: true,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
