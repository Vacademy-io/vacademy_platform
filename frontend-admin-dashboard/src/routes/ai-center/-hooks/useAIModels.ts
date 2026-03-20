import { useAIModelsList } from '@/hooks/useAiModels';
import { ModelInfo } from '../-types/ai-models';

/**
 * Custom hook to fetch and manage available AI models
 * Adapts the new v2 API response to the local component needs
 */
export const useAIModels = () => {
    const { data, isLoading, isError, error, refetch } = useAIModelsList();

    // Transform available models to include display info
    const availableModels: ModelInfo[] =
        data?.models?.map((model) => ({
            id: model.model_id,
            name: model.name,
            description: model.description || `${model.provider} Model`,
            isDefault: model.is_default,
        })) || [];

    // Get default model info
    const defaultModelData = data?.models?.find((m) => m.is_default);

    const defaultModel = defaultModelData
        ? {
              id: defaultModelData.model_id,
              name: defaultModelData.name,
              description: defaultModelData.description || 'Default Model',
              isDefault: true,
          }
        : null;

    return {
        availableModels,
        defaultModel,
        defaultModelId: defaultModel?.id || null,
        fallbackModels: [], // New API doesn't explicitly return fallback list in list endpoint, can be omitted or adapted
        isLoading,
        isError,
        error,
        refetch,
    };
};

export default useAIModels;
