/**
 * "Create Reels from this" CTA for the AssetDetailPanel footer.
 *
 * Only renders for ai_input_assets that the reels pipeline can actually
 * consume — currently `kind=video && mode=podcast && status=COMPLETED`
 * (matches the backend's `_validate_source_asset` in
 * `app/routers/reels.py`). For anything else, the component returns null
 * so the panel footer stays clean.
 *
 * Clicking it deep-links to `/vim/reels/new?fromAssetId=<id>` — slice 2's
 * CreatePage reads `fromAssetId` from search params and skips the
 * AssetPickerStep, jumping straight to the scan.
 */
import { useNavigate } from '@tanstack/react-router';
import { Scissors } from 'lucide-react';
import type { InputAssetRecord } from '@/routes/video-api-studio/-services/input-asset';

interface CreateReelsCTAProps {
    asset: InputAssetRecord;
}

export function CreateReelsCTA({ asset }: CreateReelsCTAProps) {
    const navigate = useNavigate();

    // Eligibility gate — single place of truth so the rule stays in sync
    // with the backend's _validate_source_asset rejection list.
    if (asset.kind !== 'video') return null;
    if (asset.status !== 'COMPLETED') return null;
    if (asset.mode !== 'podcast') return null;

    const handleClick = () => {
        navigate({
            to: '/vim/reels/new',
            search: { fromAssetId: asset.id },
        });
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800"
        >
            <Scissors className="size-4" />
            Create Reels from this
        </button>
    );
}
