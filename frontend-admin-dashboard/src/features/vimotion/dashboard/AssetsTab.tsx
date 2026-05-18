import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
    CheckCircle2,
    Clapperboard,
    Clock,
    FolderOpen,
    Image as ImageIcon,
    Loader2,
    Mic,
    Monitor,
    Upload,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { getUserId } from '@/utils/userDetails';
import { useFileUpload } from '@/hooks/use-file-upload';
import {
    createInputAsset,
    listInputAssets,
    type InputAssetKind,
    type InputAssetMode,
    type InputAssetRecord,
    type InputAssetStatus,
} from '@/routes/video-api-studio/-services/input-asset';
import { useVimotionApiKey } from './hooks/useVimotionApiKey';
import { AssetDetailPanel } from './AssetDetailPanel';

type Filter = 'all' | 'video' | 'image';

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function AssetsTab() {
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);
    const [filter, setFilter] = useState<Filter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);

    const assetsQuery = useQuery({
        queryKey: ['input-assets', instituteId, apiKey.data],
        queryFn: () => listInputAssets(apiKey.data!),
        enabled: !!apiKey.data,
        staleTime: 15_000,
        // Poll while anything is processing so progress bars advance.
        refetchInterval: (query) => {
            const data = query.state.data;
            const hasActive = data?.some((a) =>
                ['PENDING', 'QUEUED', 'PROCESSING'].includes(a.status)
            );
            return hasActive ? 5_000 : false;
        },
    });

    const filteredAssets = useMemo(() => {
        const data = assetsQuery.data ?? [];
        if (filter === 'all') return data;
        return data.filter((a) => a.kind === filter);
    }, [assetsQuery.data, filter]);

    const selected = useMemo(
        () => assetsQuery.data?.find((a) => a.id === selectedId) ?? null,
        [assetsQuery.data, selectedId]
    );

    if (apiKey.isError) {
        return <ErrorState message="Could not connect to the video service. Please try again." />;
    }

    return (
        <div className="space-y-5">
            {/* Toolbar: filter chips + upload */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                    <FilterChip current={filter} value="all" onClick={setFilter}>
                        All
                    </FilterChip>
                    <FilterChip current={filter} value="video" onClick={setFilter}>
                        Videos
                    </FilterChip>
                    <FilterChip current={filter} value="image" onClick={setFilter}>
                        Images
                    </FilterChip>
                </div>
                <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    disabled={!apiKey.data}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Upload className="size-4" />
                    Upload
                </button>
            </div>

            {/* Grid */}
            {apiKey.isLoading || assetsQuery.isLoading ? (
                <LoadingGrid />
            ) : assetsQuery.isError ? (
                <ErrorState message="Could not load your assets. Please refresh." />
            ) : filteredAssets.length === 0 ? (
                <EmptyState onUpload={() => setUploadOpen(true)} hasAny={!!assetsQuery.data?.length} filter={filter} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredAssets.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            onClick={() => setSelectedId(asset.id)}
                        />
                    ))}
                </div>
            )}

            {/* Detail panel */}
            {selected && (
                <AssetDetailPanel
                    asset={selected}
                    apiKey={apiKey.data!}
                    onClose={() => setSelectedId(null)}
                />
            )}

            {/* Upload modal */}
            {uploadOpen && apiKey.data && (
                <UploadModal apiKey={apiKey.data} onClose={() => setUploadOpen(false)} />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
    current,
    value,
    onClick,
    children,
}: {
    current: Filter;
    value: Filter;
    onClick: (v: Filter) => void;
    children: React.ReactNode;
}) {
    const active = current === value;
    return (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            )}
        >
            {children}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Asset card
// ---------------------------------------------------------------------------

