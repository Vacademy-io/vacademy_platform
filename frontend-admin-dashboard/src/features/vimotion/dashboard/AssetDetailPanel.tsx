import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, ExternalLink, Image as ImageIcon, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    deleteInputAsset,
    fetchImageMetadata,
    fetchVideoContext,
    type ImageMetadataData,
    type InputAssetRecord,
    type VideoContextData,
} from '@/routes/video-api-studio/-services/input-asset';
import { CreateReelsCTA } from '../reels/dashboard/CreateReelsCTA';
import { VimotionLoader } from '../brand/VimotionLoader';

interface AssetDetailPanelProps {
    asset: InputAssetRecord;
    apiKey: string;
    onClose: () => void;
}

function useDeleteAsset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ apiKey, id }: { apiKey: string; id: string }) =>
            deleteInputAsset(apiKey, id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['input-assets'] }),
        onError: (err: Error) => toast.error(err.message || 'Delete failed'),
    });
}

export function AssetDetailPanel({ asset, apiKey, onClose }: AssetDetailPanelProps) {
    const isImage = asset.kind === 'image';
    const deleteMutation = useDeleteAsset();

    const handleDelete = () => {
        if (!confirm(`Delete "${asset.name}"? This can't be undone.`)) return;
        deleteMutation.mutate(
            { apiKey, id: asset.id },
            { onSuccess: onClose }
        );
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
            <aside
                onClick={(e) => e.stopPropagation()}
                className="flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-neutral-200 p-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            {isImage ? (
                                <ImageIcon className="size-4 text-neutral-500" />
                            ) : (
                                <Clapperboard className="size-4 text-neutral-500" />
                            )}
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-700">
                                {asset.mode}
                            </span>
                        </div>
                        <h2 className="mt-2 break-words text-base font-semibold text-neutral-900">
                            {asset.name}
                        </h2>
                        <p className="mt-1 text-xs text-neutral-500">{describeHeader(asset)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                    {asset.status === 'FAILED' ? (
                        <FailedState message={asset.error_message} />
                    ) : asset.status !== 'COMPLETED' ? (
                        <ProcessingState progress={asset.progress} />
                    ) : isImage ? (
                        <ImageBody asset={asset} />
                    ) : (
                        <VideoBody asset={asset} />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 border-t border-neutral-200 p-3">
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                        {deleteMutation.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="size-3.5" />
                        )}
                        Delete asset
                    </button>
                    {/* "Create Reels from this" — renders nothing when the asset
                        isn't reels-eligible (image / non-podcast / not COMPLETED). */}
                    <CreateReelsCTA asset={asset} />
                </div>
            </aside>
        </div>
    );
}

