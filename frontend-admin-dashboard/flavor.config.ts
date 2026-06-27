/**
 * Capacitor flavor definitions for the admin dashboard.
 *
 * The same web bundle ships as more than one native app. A flavor selects the
 * native identity (appId / appName), the OTA channel, and a handful of runtime
 * behaviours (which shell to land on, which institute to anchor branding to).
 *
 * This module is imported from TWO different runtimes, so it must stay free of
 * any browser- or Capacitor-specific imports:
 *   - `capacitor.config.ts` (Node / ts-node at `cap sync` time) reads it to
 *     stamp the native project (appId, appName, OTA plugin config).
 *   - `src/native/flavor.ts` (the browser bundle) reads it at runtime to gate
 *     behaviour, keyed off the build-time `VITE_CAP_FLAVOR` value.
 *
 * Selection is done at BUILD time via the `VITE_CAP_FLAVOR` env var so the
 * value is available synchronously on first paint (no async `App.getInfo()`
 * round-trip before the router mounts). Each native binary is built + synced
 * with its own `VITE_CAP_FLAVOR`, so the baked value always matches the
 * installed `appId`.
 */

export type AdminFlavorKey = 'vacademy-admin' | 'vimotion';

export type OtaMode =
    | 'self-hosted' // Our own admin-core OTA backend (learner-app style, autoUpdate off)
    | 'capgo' // Capgo cloud OTA (autoUpdate on)
    | 'none'; // Web / no OTA

export interface AdminFlavor {
    key: AdminFlavorKey;
    /** Native bundle identifier (must match Android applicationId / iOS PRODUCT_BUNDLE_IDENTIFIER). */
    appId: string;
    /** Native display name (home-screen label). */
    appName: string;
    /**
     * When true the native cold-start is forced into the `/vim` shell. Vimotion
     * is product-scoped to the video studio; Vacademy Admin is the full portal.
     */
    forceVimShell: boolean;
    /**
     * Fixed branding/theme source. A native WebView has no meaningful hostname,
     * so instead of host-based domain routing the app resolves branding via this
     * fixed (domain, subdomain) against the EXISTING public domain-routing
     * endpoint — i.e. the `institute_domain_routing` row that maps to this app's
     * institute (theme, title, logo, auth toggles, role). This is BRANDING ONLY:
     * login still resolves the signed-in user's own institute, so any institute's
     * admin can sign in while the app keeps this flavor's look.
     */
    brandingDomain?: string;
    brandingSubdomain?: string;
    /** Anchor institute id (reference; OTA/branding row maps to it). */
    instituteId?: string;
    /** OTA delivery mechanism for this flavor. */
    ota: OtaMode;
}

export const ADMIN_FLAVORS: Record<AdminFlavorKey, AdminFlavor> = {
    'vacademy-admin': {
        key: 'vacademy-admin',
        appId: 'io.vacademy.admin.app',
        appName: 'Vacademy Admin',
        forceVimShell: false,
        // institute_domain_routing row "VACADEMY-ADMIN-APP" → institute ca3c…,
        // role ADMIN, tab_text "Vacademy Platform". Drives the app's theme/title.
        brandingDomain: 'vacademy.io',
        brandingSubdomain: 'admin-app',
        instituteId: 'ca3c4734-7913-48a8-b116-f8f7e0c60eba',
        ota: 'self-hosted',
    },
    vimotion: {
        key: 'vimotion',
        appId: 'io.vimotion.app',
        appName: 'Vimotion',
        forceVimShell: true,
        ota: 'capgo',
    },
};

/**
 * Default flavor when `VITE_CAP_FLAVOR` is unset. Kept as `vimotion` so that
 * any existing `cap sync` / build pipeline that does not set the env var keeps
 * producing exactly the app it produced before this multi-flavor change.
 */
export const DEFAULT_FLAVOR_KEY: AdminFlavorKey = 'vimotion';

export function isAdminFlavorKey(value: string | undefined | null): value is AdminFlavorKey {
    return value === 'vacademy-admin' || value === 'vimotion';
}

/** Resolve a flavor by key, falling back to the default. */
export function getFlavorByKey(key: string | undefined | null): AdminFlavor {
    return ADMIN_FLAVORS[isAdminFlavorKey(key) ? key : DEFAULT_FLAVOR_KEY];
}
