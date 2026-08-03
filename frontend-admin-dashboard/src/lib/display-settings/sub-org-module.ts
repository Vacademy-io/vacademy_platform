import type { DisplaySettingsData, SubOrgModulePermissions } from '@/types/display-settings';
import { getDisplaySettingsFromCache } from '@/services/display-settings';
import {
    getActiveRoleDisplaySettingsKey,
    getRolesForCurrentInstitute,
} from '@/lib/auth/instituteUtils';
import { isCallerSubOrgAdmin } from '@/lib/auth/facultyAccessUtils';

/**
 * Access rules for the Sub-Organizations (Channel Partners) module —
 * /manage-custom-teams and the per-sub-org drilldown.
 *
 * Two layers, and only the first lives here:
 *
 *  1. **Reachability (this file).** A per-role Display Settings toggle
 *     (`subOrganizations.moduleEnabled`) decides whether the module shows in the
 *     sidebar and whether the routes render. Institute ADMINs always pass — the
 *     module is theirs by default and the sidebar sub-item toggle already gates
 *     their nav entry.
 *
 *  2. **Row visibility (server-side).** WHICH channel partners a user sees is
 *     never decided in the browser. The backend scopes every sub-org response to
 *     the caller's ACTIVE SUB_ORG-linked FSPSSM assignments, so search, filters,
 *     pagination and totals all run over the assigned set, and a user with no
 *     assignments gets an empty list. Turning this toggle on can therefore never
 *     widen what a user can read — it only unlocks the door.
 */

/** Whether a resolved settings blob has the module enabled. */
export const isSubOrgModuleEnabled = (settings: DisplaySettingsData | null | undefined): boolean =>
    settings?.subOrganizations?.moduleEnabled === true;

/** True when the current user holds the institute ADMIN role. */
export const isInstituteAdmin = (): boolean => getRolesForCurrentInstitute().includes('ADMIN');

/**
 * Tri-state, because "we don't know yet" is a real and common state: the settings
 * cache is written asynchronously on first load, and both the role lookup and the
 * cache key depend on a decoded JWT that can be momentarily unavailable during
 * early render. Collapsing that into a boolean makes an admin flash an
 * access-denied screen before the cache lands.
 *
 *  - 'granted'  — institute ADMIN, or the role's Display Settings enable it.
 *  - 'denied'   — settings resolved and the module is off for this role.
 *  - 'unknown'  — settings not resolved yet. Callers decide which way to fail.
 */
export type SubOrgModuleAccess = 'granted' | 'denied' | 'unknown';

export const resolveSubOrgModuleAccess = (): SubOrgModuleAccess => {
    if (isInstituteAdmin()) return 'granted';
    const settings = getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey());
    if (!settings) return 'unknown';
    return isSubOrgModuleEnabled(settings) ? 'granted' : 'denied';
};

/**
 * Strict check — fails CLOSED on 'unknown'. For the sidebar: hiding an entry that
 * appears a moment later is fine; flashing an admin-only entry into a non-admin's
 * nav on every cold load is not.
 */
export const canAccessSubOrgModule = (): boolean => resolveSubOrgModuleAccess() === 'granted';

/**
 * Lenient check — fails OPEN on 'unknown'. For the route gate: only render the
 * "not enabled for your role" screen once we positively know the module is off,
 * never while settings are still resolving. Safe because this is a UX gate only;
 * the backend scopes and authorizes every sub-org response independently.
 */
export const isSubOrgModuleDenied = (): boolean => resolveSubOrgModuleAccess() === 'denied';

/**
 * True when this user's sub-org view is limited to the channel partners assigned
 * to them — mirroring what the backend enforces. Used to hide institute-wide
 * surfaces that can't be scoped by assignment (creating a channel partner, the
 * institute's Registration Links tab).
 *
 * Two ways to be scoped, and both must be checked:
 *  - No ADMIN role: reaching the module via the Display Settings grant.
 *  - ADMIN role but sub-org linkages: a sub-org admin is ALSO granted the parent
 *    institute's ADMIN role, so the role alone can't tell them apart from a true
 *    institute admin. The presence of SUB_ORG access mappings is the reliable
 *    fingerprint — the same one the backend and the ledger gate use.
 */
export const isSubOrgAssignmentScoped = (): boolean => !isInstituteAdmin() || isCallerSubOrgAdmin();

/**
 * Can the signed-in user perform this action on a channel partner?
 *
 * Only assignment-scoped users are constrained. Institute admins and sub-org admins
 * pass unconditionally — sub-org admins already have their own permission model
 * (FSPSSM access_permission / ALLOWED_TEAM_ROLES), and layering this on top would
 * revoke things that work today.
 *
 * Read capabilities default ON and write capabilities default OFF, so a role granted
 * the module but never configured further gets a read-only view. Mirrors the server's
 * SubOrgAccessScopeService.assertRolePermission — the UI hides the affordance, the
 * backend refuses the call.
 */
export const subOrgPermission = (key: keyof SubOrgModulePermissions): boolean => {
    if (!isSubOrgAssignmentScoped()) return true;
    if (isCallerSubOrgAdmin()) return true;
    const perms = getDisplaySettingsFromCache(getActiveRoleDisplaySettingsKey())
        ?.subOrganizations?.permissions;
    return perms?.[key] ?? (key === 'canViewFinance' || key === 'canExport');
};

/** Sidebar ids the module owns. */
export const SUB_ORG_MODULE_TAB_ID = 'manage-institute';
export const SUB_ORG_MODULE_SUB_ITEM_ID = 'manage-institute-suborgs';
