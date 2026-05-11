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
import { useQuery } from '@tanstack/react-query';
import {
    scanReelCandidates,
    type Aspect,
    type ScanRequest,
    type ScanResponse,
} from '../services/reels-api';

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
