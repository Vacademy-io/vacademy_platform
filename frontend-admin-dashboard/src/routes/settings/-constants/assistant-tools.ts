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
    /** On out-of-the-box for every role (until an institute configures the setting). */
    defaultEnabled: boolean;
    /** On out-of-the-box for THESE roles only (mirrors the backend registry's default_roles). */
    defaultRoles?: string[];
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
    {
        key: 'learner_data',
        label: 'Learner data lookup',
        description:
            'Find learners by name/email/phone and answer questions about their attendance, ' +
            'assessment scores, activity, course progress and login summary — and generate their ' +
            'full analysis report. On by default for Admins; grant to other roles below.',
        phase: 2,
        defaultEnabled: false,
        defaultRoles: ['ADMIN'],
    },
    {
        key: 'payments',
        label: 'Payments & fees',
        description:
            'Answer questions about a learner’s payment history, outstanding/overdue fees, and ' +
            'payment plans. On by default for Admins.',
        phase: 2,
        defaultEnabled: false,
        defaultRoles: ['ADMIN'],
    },
    {
        key: 'batch_data',
        label: 'Batch rosters',
        description:
            'List the learners in a batch and answer batch headcount questions. On by default for Admins.',
        phase: 2,
        defaultEnabled: false,
        defaultRoles: ['ADMIN'],
    },
    {
        key: 'schedule',
        label: 'Class schedule',
        description:
            'Answer “what classes are live/upcoming” and “what do I have today” from the live-session ' +
            'schedule. On by default for Admins.',
        phase: 2,
        defaultEnabled: false,
        defaultRoles: ['ADMIN'],
    },
    {
        key: 'institute_overview',
        label: 'Institute overview',
        description:
            'Institute-wide snapshots: total overdue fees, live classes right now, active learner ' +
            'counts. On by default for Admins.',
        phase: 2,
        defaultEnabled: false,
        defaultRoles: ['ADMIN'],
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
    // Role-scoped defaults land in role_overrides so SAVING the settings page
    // preserves them (the backend's default_roles fallback only applies while
    // no setting has ever been saved).
    const role_overrides: Record<string, { enabled_tools: string[] }> = {};
    for (const tool of ASSISTANT_TOOL_CATALOG) {
        for (const role of tool.defaultRoles ?? []) {
            const entry = role_overrides[role] ?? { enabled_tools: [] };
            role_overrides[role] = entry;
            if (!entry.enabled_tools.includes(tool.key)) {
                entry.enabled_tools.push(tool.key);
            }
        }
    }
    return {
        enabled_tools: ASSISTANT_TOOL_CATALOG.filter((t) => t.defaultEnabled).map((t) => t.key),
        role_overrides,
    };
}
