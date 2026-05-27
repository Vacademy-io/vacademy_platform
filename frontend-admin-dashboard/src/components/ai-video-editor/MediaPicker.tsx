import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    UploadSimple,
    MagnifyingGlass,
    Sparkle,
    Images,
    Trash,
    SpinnerGap,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

import { useVideoEditorStore } from './stores/video-editor-store';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import {
    apiSearchImages,
    apiSearchVideos,
    apiGenerateImage,
    apiRehost,
    apiSaveAsset,
    apiListAssets,
    apiDeleteAsset,
    MediaSearchItem,
    MediaProvider,
    MediaKind,
    SavedAsset,
} from './utils/media-picker-api';

type Accept = 'image' | 'video' | 'both';
type Tab = 'library' | 'upload' | 'stock' | 'ai';

interface Props {
    open: boolean;
    accept: Accept;
    onSelect: (url: string) => void;
    onClose: () => void;
    title?: string;
    /** Canvas orientation for AI gen + stock orientation. */
    orientation?: 'landscape' | 'portrait';
}

const TAB_LABELS: Record<Tab, string> = {
    library: 'Library',
    upload: 'Upload',
    stock: 'Stock',
    ai: 'AI',
};

/**
 * Unified media picker for the video editor — Library / Upload / Stock
 * (Pexels+Pixabay) / AI-generate tabs. Returns a resolved (S3-hosted) URL via
 * `onSelect`. Stock + AI results are re-hosted to our S3 (so the render worker
 * can fetch them and the URL allowlist accepts them) and auto-saved to the
 * institute's library. Styled to match the editor's existing popovers.
 */
