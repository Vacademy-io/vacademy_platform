export function getSubdomain(hostname: string) {
    // e.g. learner.vacademy.io => learner
    const parts = hostname.split(".");
    if (parts.length >= 3) {
        return parts[0];
    }
    return null;
}
