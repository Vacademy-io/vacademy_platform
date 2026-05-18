/**
 * Step 0 of the reel-create flow: pick an indexed source video.
 *
 * The reels pipeline only supports podcast-mode video assets in COMPLETED
 * state — `_validate_source_asset` in the backend rejects anything else.
 * We pre-filter the list here so the user only sees pickable assets, and
 * include a soft hint for users with non-podcast videos.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clapperboard, Mic } from 'lucide-react';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { cn } from '@/lib/utils';
import {
    listInputAssets,
    type InputAssetRecord,
} from '@/routes/video-api-studio/-services/input-asset';

interface AssetPickerStepProps {
    apiKey: string;
    onPick: (assetId: string) => void;
}

export function AssetPickerStep({ apiKey, onPick }: AssetPickerStepProps) {
    const query = useQuery({
        queryKey: ['input-assets', 'video', apiKey],
        queryFn: () => listInputAssets(apiKey, 'video'),
        enabled: !!apiKey,
        staleTime: 30_000,
    });

    const { pickable, ineligible } = useMemo(() => {
        const data = query.data ?? [];
        const pickable: InputAssetRecord[] = [];
        const ineligible: InputAssetRecord[] = [];
        for (const a of data) {
            if (a.kind !== 'video') continue;
            if (a.status === 'COMPLETED' && a.mode === 'podcast') {
                pickable.push(a);
            } else if (a.mode !== 'podcast' || a.status !== 'COMPLETED') {
                ineligible.push(a);
            }
        }
        return { pickable, ineligible };
    }, [query.data]);

    if (query.isLoading) return <LoadingGrid />;
    if (query.isError) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="size-4" />
                    Could not load your assets — please refresh.
                </div>
            </div>
        );
    }

    if (pickable.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
                    <Mic className="size-5 text-primary-500" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-neutral-900">
                    No indexed podcasts yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                    Reels are cut from indexed long-form podcast videos. Upload a podcast in
                    Assets first — once indexing completes, it’ll show up here.
                </p>
                {ineligible.length > 0 && (
                    <p className="mx-auto mt-3 max-w-md text-xs text-neutral-500">
                        You have {ineligible.length}{' '}
                        {ineligible.length === 1 ? 'video' : 'videos'} in other modes / states
                        that aren’t pickable yet.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-base font-semibold text-neutral-900">
                    Pick a source video
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                    {pickable.length} indexed{' '}
                    {pickable.length === 1 ? 'podcast' : 'podcasts'} ready. We’ll suggest
                    engaging short-clip moments from it.
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pickable.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} onPick={() => onPick(asset.id)} />
                ))}
            </div>
        </div>
    );
}

function AssetCard({
    asset,
    onPick,
}: {
    asset: InputAssetRecord;
    onPick: () => void;
}) {
    const previewUrl = asset.assets_urls?.source_video ?? asset.source_url;
    const duration = asset.duration_seconds
        ? `${Math.round(asset.duration_seconds / 60)}m`
        : '';
    return (
        <button
            type="button"
            onClick={onPick}
            className={cn(
                'group flex flex-col overflow-hidden rounded-xl border border-neutral-200',
                'bg-white text-left transition-all hover:border-neutral-900 hover:shadow-md'
            )}
        >
            <div className="relative aspect-video w-full bg-neutral-100">
                {previewUrl ? (
                    <video
                        src={previewUrl}
                        muted
                        preload="metadata"
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                        <Clapperboard className="size-8" />
                    </div>
                )}
                {duration && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        {duration}
                    </span>
                )}
            </div>
            <div className="flex flex-col gap-1 p-3.5">
                <p className="line-clamp-2 text-sm font-medium text-neutral-900">
                    {asset.name}
                </p>
                <p className="text-xs text-neutral-500">
                    Podcast · ready to clip
                </p>
            </div>
        </button>
    );
}

function LoadingGrid() {
    return (
        <div>
            <div className="mb-5 flex items-center gap-2 text-sm text-neutral-500">
                <VimotionLoader size={16} className="text-neutral-500" label="Loading" />
                Loading your videos…
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                    >
                        <div className="aspect-video w-full animate-pulse bg-neutral-100" />
                        <div className="space-y-2 p-3.5">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                            <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
