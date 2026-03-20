export const AI_COURSE_API_CONFIG = {
    timeout: 60_000,
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
};

export function buildApiUrl(endpoint: string, params: Record<string, string | number>) {
    const backendBase = import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';
    const base = `${backendBase}/media-service/course/ai/v1/${endpoint}`;
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });
    return url.toString();
}