export function MediaPicker({
    open,
    accept,
    onSelect,
    onClose,
    title,
    orientation = 'landscape',
}: Props) {
    const { apiKey } = useVideoEditorStore();
    const { uploadFile, getPublicUrl } = useFileUpload();

    const aiEnabled = accept !== 'video';
    const tabs: Tab[] = aiEnabled
        ? ['library', 'upload', 'stock', 'ai']
        : ['library', 'upload', 'stock'];

    const [tab, setTab] = useState<Tab>('library');
    const [busy, setBusy] = useState(false);

    // Library
    const [assets, setAssets] = useState<SavedAsset[]>([]);
    const [libLoading, setLibLoading] = useState(false);

    // Stock. When `accept === 'both'` the user chooses image vs video via a
    // toggle; otherwise it's fixed by `accept`.
    const [query, setQuery] = useState('');
    const [provider, setProvider] = useState<MediaProvider>('auto');
    const [results, setResults] = useState<MediaSearchItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [stockKindChoice, setStockKindChoice] = useState<MediaKind>('image');
    const stockKind: MediaKind =
        accept === 'video' ? 'video' : accept === 'image' ? 'image' : stockKindChoice;

    // AI
    const [prompt, setPrompt] = useState('');
    const [aiUrl, setAiUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadLibrary = useCallback(async () => {
        if (!apiKey) return;
        setLibLoading(true);
        const res = await apiListAssets(apiKey, accept === 'both' ? undefined : accept);
        setLibLoading(false);
        if (res.ok) setAssets(res.data);
    }, [apiKey, accept]);

    useEffect(() => {
        if (open) {
            setTab('library');
            setResults([]);
            setQuery('');
            setPrompt('');
            setAiUrl(null);
            void loadLibrary();
        }
    }, [open, loadLibrary]);

    // Close on Escape (not while busy with a network op).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, busy, onClose]);

    if (!open) return null;

    const finish = (url: string) => {
        onSelect(url);
        onClose();
    };

    const handleUploadFile = async (file: File) => {
        if (!apiKey) return;
        setBusy(true);
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId() || 'ADMIN',
                source: 'VIDEO_EDITOR_MEDIA',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (!fileId) throw new Error('upload returned no file id');
            const url = await getPublicUrl(fileId);
            const kind: MediaKind = file.type.startsWith('video') ? 'video' : 'image';
            void apiSaveAsset(apiKey, { url, kind, source: 'upload' });
            finish(url);
        } catch {
            toast.error('Upload failed');
        } finally {
            setBusy(false);
        }
    };

    const runSearch = async () => {
        if (!apiKey || !query.trim()) return;
        setSearching(true);
        const res =
            stockKind === 'video'
                ? await apiSearchVideos(apiKey, query.trim(), provider, orientation)
                : await apiSearchImages(apiKey, query.trim(), provider, orientation);
        setSearching(false);
        if (res.ok) setResults(res.data.items);
        else toast.error(res.error || 'Search failed');
    };

    const pickStock = async (item: MediaSearchItem) => {
        if (!apiKey) return;
        setBusy(true);
        try {
            const rehosted = await apiRehost(apiKey, item.url, item.kind);
            const finalUrl = rehosted.ok ? rehosted.data.url : item.url;
            void apiSaveAsset(apiKey, {
                url: finalUrl,
                kind: item.kind,
                source: item.source === 'pixabay' ? 'pixabay' : 'pexels',
                thumb_url: item.thumb,
                source_url: item.source_url,
                photographer: item.photographer,
                width: item.width ?? null,
                height: item.height ?? null,
                duration: item.duration ?? null,
            });
            finish(finalUrl);
        } catch {
            toast.error('Could not use this media');
        } finally {
            setBusy(false);
        }
    };

    const runGenerate = async () => {
        if (!apiKey || !prompt.trim()) return;
        setBusy(true);
        const res = await apiGenerateImage(apiKey, prompt.trim(), orientation);
        setBusy(false);
        if (res.ok) {
            setAiUrl(res.data.url);
            void apiSaveAsset(apiKey, {
                url: res.data.url,
                kind: 'image',
                source: 'ai',
                prompt: prompt.trim(),
            });
        } else {
            toast.error(res.error || 'Generation failed');
        }
    };

    const deleteAsset = async (id: string) => {
        if (!apiKey) return;
        const res = await apiDeleteAsset(apiKey, id);
        if (res.ok) setAssets((a) => a.filter((x) => x.id !== id));
    };

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
            style={{ zIndex: 1100 }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
        >
            <div
                className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
                style={{ maxHeight: '80vh' }}
                role="dialog"
                aria-label={title || 'Choose media'}
            >
                {/* Header + tabs */}
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
                    <div className="flex items-center gap-1">
                        {tabs.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                                    tab === t
                                        ? 'bg-indigo-50 text-indigo-600'
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {t === 'library' && <Images className="size-4" />}
                                {t === 'upload' && <UploadSimple className="size-4" />}
                                {t === 'stock' && <MagnifyingGlass className="size-4" />}
                                {t === 'ai' && <Sparkle className="size-4" />}
                                {TAB_LABELS[t]}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 320 }}>
                    {/* ── Library ── */}
                    {tab === 'library' &&
                        (libLoading ? (
                            <CenteredSpinner label="Loading library…" />
                        ) : assets.length === 0 ? (
                            <EmptyState label="No saved media yet. Upload, search, or generate to add some." />
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {assets.map((a) => (
                                    <div key={a.id} className="group relative">
                                        <button
                                            type="button"
                                            onClick={() => finish(a.url)}
                                            className="block aspect-video w-full overflow-hidden rounded border border-gray-200 hover:border-indigo-400"
                                        >
                                            <img
                                                src={a.thumb_url || a.url}
                                                alt={a.prompt || ''}
                                                className="size-full object-cover"
                                                loading="lazy"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Delete"
                                            onClick={() => deleteAsset(a.id)}
                                            className="absolute right-1 top-1 hidden rounded bg-white/90 p-1 text-gray-500 hover:text-red-600 group-hover:block"
                                        >
                                            <Trash className="size-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))}

                    {/* ── Upload ── */}
                    {tab === 'upload' && (
                        <div className="flex h-full flex-col items-center justify-center gap-3 py-10">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={
                                    accept === 'image'
                                        ? 'image/*'
                                        : accept === 'video'
                                          ? 'video/*'
                                          : 'image/*,video/*'
                                }
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUploadFile(f);
                                    e.target.value = '';
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={busy}
                                className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                            >
                                {busy ? (
                                    <SpinnerGap className="size-4 animate-spin" />
                                ) : (
                                    <UploadSimple className="size-4" />
                                )}
                                {busy ? 'Uploading…' : 'Choose a file'}
                            </button>
                            <p className="text-xs text-gray-400">
                                {accept === 'video'
                                    ? 'Video files'
                                    : accept === 'image'
                                      ? 'Image files'
                                      : 'Image or video files'}
                            </p>
                        </div>
                    )}

                    {/* ── Stock ── */}
                    {tab === 'stock' && (
                        <div className="flex flex-col gap-3">
                            {accept === 'both' && (
                                <div className="flex items-center gap-1 self-start rounded-md bg-gray-100 p-0.5">
                                    {(['image', 'video'] as MediaKind[]).map((k) => (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => {
                                                if (k === stockKindChoice) return;
                                                setStockKindChoice(k);
                                                setResults([]);
                                            }}
                                            className={`rounded px-2.5 py-1 text-xs font-medium ${
                                                stockKindChoice === k
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        >
                                            {k === 'image' ? 'Photos' : 'Videos'}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                                    placeholder={`Search ${stockKind === 'video' ? 'videos' : 'photos'}…`}
                                    className="flex-1 rounded border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
                                />
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as MediaProvider)}
                                    className="rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-600 outline-none"
                                >
                                    <option value="auto">All</option>
                                    <option value="pexels">Pexels</option>
                                    <option value="pixabay">Pixabay</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={runSearch}
                                    disabled={searching || !query.trim()}
                                    className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                                >
                                    {searching ? 'Searching…' : 'Search'}
                                </button>
                            </div>
                            {searching ? (
                                <CenteredSpinner label="Searching…" />
                            ) : results.length === 0 ? (
                                <EmptyState label="Search Pexels & Pixabay for stock media." />
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {results.map((item, i) => (
                                        <button
                                            key={`${item.url}-${i}`}
                                            type="button"
                                            onClick={() => pickStock(item)}
                                            disabled={busy}
                                            className="relative block aspect-video overflow-hidden rounded border border-gray-200 hover:border-indigo-400 disabled:opacity-50"
                                            title={item.alt || item.source}
                                        >
                                            <img
                                                src={item.thumb || item.url}
                                                alt={item.alt}
                                                className="size-full object-cover"
                                                loading="lazy"
                                            />
                                            <span
                                                className="absolute bottom-0 left-0 bg-black/50 px-1 text-white"
                                                style={{ fontSize: 9 }}
                                            >
                                                {item.source}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── AI ── */}
                    {tab === 'ai' && aiEnabled && (
                        <div className="flex flex-col gap-3">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                placeholder="Describe the image you want to generate…"
                                className="resize-y rounded border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400"
                            />
                            <button
                                type="button"
                                onClick={runGenerate}
                                disabled={busy || !prompt.trim()}
                                className="flex items-center justify-center gap-2 self-start rounded bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                            >
                                {busy ? (
                                    <SpinnerGap className="size-4 animate-spin" />
                                ) : (
                                    <Sparkle className="size-4" />
                                )}
                                {busy ? 'Generating…' : 'Generate'}
                            </button>
                            {aiUrl && (
                                <div className="flex flex-col items-start gap-2">
                                    <img
                                        src={aiUrl}
                                        alt={prompt}
                                        className="max-h-64 rounded border border-gray-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => finish(aiUrl)}
                                        className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
                                    >
                                        Use this image
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

function CenteredSpinner({ label }: { label: string }) {
    return (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-400">
            <SpinnerGap className="size-6 animate-spin" />
            <span className="text-xs">{label}</span>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-gray-400">
            {label}
        </div>
    );
}
