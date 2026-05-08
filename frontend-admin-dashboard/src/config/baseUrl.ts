/**
 * Determines the backend base URL based on the current domain.
 * Add new domain-to-backend mappings here for different deployments.
 */
function getBaseUrl(): string {
    // Allow explicit override via environment variable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envUrl = (import.meta.env as any).VITE_BACKEND_URL as string | undefined;
    if (envUrl && envUrl !== 'https://backend-stage.vacademy.io') {
        return envUrl;
    }

    const hostname = window.location.hostname;

    // Domain-specific backend mappings
    const domainMap: Record<string, string> = {
        'letstalkvet.com': 'https://api.letstalkvet.com',
        'www.letstalkvet.com': 'https://api.letstalkvet.com',
    };

    // Check for exact match or subdomain match
    for (const [domain, backendUrl] of Object.entries(domainMap)) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
            return backendUrl;
        }
    }

    // Default fallback
    return envUrl || 'https://backend-stage.vacademy.io';
}

export const BACKEND_BASE_URL = getBaseUrl();

/**
 * Optional per-feature override pointing at a locally-running admin_core_service.
 * Only used by the bulk live-session endpoint right now — every other API call
 * still hits {@link BACKEND_BASE_URL} (staging in dev). This lets you iterate on
 * the bulk Spring Boot service locally without losing access to production-like
 * data for the rest of the app.
 *
 * Active only when:
 *   - The frontend is running on localhost / 127.0.0.1, AND
 *   - VITE_LOCAL_BULK_BACKEND is `true` (default true) — set to `false` to
 *     disable and fall back to the global BACKEND_BASE_URL.
 *
 * Port is configurable via `VITE_LOCAL_BACKEND_PORT` (default `8072`).
 */
export const LOCAL_BULK_BACKEND_URL: string | null = (() => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flag = (import.meta.env as any).VITE_LOCAL_BULK_BACKEND as string | undefined;
    if (flag === 'false') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const port =
        ((import.meta.env as any).VITE_LOCAL_BACKEND_PORT as string | undefined) || '8072';
    return `http://localhost:${port}`;
})();
