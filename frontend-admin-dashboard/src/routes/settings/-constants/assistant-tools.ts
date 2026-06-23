// Vacademy Assistant — Settings catalog.
//
// Keep `key` values in sync with the backend registry
// (ai_service app/services/assistant_tool_registry.py :: ASSISTANT_TOOLS).
// Phase-2/3 tools are added here as they ship.

export const ASSISTANT_TOOLS_SETTING_KEY = 'ASSISTANT_TOOLS_SETTING';

export interface AssistantToolCatalogEntry {
    key: string;
    label: string;
    description: string;
    /** Roadmap phase: 1 = help/how-to, 2 = read data, 3 = write data. */
    phase: number;
    /** On out-of-the-box (until an institute configures the setting). */
    defaultEnabled: boolean;
}

export const ASSISTANT_TOOL_CATALOG: AssistantToolCatalogEntry[] = [
    {
        key: 'search_help_knowledge',
        label: 'Help & how-to guidance',
        description:
            'Answers “how do I / where do I” questions about using the portal, with step-by-step instructions.',
        phase: 1,
        defaultEnabled: true,
    },
];

// Non-learner system roles, by their JWT role-name. Custom roles are appended at
// runtime from getAllRoles(). Keys here must match the role names the backend
// reads from the JWT authorities map.
export const NON_LEARNER_SYSTEM_ROLES = [
    'ADMIN',
    'TEACHER',
    'EVALUATOR',
    'CONTENT CREATOR',
    'ASSESSMENT CREATOR',
];

export interface AssistantToolsSettingData {
    /** Tools enabled for everyone in the institute. */
    enabled_tools: string[];
    /** Per-role grants ADDED on top of `enabled_tools` (keyed by JWT role name). */
    role_overrides: Record<string, { enabled_tools: string[] }>;
}

export function defaultAssistantToolsSetting(): AssistantToolsSettingData {
    return {
        enabled_tools: ASSISTANT_TOOL_CATALOG.filter((t) => t.defaultEnabled).map((t) => t.key),
        role_overrides: {},
    };
}
