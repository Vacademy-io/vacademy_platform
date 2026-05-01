import { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Film, Upload, Loader2, Mic, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import { IndexedVideoItem } from './ContextTray';

interface SourceVideoPopoverProps {
    apiKey?: string | null;
    indexedVideos: IndexedVideoItem[];
    processingVideos: IndexedVideoItem[];
    selectedIds: string[];
    onAddVideo: (id: string) => void;
    onRefresh: () => void;
    /** Disable interaction (e.g. while a generation is in flight). */
    disabled?: boolean;
}

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const MAX_SELECTED_SOURCES = 5;

export function SourceVideoPopover({
    apiKey,
    indexedVideos,
    processingVideos,
    selectedIds,
    onAddVideo,
    onRefresh,
    disabled,
}: SourceVideoPopoverProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, getPublicUrl } = useFileUpload();

    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingName, setPendingName] = useState('');
    const [pendingMode, setPendingMode] = useState<'demo' | 'podcast'>('demo');
    const [isUploading, setIsUploading] = useState(false);

    const availableVideos = indexedVideos.filter((v) => !selectedIds.includes(v.id));
    const totalActive = selectedIds.length + processingVideos.length;
    const atSelectionLimit = selectedIds.length >= MAX_SELECTED_SOURCES;

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
            toast.error('Unsupported format. Use MP4, WebM, or MOV.');
            return;
        }
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
            toast.error('File too large. Max 500MB.');
            return;
        }

        setPendingFile(file);
        setPendingName(file.name.replace(/\.[^.]+$/, ''));
        setPendingMode('demo');
    };

    const handleUploadConfirm = async () => {
        if (!pendingFile || !apiKey || !pendingName.trim()) return;
        setIsUploading(true);
        try {
            const fileId = await uploadFile({
                file: pendingFile,
                setIsUploading: () => {},
                userId: getUserId(),
                source: 'AI_INPUT_VIDEO',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (!fileId) throw new Error('Upload failed');

            const sourceUrl = await getPublicUrl(fileId);
            if (!sourceUrl) throw new Error('Failed to get URL');

            const { createInputVideo } = await import('../../-services/input-video');
            await createInputVideo(apiKey, {
                name: pendingName.trim(),
                mode: pendingMode,
                source_url: sourceUrl,
            });

            toast.success(`"${pendingName}" uploaded — indexing started`);
            setPendingFile(null);
            setPendingName('');
            onRefresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelUpload = () => {
        setPendingFile(null);
        setPendingName('');
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-indigo-600"
                    title="Add a source video clip"
                    aria-label="Add source video"
                    disabled={disabled || !apiKey}
                >
                    <Film className="size-4" />
                    {totalActive > 0 && (
                        <Badge
                            variant="default"
                            className="absolute -right-1 -top-1 size-3.5 min-w-3.5 justify-center px-1 text-[9px]"
                        >
                            {totalActive}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-3" align="start">
                <div className="space-y-3">
                    <div>
                        <p className="text-xs font-semibold">Source videos</p>
                        <p className="text-[10px] text-muted-foreground">
                            Demo footage or podcast audio used inside the generated video.
                        </p>
                    </div>

                    {/* Processing — currently being indexed */}
                    {processingVideos.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Processing
                            </p>
                            {processingVideos.map((v) => (
                                <div
                                    key={v.id}
                                    className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="size-3 shrink-0 animate-spin text-indigo-500" />
                                        <span className="flex-1 truncate">{v.name}</span>
                                        <span className="shrink-0 text-muted-foreground">
                                            {v.progress ?? 0}%
                                        </span>
                                    </div>
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-indigo-500 transition-all"
                                            style={{ width: `${v.progress ?? 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Available — completed and not yet selected */}
                    {availableVideos.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Available
                            </p>
                            <div className="max-h-40 space-y-0.5 overflow-y-auto">
                                {availableVideos.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        disabled={atSelectionLimit}
                                        onClick={() => onAddVideo(v.id)}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <span className="text-muted-foreground">+</span>
                                        <span className="flex-1 truncate">{v.name}</span>
                                        <span className="shrink-0 text-muted-foreground">
                                            {v.mode}
                                            {v.duration_seconds
                                                ? ` · ${Math.round(v.duration_seconds)}s`
                                                : ''}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {availableVideos.length === 0 &&
                        processingVideos.length === 0 &&
                        indexedVideos.length > 0 && (
                            <p className="py-1 text-center text-xs text-muted-foreground">
                                All available videos selected.
                            </p>
                        )}
                    {atSelectionLimit && (
                        <p className="text-xs text-muted-foreground">
                            Max {MAX_SELECTED_SOURCES} videos.
                        </p>
                    )}

                    {/* Upload section */}
                    <div className="space-y-2 border-t pt-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                            className="hidden"
                            onChange={handleFilePick}
                        />

                        {pendingFile ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={pendingName}
                                    onChange={(e) => setPendingName(e.target.value)}
                                    className="w-full rounded-md border px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                                    placeholder="Video name"
                                />
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">Type:</span>
                                    <button
                                        type="button"
                                        onClick={() => setPendingMode('demo')}
                                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                            pendingMode === 'demo'
                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        <Monitor className="size-3" />
                                        Demo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPendingMode('podcast')}
                                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                            pendingMode === 'podcast'
                                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                : 'text-muted-foreground hover:bg-muted'
                                        }`}
                                    >
                                        <Mic className="size-3" />
                                        Podcast
                                    </button>
                                </div>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleUploadConfirm}
                                        disabled={isUploading || !pendingName.trim()}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                            <Upload className="size-3" />
                                        )}
                                        {isUploading ? 'Uploading…' : 'Upload & Index'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelUpload}
                                        disabled={isUploading}
                                        className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed p-2 text-xs text-muted-foreground transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 dark:hover:bg-indigo-950/30"
                            >
                                <Upload className="size-3.5" />
                                Upload new video (MP4 / WebM / MOV · max 500MB)
                            </button>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
