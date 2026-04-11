import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { INIT_INSTITUTE_SETUP } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const fetchInstituteTags = async (): Promise<string[]> => {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return [];
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${INIT_INSTITUTE_SETUP}/${instituteId}`,
    });
    const tags = response.data?.institute_info_dto?.tags;
    return Array.isArray(tags) ? tags : [];
};

export const useInstituteTags = () => {
    const { data: tags = [], isLoading } = useQuery({
        queryKey: ['institute-tags'],
        queryFn: fetchInstituteTags,
        staleTime: 5 * 60 * 1000,
    });
    return { tags, isLoading };
};
