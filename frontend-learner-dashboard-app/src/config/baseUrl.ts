/**
 * Determines the backend base URL based on the current domain.
 * Add new domain-to-backend mappings here for different deployments.
 */
function getBaseUrl(): string {
    // Runtime override injected by the standalone container entrypoint via
    // /config/env-config.js (window.__BACKEND_URL__). Lets ONE generic build
    // serve any client domain same-origin. No-op for Cloudflare prod builds where
    // the script isn't present.
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const runtimeUrl = (window as any).__BACKEND_URL__ as string | undefined;
        if (runtimeUrl) return runtimeUrl;
    }

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
