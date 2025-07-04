// services/study-library/getModulesWithChapters.ts
import { MODULES_WITH_CHAPTERS } from '@/constants/urls';
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const fetchModulesWithChapters = async (subjectId: string, packageSessionId: string) => {
    const response = await axios.get(MODULES_WITH_CHAPTERS, {
        params: {
            subjectId: subjectId,
            packageSessionId: packageSessionId,
        },
    });
    return response.data;
};

export const handleFetchModulesWithChapters = (subjectId: string, packageSessionId: string) => {
    return {
        queryKey: ['MODULES_WITH_CHAPTERS', subjectId, packageSessionId],
        queryFn: () => fetchModulesWithChapters(subjectId, packageSessionId),
        staleTime: 60 * 60 * 1000,
    };
};

export const useModulesWithChaptersQuery = (subjectId: string, packageSessionId: string) => {
    const setModulesData = useModulesWithChaptersStore((state) => state.setModulesWithChaptersData);
    return useQuery({
        queryKey: ['MODULES_WITH_CHAPTERS', subjectId, packageSessionId],
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