function describeHeader(asset: InputAssetRecord): string {
    const parts: string[] = [];
    if (asset.kind === 'video' && asset.duration_seconds) {
        parts.push(`${Math.round(asset.duration_seconds)}s`);
    }
    if (asset.resolution) parts.push(asset.resolution);
    if (asset.kind === 'image' && asset.width && asset.height) {
        parts.push(`${asset.width}×${asset.height}`);
    }
    return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Image body
// ---------------------------------------------------------------------------

function ImageBody({ asset }: { asset: InputAssetRecord }) {
    const sourceUrl = asset.assets_urls?.source_image ?? asset.source_url;
    const fgUrl = asset.assets_urls?.image_fg ?? null;

    const metadata = useQuery({
        queryKey: ['image-metadata', asset.id, asset.image_metadata_url],
        queryFn: () => fetchImageMetadata(asset.image_metadata_url!),
        enabled: !!asset.image_metadata_url,
        staleTime: Infinity,
    });

    return (
        <div className="space-y-5">
            {/* Preview */}
            <div className="overflow-hidden rounded-lg bg-neutral-100">
                <img src={sourceUrl} alt={asset.name} className="w-full object-contain" />
            </div>

            {metadata.isLoading ? (
                <p className="text-xs text-neutral-500">Loading metadata…</p>
            ) : metadata.isError || !metadata.data ? (
                <p className="text-xs text-red-600">Could not load metadata.</p>
            ) : (
                <ImageMetadataSections data={metadata.data} fgUrl={fgUrl} />
            )}

            <ArtifactLinks
                links={[
                    { label: 'Source image', url: sourceUrl },
                    { label: 'image_metadata.json', url: asset.image_metadata_url },
                    { label: 'Background-removed PNG', url: fgUrl },
                ]}
            />
        </div>
    );
}

function ImageMetadataSections({
    data,
    fgUrl,
}: {
    data: ImageMetadataData;
    fgUrl: string | null;
}) {
    return (
        <>
            {data.caption && (data.caption.short || data.caption.long) && (
                <Section title="Caption">
                    {data.caption.short && (
                        <p className="text-sm font-medium text-neutral-900">
                            {data.caption.short}
                        </p>
                    )}
                    {data.caption.long && (
                        <p className="mt-1 text-xs text-neutral-600">{data.caption.long}</p>
                    )}
                    {data.caption.tags?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {data.caption.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                    {data.caption.ui_elements && data.caption.ui_elements.length > 0 && (
                        <div className="mt-2">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                                UI elements
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {data.caption.ui_elements.map((e) => (
                                    <span
                                        key={e}
                                        className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                                    >
                                        {e}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </Section>
            )}

            {data.colors.dominant.length > 0 && (
                <Section title="Dominant colors">
                    <div className="flex gap-1.5">
                        {data.colors.dominant.map((c) => (
                            <div key={c.hex} className="flex-1 text-center">
                                <div
                                    className="h-12 w-full rounded-md ring-1 ring-neutral-200"
                                    style={{ backgroundColor: c.hex }}
                                />
                                <p className="mt-1 font-mono text-[10px] text-neutral-500">{c.hex}</p>
                                <p className="text-[10px] text-neutral-400">
                                    {Math.round(c.weight * 100)}%
                                </p>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.faces && data.faces.detected && (
                <Section title="Face">
                    <p className="text-xs text-neutral-700">
                        {data.faces.face_count} face{data.faces.face_count !== 1 ? 's' : ''} detected
                    </p>
                    {data.faces.free_regions && data.faces.free_regions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-[10px] text-neutral-500">Safe zones:</span>
                            {data.faces.free_regions.map((r) => (
                                <span
                                    key={r}
                                    className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                                >
                                    {r}
                                </span>
                            ))}
                        </div>
                    )}
                </Section>
            )}

            {fgUrl && (
                <Section title="Background-removed">
                    <div
                        className="overflow-hidden rounded-md bg-[length:16px_16px] bg-fixed"
                        style={{
                            backgroundImage:
                                'linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%), linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%)',
                            backgroundPosition: '0 0, 8px 8px',
                        }}
                    >
                        <img src={fgUrl} alt="Background removed" className="w-full object-contain" />
                    </div>
                </Section>
            )}

            {data.ocr.blocks.length > 0 && (
                <Section title={`OCR (${data.ocr.blocks.length} blocks)`}>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-neutral-50 p-2">
                        {data.ocr.blocks.slice(0, 50).map((block, i) => (
                            <div key={i} className="text-xs">
                                <span className="text-neutral-700">{block.text}</span>
                                {block.confidence > 0 && (
                                    <span className="ml-2 text-[10px] text-neutral-400">
                                        {Math.round(block.confidence * 100)}%
                                    </span>
                                )}
                            </div>
                        ))}
                        {data.ocr.blocks.length > 50 && (
                            <p className="pt-1 text-[10px] italic text-neutral-400">
                                +{data.ocr.blocks.length - 50} more…
                            </p>
                        )}
                    </div>
                </Section>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Video body
// ---------------------------------------------------------------------------

function VideoBody({ asset }: { asset: InputAssetRecord }) {
    const sourceUrl = asset.assets_urls?.source_video ?? asset.source_url;

    const ctx = useQuery({
        queryKey: ['video-context', asset.id, asset.context_json_url],
        queryFn: () => fetchVideoContext(asset.context_json_url!),
        enabled: !!asset.context_json_url,
        staleTime: Infinity,
    });

    return (
        <div className="space-y-5">
            <div className="overflow-hidden rounded-lg bg-black">
                <video src={sourceUrl} controls preload="metadata" className="w-full" />
            </div>

            {ctx.isLoading ? (
                <p className="text-xs text-neutral-500">Loading metadata…</p>
            ) : ctx.isError || !ctx.data ? (
                <p className="text-xs text-red-600">Could not load video_context.json.</p>
            ) : (
                <VideoContextSections data={ctx.data} />
            )}

            <ArtifactLinks
                links={[
                    { label: 'Source MP4', url: sourceUrl },
                    { label: 'video_context.json', url: asset.context_json_url },
                    { label: 'video_spatial.sqlite', url: asset.spatial_db_url },
                ]}
            />
        </div>
    );
}

function VideoContextSections({ data }: { data: VideoContextData }) {
    const audio = data.meta.audio;
    const transcriptCount = data.transcript?.length ?? 0;

    return (
        <>
            <Section title="Overview">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <Stat label="Duration" value={`${Math.round(data.meta.duration_s)}s`} />
                    <Stat label="Resolution" value={`${data.meta.resolution[0]}×${data.meta.resolution[1]}`} />
                    <Stat label="FPS" value={data.meta.fps_original.toFixed(1)} />
                    <Stat label="Mode" value={data.meta.mode} />
                    {audio && (
                        <>
                            <Stat label="Total words" value={String(audio.total_words)} />
                            <Stat label="WPM" value={audio.words_per_minute.toFixed(1)} />
                            <Stat
                                label="Speech coverage"
                                value={`${Math.round(audio.speech_coverage * 100)}%`}
                            />
                            <Stat label="Sentences" value={String(transcriptCount)} />
                        </>
                    )}
                    <Stat label="Scenes" value={String(data.scenes?.length ?? 0)} />
                    <Stat label="Emphasis marks" value={String(data.emphasis?.length ?? 0)} />
                </dl>
            </Section>

            <Section title="Highlight">
                <p className="text-xs text-neutral-700">
                    {Math.round(data.meta.highlight_window.t_start)}s –{' '}
                    {Math.round(data.meta.highlight_window.t_end)}s
                </p>
                <p className="mt-1 text-xs italic text-neutral-500">
                    {data.meta.highlight_window.reason}
                </p>
            </Section>

            {data.face_segments && data.face_segments.length > 0 && (
                <Section title={`Face segments (${data.face_segments.length})`}>
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-md bg-neutral-50 p-2 text-[11px]">
                        {data.face_segments.slice(0, 20).map((s, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                                <span className="font-mono text-neutral-700">
                                    {Math.round(s.t_start)}s – {Math.round(s.t_end)}s
                                </span>
                                <span className="truncate text-neutral-500">
                                    {(s.free_regions ?? []).slice(0, 3).join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {data.transcript && data.transcript.length > 0 && (
                <Section title="Transcript">
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-md bg-neutral-50 p-2 text-xs">
                        {data.transcript.slice(0, 100).map((s, i) => (
                            <div key={i}>
                                <span className="mr-1 font-mono text-[10px] text-neutral-400">
                                    {Math.round(s.start)}s
                                </span>
                                <span className="text-neutral-800">{s.text}</span>
                            </div>
                        ))}
                        {data.transcript.length > 100 && (
                            <p className="pt-1 text-[10px] italic text-neutral-400">
                                +{data.transcript.length - 100} more…
                            </p>
                        )}
                    </div>
                </Section>
            )}

            {data.prosody && (
                <Section title="Prosody">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <Stat label="Mean RMS" value={data.prosody.mean_rms.toFixed(3)} />
                        <Stat label="Peak RMS" value={data.prosody.peak_rms.toFixed(3)} />
                        <Stat label="Mean pitch (Hz)" value={data.prosody.mean_pitch_hz.toFixed(0)} />
                        <Stat label="Pauses" value={String(data.prosody.pause_count)} />
                    </dl>
                </Section>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {title}
            </h3>
            {children}
        </section>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <>
            <dt className="text-neutral-500">{label}</dt>
            <dd className="font-medium text-neutral-900">{value}</dd>
        </>
    );
}

function ArtifactLinks({ links }: { links: Array<{ label: string; url: string | null }> }) {
    const visible = links.filter((l) => l.url);
    if (visible.length === 0) return null;
    return (
        <Section title="Artifacts">
            <ul className="space-y-0.5">
                {visible.map((link) => (
                    <li key={link.label}>
                        <a
                            href={link.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 hover:underline"
                        >
                            <ExternalLink className="size-3" />
                            {link.label}
                        </a>
                    </li>
                ))}
            </ul>
        </Section>
    );
}

function ProcessingState({ progress }: { progress: number }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <VimotionLoader size={48} className="text-neutral-900" label="Indexing in progress" />
            <p className="text-sm font-medium text-neutral-900">Indexing in progress</p>
            <p className="text-xs text-neutral-500">
                {progress || 0}% — extraction completes in the background.
            </p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-neutral-100">
                <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${progress || 0}%` }}
                />
            </div>
        </div>
    );
}

function FailedState({ message }: { message: string | null }) {
    return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-medium">Indexing failed</p>
            {message && <p className="mt-1">{message}</p>}
        </div>
    );
}

