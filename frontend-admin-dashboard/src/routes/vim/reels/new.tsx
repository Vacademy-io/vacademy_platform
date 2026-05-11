import { createFileRoute } from '@tanstack/react-router';
import { CreatePage } from '@/features/vimotion/reels/create/CreatePage';

/**
 * `/vim/reels/new` — Gate 1 + Gate 2 + Gate 3 reel-creation flow.
 *
 * Optional search param `fromAssetId` deep-links to the scan step,
 * skipping the asset picker (used by the "Create Reels from this" CTA
 * on AssetDetailPanel, which lands in FE Phase A slice 5).
 */
interface ReelsNewSearch {
    fromAssetId?: string;
}

export const Route = createFileRoute('/vim/reels/new')({
    component: CreatePage,
    validateSearch: (raw: Record<string, unknown>): ReelsNewSearch => ({
        fromAssetId:
            typeof raw.fromAssetId === 'string' && raw.fromAssetId.length > 0
                ? raw.fromAssetId
                : undefined,
    }),
});
