// AI Model Types for model selection feature
import type { TFunction } from 'i18next';

/** The namespace this file's own strings live under — used so callers whose
 *  bound `t` defaults to a different namespace (e.g. student-attempt-dropdown.tsx,
 *  default ns `assessmentStudentAttemptDropdown`) still resolve these keys
 *  correctly. Callers must include this namespace in their own
 *  `useTranslation([...])` array so it's loaded before this runs. */
const NAMESPACE = 'aiCenterAiModels';

/**
 * The model AI copy evaluation uses unless a teacher deliberately picks another.
 *
 * There is exactly one right place for this value. It used to be defaulted in
 * three drifted places at once — this picker (`google/gemini-3.1-pro-preview`,
 * $2/$12 per M), the trigger service (`mistralai/devstral-2512:free`, a coding
 * model) and the Python grader — and because the picker always sends
 * `preferred_model`, its ultra-tier default silently overrode the pipeline's
 * own. One 10-question copy was billed 133.62 credits (₹124.27) against a
 * 10-credit floor, ~90% of it invisible reasoning tokens.
 *
 * `z-ai/glm-5.3-flash` is $0.075/$0.25 per M, reads handwriting (the copy-check
 * pipeline re-reads every page with it), and is the same default the grader
 * uses server-side, so picking nothing and picking this agree.
 */
export const DEFAULT_EVALUATION_MODEL = 'z-ai/glm-5.3-flash';

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
    [DEFAULT_EVALUATION_MODEL]: {
        name: t('models.glm53Flash.name', { ns: NAMESPACE }),
        description: t('models.glm53Flash.description', { ns: NAMESPACE }),
    },
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
