// AI Model Types for model selection feature
import type { TFunction } from 'i18next';

/** The namespace this file's own strings live under — used so callers whose
 *  bound `t` defaults to a different namespace (e.g. student-attempt-dropdown.tsx,
 *  default ns `assessmentStudentAttemptDropdown`) still resolve these keys
 *  correctly. Callers must include this namespace in their own
 *  `useTranslation([...])` array so it's loaded before this runs. */
const NAMESPACE = 'aiCenterAiModels';

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    isDefault?: boolean;
}

/**
 * Build display name mappings for AI models.
 * Model names/providers are proper nouns and stay consistent across locales;
 * `t` is threaded through so this stays translation-ready and consistent
 * with the rest of the ai-center i18n rollout.
 */
export const buildModelDisplayNames = (
    t: TFunction
): Record<string, { name: string; description: string }> => ({
    'anthropic/claude-opus-4.5': {
        name: t('models.claudeOpus45.name', { ns: NAMESPACE }),
        description: t('models.claudeOpus45.description', { ns: NAMESPACE }),
    },
    'google/gemini-3-pro-preview': {
        name: t('models.gemini3ProPreview.name', { ns: NAMESPACE }),
        description: t('models.gemini3ProPreview.description', { ns: NAMESPACE }),
    },
    'google/gemini-3.1-pro-preview': {
        name: t('models.gemini31ProPreview.name', { ns: NAMESPACE }),
        description: t('models.gemini31ProPreview.description', { ns: NAMESPACE }),
    },
    'openai/gpt-5.4': {
        name: t('models.gpt54.name', { ns: NAMESPACE }),
        description: t('models.gpt54.description', { ns: NAMESPACE }),
    },
});

/**
 * Get display info for a model ID
 */
export const getModelDisplayInfo = (modelId: string, t: TFunction): ModelInfo => {
    const displayInfo = buildModelDisplayNames(t)[modelId];
    if (displayInfo) {
        return {
            id: modelId,
            name: displayInfo.name,
            description: displayInfo.description,
        };
    }
    // Fallback for unknown models - extract name from ID
    const parts = modelId.split('/');
    const name = parts.length > 1 ? parts[1] : modelId;
    const formattedName = name
        ? name.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        : modelId;
    return {
        id: modelId,
        name: formattedName,
        description: t('fallbackDescription', { ns: NAMESPACE }),
    };
};
