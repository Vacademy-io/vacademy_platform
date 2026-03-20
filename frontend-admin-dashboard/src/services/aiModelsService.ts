import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_AI_MODELS_V2, GET_AI_MODELS_USE_CASE } from '@/constants/urls';
import { AIModelsListResponse, AIModelUseCaseResponse } from '@/types/ai-models';

export const fetchAllAIModels = async (filters?: {
    tier?: string;
    provider?: string;
    is_free?: boolean;
    use_case?: string;
}): Promise<AIModelsListResponse> => {
    const params = new URLSearchParams();
    if (filters) {
        if (filters.tier) params.append('tier', filters.tier);
        if (filters.provider) params.append('provider', filters.provider);
        if (filters.is_free !== undefined) params.append('is_free', String(filters.is_free));
        if (filters.use_case) params.append('use_case', filters.use_case);
    }

    // Convert params to string manually to handle boolean conversion if needed,
    // though axios handles params object well, building query string explicitly for clarity
    const queryString = params.toString();
    const url = queryString ? `${GET_AI_MODELS_V2}?${queryString}` : GET_AI_MODELS_V2;

    const response = await authenticatedAxiosInstance.get<AIModelsListResponse>(url);
    return response.data;
};

export const fetchAIModelsForUseCase = async (useCase: string): Promise<AIModelUseCaseResponse> => {
    const response = await authenticatedAxiosInstance.get<AIModelUseCaseResponse>(
        `${GET_AI_MODELS_USE_CASE}/${useCase}`
    );
    return response.data;
};
