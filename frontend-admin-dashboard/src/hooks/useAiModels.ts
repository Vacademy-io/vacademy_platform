import { useQuery } from '@tanstack/react-query';
import { fetchAllAIModels, fetchAIModelsForUseCase } from '@/services/aiModelsService';
import { AIModelsListResponse, AIModelUseCaseResponse } from '@/types/ai-models';

export const useAIModelsList = (filters?: {
    tier?: string;
    provider?: string;
    is_free?: boolean;
    use_case?: string;
}) => {
    return useQuery<AIModelsListResponse>({
        queryKey: ['ai-models-list', filters],
        queryFn: () => fetchAllAIModels(filters),
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });
};

export const useAIModelsForUseCase = (useCase: string) => {
    return useQuery<AIModelUseCaseResponse>({
        queryKey: ['ai-models-use-case', useCase],
        queryFn: () => fetchAIModelsForUseCase(useCase),
        enabled: !!useCase,
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });
};
