/**
 * useCallNumberVisibility — read/write the institute's per-role rule for whether
 * the Call Log shows verbatim phone numbers or the masked form (`*******1234`).
 *
 * Storage mirrors {@link useAudienceRoleAccess} exactly: a top-level
 * `callNumberVisibility` field inside the institute setting key
 * `ROLE_DISPLAY_SETTINGS`, sibling to the per-role-UUID display config, keyed by
 * uppercase role NAME so the backend resolver matches JWT authorities without a
 * UUID ↔ name translation.
 *
 * Save is a read-modify-write of the whole `ROLE_DISPLAY_SETTINGS` blob so the
 * sibling per-role display config (and `audienceRoleAccess`) survive.
 *
 * Resolution semantics (mirrors the backend `CallNumberVisibilityService`):
 * - A role set to `FULL` sees verbatim numbers; `MASKED` sees the masked form.
 * - Most permissive wins across the roles a user holds.
 * - Roles with no rule are MASKED — including ADMIN. Unmasking is strictly
 *   opt-in, so an institute that never opens this card keeps exactly the
 *   behaviour it has today.
 *
 * Backend reads: `CallNumberVisibilityService`.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    readRoleDisplaySettingsBlob,
    updateRoleDisplaySettingsBlob,
} from '@/services/role-display-settings-blob';

/** `FULL` = verbatim numbers, `MASKED` = `*******1234`. */
export type CallNumberVisibilityMode = 'FULL' | 'MASKED';

export interface RoleNumberVisibility {
    mode: CallNumberVisibilityMode;
}

export interface CallNumberVisibilityConfig {
    /** Map of role name (uppercase) → visibility rule. */
    roles: Record<string, RoleNumberVisibility>;
}

const CALL_NUMBER_FIELD = 'callNumberVisibility';
const QUERY_KEY = ['call-number-visibility-setting'];

const DEFAULTS: CallNumberVisibilityConfig = { roles: {} };

/**
 * What an unconfigured role resolves to — kept in lockstep with the backend so
 * the settings card shows the effective value before anything is saved. Masked
 * for every role: unmasking only ever happens because someone chose it here.
 */
export const UNCONFIGURED_MODE: CallNumberVisibilityMode = 'MASKED';

export async function fetchCallNumberVisibility(): Promise<CallNumberVisibilityConfig> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return DEFAULTS;
    const blob = (await readRoleDisplaySettingsBlob(instituteId)) as {
        callNumberVisibility?: CallNumberVisibilityConfig;
    };
    if (blob.callNumberVisibility?.roles) return { roles: blob.callNumberVisibility.roles };
    return DEFAULTS;
}

export async function saveCallNumberVisibility(config: CallNumberVisibilityConfig): Promise<void> {
    // Serialized read-modify-write: the AudienceAccessCard auto-saves its own
    // section of this same blob, and both cards sit on the same settings page.
    await updateRoleDisplaySettingsBlob((current) => ({
        ...current,
        [CALL_NUMBER_FIELD]: config,
    }));
}

export function useCallNumberVisibility() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchCallNumberVisibility,
        // staleTime 0 + refetchOnMount: switching between the Admin / Teacher /
        // Custom role tabs must show that role's saved value, not a cached one
        // from the tab before it.
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnMount: 'always',
    });

    const { mutateAsync: save, isPending: saving } = useMutation({
        mutationFn: saveCallNumberVisibility,
        onSuccess: async () => {
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
