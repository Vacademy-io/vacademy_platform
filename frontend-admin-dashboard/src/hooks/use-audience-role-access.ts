/**
 * useAudienceRoleAccess — read/write the institute's per-role audience access
 * config.
 *
 * Storage: nested under the existing institute setting key
 * {@code ROLE_DISPLAY_SETTINGS}, as a top-level {@code audienceRoleAccess}
 * sibling to the per-role-UUID display-config entries. We keep role-NAME
 * keying inside that field so the backend resolver can match against JWT
 * authorities directly (no UUID ↔ name translation needed).
 *
 * <p>The save handler does a read-modify-write of the full
 * {@code ROLE_DISPLAY_SETTINGS} blob so existing per-role-UUID display data
 * (sidebar, permissions, etc.) is preserved when audience access is updated.
 *
 * Resolution semantics (mirrors the backend):
 * - Each role can be set to `DEFAULT` | `COUNSELOR` | `AUDIENCE_LIST`.
 * - Roles not present in the config default to `DEFAULT`.
 * - Root users always behave as `DEFAULT` regardless of this config.
 *
 * Backend reads: {@code AudienceRoleAccessService}.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export type AudienceAccessMode = 'DEFAULT' | 'COUNSELOR' | 'AUDIENCE_LIST';

export interface RoleAccessConfig {
    mode: AudienceAccessMode;
    /** Only meaningful when mode = AUDIENCE_LIST. */
    audience_ids?: string[];
}

export interface AudienceRoleAccessConfig {
    /** Map of role name (uppercase) → access rule. */
    roles: Record<string, RoleAccessConfig>;
}

// Persisted inside the existing ROLE_DISPLAY_SETTINGS blob at this top-level
// field, sibling to the per-role-UUID display-config entries. The shape of
// that blob is otherwise opaque to us — we treat it as a Record<string, any>
// and only ever touch our own field.
const ROLE_DISPLAY_SETTING_KEY = 'ROLE_DISPLAY_SETTINGS';
const AUDIENCE_FIELD = 'audienceRoleAccess';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const QUERY_KEY = ['audience-role-access-setting'];

// Legacy setting key (the original storage location). We still read from it as
// a fallback when ROLE_DISPLAY_SETTINGS doesn't yet have the audience field —
// so configs saved before this consolidation are not lost on first open.
const LEGACY_SETTING_KEY = 'AUDIENCE_ROLE_ACCESS';

const DEFAULTS: AudienceRoleAccessConfig = { roles: {} };

type RoleDisplaySettingsBlob = Record<string, unknown> & {
    audienceRoleAccess?: AudienceRoleAccessConfig;
};

// The `/get` endpoint returns a SettingDto ({ key, name, data }) as the
// response body, so the stored blob lives at `response.data.data`. Older /
// proxied response shapes nested it differently, so probe the same three
// shapes the canonical display-settings reader handles
// (services/display-settings.ts getDisplaySettings). The previous code read
// only `response.data.data[settingKey].data` — a shape the backend never
// returns — so it ALWAYS resolved to undefined: the saved audience-access
// config was never read back (UI reverted to DEFAULT) and the save's
// read-modify-write clobbered sibling per-role display config.
function extractSettingData(responseBody: unknown, settingKey: string): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = responseBody as any;
    if (!body) return undefined;
    if (body[settingKey]?.data) return body[settingKey].data;
    if (body.data?.[settingKey]?.data) return body.data[settingKey].data;
    if (body.data) return body.data;
    return undefined;
}

async function getRoleDisplaySettingsBlob(
    instituteId: string
): Promise<RoleDisplaySettingsBlob> {
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: ROLE_DISPLAY_SETTING_KEY },
        });
        const data = extractSettingData(response.data, ROLE_DISPLAY_SETTING_KEY);
        return (data ?? {}) as RoleDisplaySettingsBlob;
    } catch {
        return {};
    }
}

async function fetchLegacyAudienceRoleAccess(
    instituteId: string
): Promise<AudienceRoleAccessConfig | null> {
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: LEGACY_SETTING_KEY },
        });
        const data = extractSettingData(response.data, LEGACY_SETTING_KEY) as
            | Partial<AudienceRoleAccessConfig>
            | undefined;
        if (!data || !data.roles) return null;
        return { roles: data.roles };
    } catch {
        return null;
    }
}

export async function fetchAudienceRoleAccess(): Promise<AudienceRoleAccessConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return DEFAULTS;
    const blob = await getRoleDisplaySettingsBlob(instituteId);
    if (blob.audienceRoleAccess && blob.audienceRoleAccess.roles) {
        return { roles: blob.audienceRoleAccess.roles };
    }
    // Backward-compat: surface configs that were saved to the legacy key
    // before this consolidation. Once the user re-saves from the UI, the
    // setting moves into ROLE_DISPLAY_SETTINGS.audienceRoleAccess.
    const legacy = await fetchLegacyAudienceRoleAccess(instituteId);
    if (legacy) return legacy;
    return DEFAULTS;
}

export async function saveAudienceRoleAccess(
    config: AudienceRoleAccessConfig
): Promise<void> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) throw new Error('No institute id');
    // Read-modify-write: pull the full ROLE_DISPLAY_SETTINGS blob, replace
    // only our field, and write it back. Preserves any existing per-role-UUID
    // display config the user (or other settings UIs) have configured.
    const blob = await getRoleDisplaySettingsBlob(instituteId);
    const next: RoleDisplaySettingsBlob = {
        ...blob,
        [AUDIENCE_FIELD]: config,
    };
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Role Display Settings', setting_data: next },
        { params: { instituteId, settingKey: ROLE_DISPLAY_SETTING_KEY } }
    );
}

export function useAudienceRoleAccess() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchAudienceRoleAccess,
        // staleTime 0: every consumer mount triggers a fresh GET. Avoids
        // showing a stale cached blob after a recent save when the user
        // navigates between role tabs.
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        // Always refetch when the AudienceAccessCard mounts so switching
        // between Admin / Teacher / Custom tabs reflects the latest server
        // state — important if another admin is editing concurrently.
        refetchOnMount: 'always',
    });

    const { mutateAsync: save, isPending: saving } = useMutation({
        mutationFn: saveAudienceRoleAccess,
        onSuccess: async () => {
            // Force-await a refetch (not just invalidate) so the caller sees
            // the new config in the next render, rather than a brief flash of
            // stale data while the background refetch is still in flight.
            await queryClient.refetchQueries({ queryKey: QUERY_KEY });
        },
    });

    return {
        config: data ?? DEFAULTS,
        isLoading,
        saving,
        save,
    };
}
