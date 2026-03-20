export const HOLISTIC_SUBDOMAIN = 'holistic';
export const VACADEMY_SUBDOMAIN = 'dash';

export function getSubdomain(url?: string): string | null {
    try {
        // Use provided URL or default to current hostname
        let hostname: string;

        if (url) {
            // Handle URLs with https://, http://,
            try {
                const urlObj = new URL(url);
                hostname = urlObj.hostname;
            } catch {
                //trying to extract hostname manually
                const cleanUrl = url.replace(/^https?:\/\//, '').replace(/^\/\//, '');
                hostname = cleanUrl.split('/')[0] || '';
            }
        } else {
            hostname = window.location.hostname;
        }

        // Split the hostname by dots
        const parts = hostname.split('.');

        // If we have less than 2 parts, no subdomain
        if (parts.length < 2) {
            return null;
        }

        // If we have exactly 2 parts (vacademy.com), no subdomain
        if (parts.length === 2) {
            return null;
        }
        // If we have more than 2 parts
        const potentialSubdomain = parts[0];

        // Common patterns to exclude as subdomains
        const excludedSubdomains = ['www'];

        // If the first part is in our excluded list, check if there's another part
        if (potentialSubdomain && excludedSubdomains.includes(potentialSubdomain.toLowerCase())) {
            // If we have more than 3 parts, the second part might be the actual subdomain
            if (parts.length > 3) {
                return parts[1] || null;
            }
            // Otherwise, no subdomain
            return null;
        }

        return potentialSubdomain || null;
    } catch (error) {
        console.error('Error extracting subdomain:', error);
        return null;
    }
}

export function getCurrentSubdomain(): string | null {
    return getSubdomain();
}

export function hasSubdomain(): boolean {
    return getCurrentSubdomain() !== null;
}

export function getMainDomain(url?: string): string {
    try {
        const hostname = url ? new URL(url).hostname : window.location.hostname;
        const subdomain = getSubdomain(url);

        if (!subdomain) {
            return hostname;
        }

        return hostname.replace(`${subdomain}.`, '');
    } catch (error) {
        console.error('Error extracting main domain:', error);
        return '';
    }
}
