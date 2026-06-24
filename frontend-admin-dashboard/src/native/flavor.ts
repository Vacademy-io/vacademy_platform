import { getFlavorByKey, type AdminFlavor } from '../../flavor.config';

// Runtime view of the build-time flavor. `VITE_CAP_FLAVOR` is baked into the
// bundle at build time (set by the cap:*:<flavor> npm scripts), so this resolves
// synchronously on first paint — no async App.getInfo() before the router mounts.
//
// On the plain web build VITE_CAP_FLAVOR is unset, so this falls back to the
// default flavor (vimotion). That is harmless on web: forceVimShell + OTA are
// both guarded by isNative(), and the default flavor carries no fixed
// instituteId, so web keeps its existing host-based domain routing.
const flavor: AdminFlavor = getFlavorByKey(
    (import.meta.env as Record<string, string | undefined>).VITE_CAP_FLAVOR
);

export function getFlavor(): AdminFlavor {
    return flavor;
}

/** Force the `/vim` shell on native cold start (Vimotion only). */
export function shouldForceVimShell(): boolean {
    return flavor.forceVimShell;
}

/** Fixed anchor institute id for branding/theme, or undefined for host-based. */
export function getFlavorInstituteId(): string | undefined {
    return flavor.instituteId;
}
