// AI Model Types for model selection feature

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    isDefault?: boolean;
}

// Display name mappings for AI models
export const MODEL_DISPLAY_NAMES: Record<string, { name: string; description: string }> = {
    'anthropic/claude-opus-4.5': {
        name: 'Claude Opus 4.5',
        description: 'Anthropic',
    },
    'google/gemini-3-pro-preview': {
        name: 'Gemini 3 Pro Preview',
        description: 'Google',
    },
    'google/gemini-3.1-pro-preview': {
        name: 'Gemini 3.1 Pro Preview',
        description: 'Google',
    },
    'openai/gpt-5.4': {
        name: 'GPT-5.4',
        description: 'OpenAI',
    },
};

/**
 * Get display info for a model ID
 */
export const getModelDisplayInfo = (modelId: string): ModelInfo => {
    const displayInfo = MODEL_DISPLAY_NAMES[modelId];
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
        description: 'AI Model',
    };
};
