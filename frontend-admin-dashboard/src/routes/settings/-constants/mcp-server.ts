/**
 * MCP server settings — shared types and defaults.
 *
 * The tool CATALOGUE deliberately lives on the backend (ai_service exposes it at
 * /mcp/oauth/connection-info), because the list is derived from the Assistant
 * tool registry. Keeping a second copy here would let the two drift and show
 * admins toggles for tools the server does not actually expose.
 *
 * Stored under the institute-settings key MCP_SERVER_SETTING. The shape matches
 * what ai_service app/mcp/access.py normalizes and what the Assistant tool gate
 * consumes, so the same per-tool gating code serves both surfaces.
 */
import { NON_LEARNER_SYSTEM_ROLES } from './assistant-tools';

export const MCP_SERVER_SETTING_KEY = 'MCP_SERVER_SETTING';

/** Human name stored alongside the payload by the generic settings endpoint. */
export const MCP_SERVER_SETTING_NAME = 'MCP Server';

/** Roles that must never be offered: the MCP surface is staff-only. */
export const MCP_LEARNER_ROLE_NAMES = new Set(['STUDENT', 'LEARNER', 'PARENT']);

/** Roles offered by default. Mirrors the backend's DEFAULT_ALLOWED_ROLES. */
export const MCP_DEFAULT_ALLOWED_ROLES = ['ADMIN'];

/** Non-learner system roles, reused from the Assistant settings catalogue. */
export const MCP_SYSTEM_ROLES = NON_LEARNER_SYSTEM_ROLES;

/** One tool as the backend describes it. */
export interface McpToolCatalogEntry {
    /** Registry tool name, e.g. "get_institute_overview". */
    name: string;
    /** Settings group key that the toggles write, e.g. "institute_overview". */
    key: string;
    label: string;
    description: string;
    mode: 'READ' | 'WRITE';
}

export interface McpManualClient {
    client_id: string;
    client_name?: string | null;
    redirect_uris: string[];
    created_at?: string | null;
}

export interface McpConnection {
    pair_id: string;
    client_id: string;
    client_name?: string | null;
    user_id: string;
    username?: string | null;
    created_at?: string | null;
    last_used_at?: string | null;
}

export interface McpConnectionInfo {
    server_url: string;
    issuer: string;
    scope: string;
    tools: McpToolCatalogEntry[];
    manual_clients: McpManualClient[];
    connections: McpConnection[];
}

export interface McpServerSettingData {
    /** Master switch. Off until an admin turns it on. */
    enabled: boolean;
    /** Roles allowed to connect an AI client. Learner roles are stripped server-side. */
    allowed_roles: string[];
    /** Tool group keys enabled for everyone who may connect. */
    enabled_tools: string[];
    /** Extra tool groups granted to specific roles, on top of enabled_tools. */
    role_overrides: Record<string, { enabled_tools: string[] }>;
}

export function defaultMcpServerSetting(): McpServerSettingData {
    return {
        enabled: false,
        allowed_roles: [...MCP_DEFAULT_ALLOWED_ROLES],
        enabled_tools: [],
        role_overrides: {},
    };
}

/** Coerce whatever is stored (or nothing at all) into a complete setting. */
export function mergeMcpSettingWithDefaults(
    raw: Partial<McpServerSettingData> | null | undefined
): McpServerSettingData {
    const base = defaultMcpServerSetting();
    if (!raw) return base;
    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
        allowed_roles: Array.isArray(raw.allowed_roles)
            ? raw.allowed_roles.filter((r) => !MCP_LEARNER_ROLE_NAMES.has(String(r).toUpperCase()))
            : base.allowed_roles,
        enabled_tools: Array.isArray(raw.enabled_tools) ? raw.enabled_tools : base.enabled_tools,
        role_overrides:
            raw.role_overrides && typeof raw.role_overrides === 'object' ? raw.role_overrides : {},
    };
}
