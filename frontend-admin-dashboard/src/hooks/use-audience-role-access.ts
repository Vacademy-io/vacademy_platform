/**
 * useAudienceRoleAccess — read/write the institute's per-role audience access
 * config.
 *
 * Stored under the institute setting key {@code AUDIENCE_ROLE_ACCESS}. Mirrors
 * the {@code useLeadSettings} pattern.
 *
 * Resolution semantics (mirrors the backend):
 * - Each role can be set to `DEFAULT` | `COUNSELOR` | `AUDIENCE_LIST`.
 * - Roles not present in the config default to `DEFAULT`.
 * - Admin / root users always behave as `DEFAULT` regardless of this config.
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

const SETTING_KEY = 'AUDIENCE_ROLE_ACCESS';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const QUERY_KEY = ['audience-role-access-setting'];

const DEFAULTS: AudienceRoleAccessConfig = { roles: {} };

export async function fetchAudienceRoleAccess(): Promise<AudienceRoleAccessConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return DEFAULTS;
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_INSITITUTE_SETTINGS,
            params: { instituteId, settingKey: SETTING_KEY },
        });
        const data: Partial<AudienceRoleAccessConfig> | undefined =
            response.data?.data?.[SETTING_KEY]?.data;
        if (!data) return DEFAULTS;
        return { roles: data.roles ?? {} };
    } catch {
        return DEFAULTS;
    }
}

export async function saveAudienceRoleAccess(
    config: AudienceRoleAccessConfig
): Promise<void> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) throw new Error('No institute id');
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Audience Role Access', setting_data: config },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
}

export function useAudienceRoleAccess() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchAudienceRoleAccess,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    const { mutateAsync: save, isPending: saving } = useMutation({
        mutationFn: saveAudienceRoleAccess,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });

    return {
        config: data ?? DEFAULTS,
        isLoading,
        saving,
        save,
    };
}
