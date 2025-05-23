// services/study-library/getModulesWithChapters.ts
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_MODULES_WITH_CHAPTERS } from '@/constants/urls';
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';
import { useQuery } from '@tanstack/react-query';
export const fetchModulesWithChapters = async (subjectId: string, packageSessionId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_MODULES_WITH_CHAPTERS, {
        params: {
            subjectId: subjectId,
            packageSessionId: packageSessionId,
        },
    });
    return response.data;
};

export const useModulesWithChaptersQuery = (subjectId: string, packageSessionId: string) => {
    const setModulesData = useModulesWithChaptersStore((state) => state.setModulesWithChaptersData);
    return useQuery({
        queryKey: ['GET_MODULES_WITH_CHAPTERS', subjectId, packageSessionId],
        queryFn: async () => {
            const data = await fetchModulesWithChapters(subjectId, packageSessionId);
            setModulesData(data);
            return data;
        },
        staleTime: 3600000,
        enabled: !!subjectId && !!packageSessionId,
        refetchOnMount: 'always',
    });
};
