/**
 * Serialized read-modify-write access to the institute setting key
 * `ROLE_DISPLAY_SETTINGS`.
 *
 * That one blob holds several independent sections written by separate,
 * auto-saving settings cards — `audienceRoleAccess` (AudienceAccessCard) and
 * `callNumberVisibility` (CallNumberVisibilityCard) today, plus the per-role-UUID
 * display config that `services/display-settings.ts` writes. Each writer has to
 * GET the whole blob, replace its own field and POST it back, because the endpoint
 * takes the entire object.
 *
 * With two auto-saving cards on the same settings page that is a lost-update race:
 * toggle both inside the debounce window and both flushes GET the old blob, then
 * the second POST overwrites the first card's section. Routing every writer through
 * `updateRoleDisplaySettingsBlob` chains the read-modify-write cycles, so each one
 * reads what the previous one wrote.
 *
 * This serializes writers in THIS tab only — it is not a substitute for
 * server-side optimistic concurrency, which the setting endpoint doesn't offer.
 */

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export const ROLE_DISPLAY_SETTING_KEY = 'ROLE_DISPLAY_SETTINGS';

const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

export type RoleDisplaySettingsBlob = Record<string, unknown>;

/**
 * The `/get` endpoint returns a SettingDto ({ key, name, data }) as the body, but
 * proxied/older responses nested it differently — probe the same three shapes the
 * canonical display-settings reader handles.
 */
function extractSettingData(responseBody: unknown, settingKey: string): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = responseBody as any;
    if (!body) return undefined;
    if (body[settingKey]?.data) return body[settingKey].data;
    if (body.data?.[settingKey]?.data) return body.data[settingKey].data;
    if (body.data) return body.data;
    return undefined;
}

/** Current blob, or {} when the setting has never been saved / is unreachable. */
export async function readRoleDisplaySettingsBlob(
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
        // Never configured, or the read failed. Returning {} is only safe because
        // every caller MERGES onto this — see the warning in update() below.
        return {};
    }
}

/**
 * Tail of the write chain. Each update awaits the previous one, so concurrent
 * callers read the blob only after their predecessor's POST has landed.
 */
let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Read the blob, apply `mutate`, write it back — serialized against every other
 * caller of this function.
 *
 * NOTE `mutate` must return a blob that PRESERVES the fields it doesn't own
 * (spread the input), because a failed read yields `{}` and this POST replaces the
 * stored object wholesale.
 */
export async function updateRoleDisplaySettingsBlob(
    mutate: (current: RoleDisplaySettingsBlob) => RoleDisplaySettingsBlob
): Promise<void> {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) throw new Error('No institute id');

    const run = async () => {
        const current = await readRoleDisplaySettingsBlob(instituteId);
        await authenticatedAxiosInstance.post(
            SAVE_URL,
            { setting_name: 'Role Display Settings', setting_data: mutate(current) },
            { params: { instituteId, settingKey: ROLE_DISPLAY_SETTING_KEY } }
        );
    };

    // Chain on the previous write regardless of whether it succeeded — a failed
    // write must not wedge the queue for everyone behind it.
    const next = writeChain.catch(() => undefined).then(run);
    writeChain = next.catch(() => undefined);
    return next;
}