function AssetCard({ asset, onClick }: { asset: InputAssetRecord; onClick: () => void }) {
    const isImage = asset.kind === 'image';
    const isCompleted = asset.status === 'COMPLETED';
    // The poller stores the public source URL inside assets_urls under
    // `source_image` (image kind) or `source_video` (video kind). Fall back
    // to source_url for older rows that pre-date the public re-upload.
    const previewUrl =
        (isImage ? asset.assets_urls?.source_image : asset.assets_urls?.source_video) ??
        asset.source_url;

    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-colors hover:border-neutral-300"
        >
            <div className="relative aspect-video w-full bg-neutral-100">
                {isImage && previewUrl && isCompleted ? (
                    <img
                        src={previewUrl}
                        alt={asset.name}
                        className="size-full object-cover"
                        loading="lazy"
                    />
                ) : !isImage && previewUrl && isCompleted ? (
                    // Browser auto-shows a poster frame for muted preload="metadata" videos.
                    <video
                        src={previewUrl}
                        muted
                        preload="metadata"
                        className="size-full object-cover"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                        {isImage ? (
                            <ImageIcon className="size-8" />
                        ) : (
                            <Clapperboard className="size-8" />
                        )}
                    </div>
                )}
                <StatusBadge status={asset.status} progress={asset.progress} />
                <KindBadge kind={asset.kind} mode={asset.mode} />
            </div>
            <div className="flex flex-col gap-1 p-3.5">
                <p className="line-clamp-2 text-sm font-medium text-neutral-900">{asset.name}</p>
                <p className="text-xs text-neutral-500">{describeAsset(asset)}</p>
            </div>
        </button>
    );
}

function describeAsset(asset: InputAssetRecord): string {
    const parts: string[] = [];
    if (asset.kind === 'video' && asset.duration_seconds) {
        parts.push(`${Math.round(asset.duration_seconds)}s`);
    }
    if (asset.kind === 'image' && asset.width && asset.height) {
        parts.push(`${asset.width}×${asset.height}`);
    }
    if (asset.created_at) parts.push(formatTimestamp(asset.created_at));
    return parts.join(' · ');
}

function StatusBadge({ status, progress }: { status: InputAssetStatus; progress: number }) {
    const config: Record<InputAssetStatus, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
        COMPLETED: {
            label: 'Ready',
            Icon: CheckCircle2,
            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        },
        PROCESSING: {
            label: `${progress || 0}%`,
            Icon: Loader2,
            cls: 'bg-blue-50 text-blue-700 border-blue-200',
        },
        QUEUED: {
            label: 'Queued',
            Icon: Clock,
            cls: 'bg-neutral-50 text-neutral-700 border-neutral-200',
        },
        PENDING: {
            label: 'Pending',
            Icon: Clock,
            cls: 'bg-neutral-50 text-neutral-700 border-neutral-200',
        },
        FAILED: {
            label: 'Failed',
            Icon: AlertCircle,
            cls: 'bg-red-50 text-red-700 border-red-200',
        },
    };
    const { label, Icon, cls } = config[status];
    const spinning = status === 'PROCESSING';
    return (
        <span
            className={cn(
                'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                cls
            )}
        >
            <Icon className={cn('size-3', spinning && 'animate-spin')} />
            {label}
        </span>
    );
}

