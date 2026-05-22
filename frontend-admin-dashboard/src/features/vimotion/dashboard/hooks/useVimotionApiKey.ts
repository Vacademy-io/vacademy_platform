import { useQuery } from '@tanstack/react-query';
import { generateApiKey, listApiKeys } from '@/routes/video-api-studio/-services/api-keys';

const STORAGE_PREFIX = 'vimotion_api_key_';
const KEY_NAME = 'Vimotion default';

function readCachedKey(instituteId: string): string | null {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(`${STORAGE_PREFIX}${instituteId}`);
    return v && v.length > 0 ? v : null;
}

function writeCachedKey(instituteId: string, key: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${STORAGE_PREFIX}${instituteId}`, key);
}

/**
 * Auto-provisions an external API key for the current institute and caches the
 * full key in localStorage. Used to authenticate calls to /external/video/v1/*
 * (e.g. history) without forcing the user to set anything up manually.
 *
 * Resolution order:
 *   1. localStorage cached full key (set on previous generate)
 *   2. If institute has any active key but none cached locally, we generate
 *      a fresh "Vimotion default" key (the secret only ships once at generate
 *      time, so we can't recover existing key values).
 *   3. If no keys at all, generate one.
 *
 * Failures are surfaced as a normal react-query error so callers can fall back
 * to an empty state.
 */
export function useVimotionApiKey(instituteId: string | undefined) {
    return useQuery({
        queryKey: ['vimotion-api-key', instituteId],
        enabled: !!instituteId,
        staleTime: Infinity,
        // Retry transient failures (network blip on the very first load,
        // brief 5xx) before falling into the error state. react-query uses
        // exponential backoff (~1s → 2s → 4s) so total wait is ~7s before
        // we give up. Past that, the caller's error state surfaces a
        // manual "Try again" affordance via `refetch()`.
        retry: 3,
        queryFn: async (): Promise<string> => {
            if (!instituteId) throw new Error('Missing institute id');

            const cached = readCachedKey(instituteId);
            if (cached) return cached;

            // Generate a fresh "Vimotion default" key. We don't try to detect
            // existing keys via list() and reuse them — the API never returns
            // the full secret after generation, so there's no way to recover
            // an old key value. Generating a new one is cheap and keeps the
            // logic simple.
            const generated = await generateApiKey(instituteId, KEY_NAME);
            writeCachedKey(instituteId, generated.key);
            return generated.key;
        },
    });
}

// Exported for tests / future code that may want to invalidate the cache.
export { readCachedKey, writeCachedKey };

// Re-export listApiKeys so dashboard can show "Manage keys" link if needed.
export { listApiKeys };
