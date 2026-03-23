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

export const BASE_URL = getBaseUrl();