function KindBadge({ kind, mode }: { kind: InputAssetKind; mode: InputAssetMode }) {
    return (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
            {kind === 'image' ? <ImageIcon className="size-3" /> : <Clapperboard className="size-3" />}
            {mode}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Upload modal
// ---------------------------------------------------------------------------

function UploadModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const { uploadFile, getPublicUrl } = useFileUpload();

    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [kind, setKind] = useState<InputAssetKind>('video');
    const [videoMode, setVideoMode] = useState<'demo' | 'podcast'>('demo');
    const [imageMode, setImageMode] = useState<InputAssetMode>('photo');
    const [busy, setBusy] = useState(false);

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;

        if (ACCEPTED_VIDEO_TYPES.includes(f.type)) {
            if (f.size > MAX_VIDEO_SIZE_BYTES) {
                toast.error('Video too large. Max 500MB.');
                return;
            }
            setKind('video');
        } else if (ACCEPTED_IMAGE_TYPES.includes(f.type)) {
            if (f.size > MAX_IMAGE_SIZE_BYTES) {
                toast.error('Image too large. Max 10MB.');
                return;
            }
            setKind('image');
        } else {
            toast.error('Unsupported format. Use MP4/WebM/MOV or PNG/JPEG/WebP.');
            return;
        }

        setFile(f);
        setName(f.name.replace(/\.[^.]+$/, ''));
    };

    const handleUpload = async () => {
        if (!file || !name.trim()) return;
        const mode: InputAssetMode = kind === 'video' ? videoMode : (imageMode as InputAssetMode);

        setBusy(true);
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId(),
                source: kind === 'video' ? 'AI_INPUT_VIDEO' : 'AI_INPUT_IMAGE',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (!fileId) throw new Error('Upload failed');
            const sourceUrl = await getPublicUrl(fileId);
            if (!sourceUrl) throw new Error('Failed to get URL');

            await createInputAsset(apiKey, {
                name: name.trim(),
                kind,
                mode,
                source_url: sourceUrl,
            });

            toast.success(`"${name}" uploaded — indexing started`);
            queryClient.invalidateQueries({ queryKey: ['input-assets'] });
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-neutral-900">Upload asset</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFilePick}
                />

                {!file ? (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-10 text-sm text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
                    >
                        <Upload className="size-6 text-neutral-400" />
                        <span className="font-medium">Choose a file</span>
                        <span className="text-xs text-neutral-500">
                            Video: MP4 / WebM / MOV · max 500MB
                        </span>
                        <span className="text-xs text-neutral-500">
                            Image: PNG / JPEG / WebP · max 10MB
                        </span>
                    </button>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm">
                            {kind === 'image' ? (
                                <ImageIcon className="size-4 text-neutral-500" />
                            ) : (
                                <Clapperboard className="size-4 text-neutral-500" />
                            )}
                            <span className="flex-1 truncate">{file.name}</span>
                            <button
                                type="button"
                                onClick={() => setFile(null)}
                                className="text-xs text-neutral-500 hover:text-neutral-900"
                            >
                                Change
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-neutral-700">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
                                placeholder="Asset name"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-neutral-700">Type</label>
                            <div className="flex flex-wrap gap-1.5">
                                {kind === 'video' ? (
                                    <>
                                        <ModeChip
                                            active={videoMode === 'demo'}
                                            onClick={() => setVideoMode('demo')}
                                            Icon={Monitor}
                                        >
                                            Demo
                                        </ModeChip>
                                        <ModeChip
                                            active={videoMode === 'podcast'}
                                            onClick={() => setVideoMode('podcast')}
                                            Icon={Mic}
                                        >
                                            Podcast
                                        </ModeChip>
                                    </>
                                ) : (
                                    (['photo', 'screenshot', 'diagram'] as const).map((m) => (
                                        <ModeChip
                                            key={m}
                                            active={imageMode === m}
                                            onClick={() => setImageMode(m)}
                                            Icon={ImageIcon}
                                        >
                                            {m.charAt(0).toUpperCase() + m.slice(1)}
                                        </ModeChip>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={busy || !name.trim()}
                                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-neutral-900 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                {busy ? 'Uploading…' : 'Upload & Index'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={busy}
                                className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ModeChip({
    active,
    onClick,
    Icon,
    children,
}: {
    active: boolean;
    onClick: () => void;
    Icon: typeof Mic;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100'
            )}
        >
            <Icon className="size-3" />
            {children}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Empty / loading / error
// ---------------------------------------------------------------------------

function EmptyState({
    onUpload,
    hasAny,
    filter,
}: {
    onUpload: () => void;
    hasAny: boolean;
    filter: Filter;
}) {
    if (hasAny && filter !== 'all') {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
                No {filter}s yet — try a different filter or upload one.
            </div>
        );
    }
    return (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-neutral-50 ring-1 ring-neutral-200">
                <FolderOpen className="size-5 text-primary-500" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-neutral-900">No assets yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                Upload videos (podcasts, demos) or images (photos, screenshots, diagrams) — we
                index them so you can drop them into any generated video.
            </p>
            <button
                type="button"
                onClick={onUpload}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-900 px-5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
            >
                <Upload className="size-4" />
                Upload your first asset
            </button>
        </div>
    );
}

function LoadingGrid() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <div className="aspect-video w-full animate-pulse bg-neutral-100" />
                    <div className="space-y-2 p-3.5">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4" />
                {message}
            </div>
        </div>
    );
}

function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

