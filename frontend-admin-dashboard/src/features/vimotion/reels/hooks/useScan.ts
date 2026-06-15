/**
 * TanStack Query wrapper for POST /external/reels/v1/scan.
 *
 * Uses `useQuery` (not mutation) because the scan is idempotent on the
 * server — same input asset + same config returns the same candidates
 * from the cache for 1h per the backend's TTL. This means refetching is
 * cheap and the FE can let the user tweak config without exploding API
 * calls.
 *
 * Slice 2 only uses default config; slice 4 will pass real config.
 */
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    scanReelCandidates,
    type Aspect,
    type ScanRequest,
    type ScanResponse,
} from '../services/reels-api';

// Thumbnails are generated asynchronously server-side and only appear on a
// subsequent /scan call (which is a cache hit on the backend's config_hash,
// so re-asking is cheap). Without a refetch, a cold scan leaves every card
// as a grey placeholder for the whole session. We poll gently for a bounded
// window after each scan, then stop — the backend only fills thumbnails for
// the top-ranked candidates, so lower ranks may legitimately never get one.
const THUMBNAIL_HEAL_INTERVAL_MS = 7_000;
const THUMBNAIL_HEAL_WINDOW_MS = 45_000; // ≈6 tries

export interface UseScanOptions {
    apiKey: string | undefined;
    inputAssetId: string | undefined;
    targetDurationSec?: number;
    durationToleranceSec?: number;
    scanLimit?: number;
    aspect?: Aspect;
    topicKeywords?: string[];
}

export function useScan(options: UseScanOptions) {
    const {
        apiKey,
        inputAssetId,
        targetDurationSec = 25,
        durationToleranceSec = 3,
        scanLimit = 30,
        aspect = '9:16',
        topicKeywords = [],
    } = options;

    // Per-scan thumbnail-heal window, keyed by the backend's config_hash so
    // a settings change (new scan identity) restarts the window. A ref (not
    // state) because `refetchInterval` may be evaluated several times per
    // render and must stay side-effect-light.
    const thumbHealRef = useRef<{ hash: string; startedAtMs: number } | null>(null);

    return useQuery<ScanResponse>({
        // Include every config field in the key so changing target / aspect /
        // keywords triggers a fresh scan rather than returning stale cache.
        queryKey: [
            'reel-scan',
            apiKey,
            inputAssetId,
            targetDurationSec,
            durationToleranceSec,
            scanLimit,
            aspect,
            // Sort + lowercase keywords so semantically-equivalent inputs
            // collapse to the same key.
            [...topicKeywords].map((k) => k.toLowerCase().trim()).sort().join('|'),
        ],
        enabled: !!apiKey && !!inputAssetId,
        // The server caches for 1h; we cache locally for 5min before
        // re-fetching (typical user flow rarely revisits within an hour).
        staleTime: 5 * 60_000,
        // Don't retry — scans against missing assets / failed indexing
        // should surface immediately so the user sees the error.
        retry: false,
        // Heal missing thumbnails: while any returned candidate still lacks
        // one, background-refetch on a gentle interval for a bounded window.
        refetchInterval: (query) => {
            const data = query.state.data;
            if (!data) return false;
            if (!data.candidates.some((c) => !c.thumbnail_strip_url)) return false;
            const heal = thumbHealRef.current;
            if (!heal || heal.hash !== data.config_hash) {
                thumbHealRef.current = { hash: data.config_hash, startedAtMs: Date.now() };
                return THUMBNAIL_HEAL_INTERVAL_MS;
            }
            if (Date.now() - heal.startedAtMs >= THUMBNAIL_HEAL_WINDOW_MS) return false;
            return THUMBNAIL_HEAL_INTERVAL_MS;
        },
        queryFn: (): Promise<ScanResponse> => {
            if (!apiKey || !inputAssetId) {
                return Promise.reject(new Error('Missing apiKey or inputAssetId'));
            }
            const request: ScanRequest = {
                input_asset_id: inputAssetId,
                target_duration_sec: targetDurationSec,
                duration_tolerance_sec: durationToleranceSec,
                scan_limit: scanLimit,
                aspect,
                topic_keywords: topicKeywords,
            };
            return scanReelCandidates(apiKey, request);
        },
    });
}
