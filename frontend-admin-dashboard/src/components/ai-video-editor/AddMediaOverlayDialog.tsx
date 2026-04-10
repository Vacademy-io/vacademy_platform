import { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, X, ImageIcon, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useVideoEditorStore } from './stores/video-editor-store';
import { buildMediaOverlayHtml } from './utils/html-media-editor';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';

interface AddMediaOverlayDialogProps {
    open: boolean;
    onClose: () => void;
}

type ObjectFit = 'contain' | 'cover' | 'fill';

/**
 * Dialog for adding a new image/video overlay entry to the timeline.
 *
 * User picks a file → uploads to S3 → sets inTime/exitTime/z-index →
 * a new Entry is inserted into the local timeline.
 */
export function AddMediaOverlayDialog({ open, onClose }: AddMediaOverlayDialogProps) {
    const { meta, entries, addEntry } = useVideoEditorStore();
    const { uploadFile, getPublicUrl } = useFileUpload();

    const navigationMode = meta.navigation;
    const totalDuration = meta.total_duration ?? entries.length;
    const isTimeDriven = navigationMode === 'time_driven';

    // Form state
    const [uploadedSrc, setUploadedSrc] = useState<string>('');
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string>('');

    const [inTime, setInTime] = useState(0);
    const [outTime, setOutTime] = useState(Math.min(5, totalDuration));
    const [zIndex, setZIndex] = useState(500);
    const [objectFit, setObjectFit] = useState<ObjectFit>('contain');
    const [entryIndex, setEntryIndex] = useState(0); // for user_driven

    const inputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setUploadedSrc('');
        setMediaType('image');
        setPreviewUrl('');
        setInTime(0);
        setOutTime(Math.min(5, totalDuration));
        setZIndex(500);
        setObjectFit('contain');
        setEntryIndex(0);
        setUploading(false);
    }, [totalDuration]);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [reset, onClose]);

    const handleFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const isVideo = file.type.startsWith('video/');
            setMediaType(isVideo ? 'video' : 'image');
            // Local preview while uploading
            const localUrl = URL.createObjectURL(file);
            setPreviewUrl(localUrl);
            setUploading(true);

            try {
                const fileId = await uploadFile({
                    file,
                    setIsUploading: () => {},
                    userId: getUserId(),
                    source: 'VIDEO_EDITOR_MEDIA',
                    sourceId: 'ADMIN',
                    publicUrl: true,
                });
                if (fileId) {
                    const url = await getPublicUrl(fileId as string);
                    setUploadedSrc(url || '');
                }
            } catch {
                setPreviewUrl('');
            } finally {
                setUploading(false);
            }
        },
        [uploadFile, getPublicUrl]
    );

    const handleAdd = useCallback(() => {
        if (!uploadedSrc) return;

        const html = buildMediaOverlayHtml(uploadedSrc, mediaType, objectFit);
        const newId = `user-overlay-${Date.now()}`;

        const newEntry = isTimeDriven
            ? {
                  id: newId,
                  html,
                  z: zIndex,
                  inTime,
                  exitTime: outTime,
              }
            : {
                  id: newId,
                  html,
                  z: zIndex,
                  start: entryIndex,
                  end: entryIndex + 1,
              };

        addEntry(newEntry);
        handleClose();
    }, [
        uploadedSrc,
        mediaType,
        objectFit,
        isTimeDriven,
        zIndex,
        inTime,
        outTime,
        entryIndex,
        addEntry,
        handleClose,
    ]);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-sm font-semibold text-gray-800">
                        Add Media Overlay
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Upload area */}
                    <div
                        className="relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-indigo-400"
                        onClick={() => inputRef.current?.click()}
                    >
                        {previewUrl ? (
                            <div className="relative">
                                {mediaType === 'video' ? (
                                    <video
                                        src={previewUrl}
                                        className="max-h-40 w-full object-contain"
                                        muted
                                    />
                                ) : (
                                    <img
                                        src={previewUrl}
                                        className="max-h-40 w-full object-contain"
                                        alt="preview"
                                    />
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                        <Loader2 className="size-5 animate-spin text-indigo-600" />
                                    </div>
                                )}
                                <button
                                    className="absolute right-2 top-2 rounded-full bg-white/80 p-0.5 text-gray-500 hover:text-gray-900"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewUrl('');
                                        setUploadedSrc('');
                                    }}
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-400">
                                <Upload className="size-6" />
                                <p className="text-xs">Click to upload image or video</p>
                                <div className="flex gap-2 text-[10px] text-gray-300">
                                    <span className="flex items-center gap-0.5">
                                        <ImageIcon className="size-3" /> JPG / PNG / GIF / WebP
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                        <Film className="size-3" /> MP4 / WebM
                                    </span>
                                </div>
                            </div>
                        )}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {/* Timing */}
                    {isTimeDriven ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-gray-500">
                                    Start (s)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={totalDuration}
                                    step={0.5}
                                    value={inTime}
                                    onChange={(e) => setInTime(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-gray-500">
                                    End (s)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={totalDuration}
                                    step={0.5}
                                    value={outTime}
                                    onChange={(e) => setOutTime(parseFloat(e.target.value) || 0)}
                                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">
                                Insert at position (entry index)
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={entries.length}
                                step={1}
                                value={entryIndex}
                                onChange={(e) => setEntryIndex(parseInt(e.target.value) || 0)}
                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Z-index + Fit */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">
                                Layer (z-index)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={9999}
                                step={1}
                                value={zIndex}
                                onChange={(e) => setZIndex(parseInt(e.target.value) || 500)}
                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                            />
                            <p className="text-[10px] text-gray-400">≥500 = overlay, ≥9000 = UI</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500">Fit</label>
                            <select
                                value={objectFit}
                                onChange={(e) => setObjectFit(e.target.value as ObjectFit)}
                                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                            >
                                <option value="contain">Contain (letterbox)</option>
                                <option value="cover">Cover (crop)</option>
                                <option value="fill">Fill (stretch)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClose}
                        className="h-8 text-xs"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleAdd}
                        disabled={!uploadedSrc || uploading}
                        className="h-8 bg-indigo-600 text-xs text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="mr-1 size-3 animate-spin" />
                                Uploading…
                            </>
                        ) : (
                            'Add to Timeline'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
