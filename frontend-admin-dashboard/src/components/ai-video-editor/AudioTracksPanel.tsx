/**
 * AudioTracksPanel — manages extra audio tracks for the AI video editor.
 *
 * Tracks are uploaded via the existing useFileUpload hook (S3), not pasted URLs.
 * Each track shows: label, volume, delay, fade controls.
 * The "+" button lets the user pick an audio file, uploads it, then saves the track.
 */

import { useState, useCallback, useRef } from 'react';
import {
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Music2,
    Loader2,
    Upload,
    FileAudio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioTrack } from '@/components/ai-video-player/types';
import { useVideoEditorStore } from './stores/video-editor-store';
import {
    apiAddAudioTrack,
    apiUpdateAudioTrack,
    apiDeleteAudioTrack,
} from './utils/audio-track-api';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import { toast } from 'sonner';

const TRACK_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];
function trackColor(idx: number): string {
    return TRACK_COLORS[idx % TRACK_COLORS.length]!;
}

const ACCEPTED_AUDIO = 'audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/webm,audio/*';

// ── Inline editable row ──────────────────────────────────────────────────────
interface EditRowProps {
    track: AudioTrack;
    colorHex: string;
    onClose: () => void;
    onDelete: () => Promise<void>;
    onSave: (patch: Partial<Omit<AudioTrack, 'id'>>) => Promise<boolean>;
}

function EditRow({ track, colorHex, onClose, onDelete, onSave }: EditRowProps) {
    const [label, setLabel] = useState(track.label);
    const [url, setUrl] = useState(track.url);
    const [volume, setVolume] = useState(track.volume);
    const [delay, setDelay] = useState(track.delay);
    const [fadeIn, setFadeIn] = useState(track.fadeIn);
    const [fadeOut, setFadeOut] = useState(track.fadeOut);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, getPublicUrl } = useFileUpload();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId(),
                source: 'VIDEO_EDITOR_AUDIO',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (fileId) {
                const publicUrl = await getPublicUrl(fileId as string);
                if (publicUrl) {
                    setUrl(publicUrl);
                    // Auto-set label from filename if label is still default
                    if (!label || label === track.label) {
                        setLabel(file.name.replace(/\.[^.]+$/, ''));
                    }
                    toast.success('Audio uploaded');
                } else {
                    toast.error('Upload succeeded but failed to get URL');
                }
            } else {
                toast.error('Upload failed');
            }
        } catch {
            toast.error('Upload failed');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        setSaving(true);
        const ok = await onSave({ label, url, volume, delay, fadeIn, fadeOut });
        setSaving(false);
        if (ok) onClose();
    };

    const handleDelete = async () => {
        setDeleting(true);
        await onDelete();
        setDeleting(false);
    };

    // Extract filename from URL for display
    const fileName = url
        ? decodeURIComponent(url.split('/').pop()?.split('?')[0] || '').slice(0, 30)
        : '';

    return (
        <div
            className="space-y-2.5 rounded-md border p-3"
            style={{ borderColor: `${colorHex}40`, background: `${colorHex}08` }}
        >
            {/* Label */}
            <div className="space-y-0.5">
                <label className="text-[10px] font-medium text-gray-500">Label</label>
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                    placeholder="Background Music"
                />
            </div>

            {/* Audio file upload / replace */}
            <div className="space-y-0.5">
                <label className="text-[10px] font-medium text-gray-500">Audio File</label>
                <div className="flex items-center gap-2">
                    {url && (
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded bg-gray-50 px-2 py-1">
                            <FileAudio className="size-3 shrink-0 text-indigo-500" />
                            <span className="min-w-0 truncate text-[10px] text-gray-600">
                                {fileName}
                            </span>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_AUDIO}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                    >
                        {uploading ? (
                            <Loader2 className="size-3 animate-spin" />
                        ) : (
                            <Upload className="size-3" />
                        )}
                        {url ? 'Replace' : 'Upload'}
                    </Button>
                </div>
            </div>

            {/* Volume + Delay */}
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-medium text-gray-500">Volume</label>
                        <span className="font-mono text-[10px] text-gray-600">
                            {Math.round(volume * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.05}
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200"
                        style={{ accentColor: colorHex }}
                    />
                </div>
                <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-gray-500">Start delay (s)</label>
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={delay}
                        onChange={(e) => setDelay(parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                    />
                </div>
            </div>

            {/* Fade in + Fade out */}
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-gray-500">Fade in (s)</label>
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={fadeIn}
                        onChange={(e) => setFadeIn(parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                    />
                </div>
                <div className="space-y-0.5">
                    <label className="text-[10px] font-medium text-gray-500">Fade out (s)</label>
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={fadeOut}
                        onChange={(e) => setFadeOut(parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-0.5">
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !url}
                    className="h-7 bg-indigo-600 px-3 text-[11px] text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                    {saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onClose}
                    className="h-7 px-3 text-[11px]"
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="ml-auto h-7 px-2 text-[11px] text-red-500 hover:bg-red-50"
                >
                    {deleting ? (
                        <Loader2 className="size-3 animate-spin" />
                    ) : (
                        <Trash2 className="size-3" />
                    )}
                </Button>
            </div>
        </div>
    );
}

// ── Add-track form (upload-based) ────────────────────────────────────────────
interface AddFormProps {
    onAdd: (label: string, url: string) => Promise<void>;
    onCancel: () => void;
}

function AddForm({ onAdd, onCancel }: AddFormProps) {
    const [label, setLabel] = useState('');
    const [url, setUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [adding, setAdding] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, getPublicUrl } = useFileUpload();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId(),
                source: 'VIDEO_EDITOR_AUDIO',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (fileId) {
                const publicUrl = await getPublicUrl(fileId as string);
                if (publicUrl) {
                    setUrl(publicUrl);
                    if (!label) setLabel(file.name.replace(/\.[^.]+$/, ''));
                    toast.success('Audio uploaded');
                } else {
                    toast.error('Upload succeeded but failed to get URL');
                }
            } else {
                toast.error('Upload failed');
            }
        } catch {
            toast.error('Upload failed');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAdd = async () => {
        if (!url) return;
        setAdding(true);
        await onAdd(label || 'Track', url);
        setAdding(false);
    };

    const fileName = url
        ? decodeURIComponent(url.split('/').pop()?.split('?')[0] || '').slice(0, 40)
        : '';

    return (
        <div className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-[11px] font-medium text-indigo-700">New audio track</p>

            {/* Label */}
            <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. Background Music)"
                className="w-full rounded border border-indigo-200 bg-white px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
            />

            {/* Upload area */}
            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_AUDIO}
                onChange={handleFileChange}
                className="hidden"
            />

            {url ? (
                <div className="flex items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded bg-white px-2 py-1.5">
                        <FileAudio className="size-3.5 shrink-0 text-indigo-500" />
                        <span className="min-w-0 truncate text-[11px] text-gray-700">
                            {fileName}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                    >
                        {uploading ? (
                            <Loader2 className="size-3 animate-spin" />
                        ) : (
                            <Upload className="size-3" />
                        )}
                        Replace
                    </Button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-indigo-300 bg-white py-3 text-[11px] text-indigo-500 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="size-4" />
                            Choose audio file (MP3, WAV, OGG, AAC)
                        </>
                    )}
                </button>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={adding || !url}
                    className="h-7 bg-indigo-600 px-3 text-[11px] text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                    {adding ? <Loader2 className="size-3 animate-spin" /> : 'Add Track'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancel}
                    className="h-7 px-3 text-[11px]"
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export function AudioTracksPanel() {
    const { videoId, apiKey, audioTracks, addAudioTrack, updateAudioTrack, removeAudioTrack } =
        useVideoEditorStore();

    const [expanded, setExpanded] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const handleAdd = useCallback(
        async (label: string, url: string) => {
            if (!apiKey) {
                toast.error('No API key — cannot save track.');
                return;
            }
            const tempId = `track-${crypto.randomUUID()}`;
            const newTrack: AudioTrack = {
                id: tempId,
                label,
                url,
                volume: 1.0,
                delay: 0,
                fadeIn: 0,
                fadeOut: 0,
            };
            const result = await apiAddAudioTrack(videoId, apiKey, newTrack);
            if (!result.ok) {
                toast.error(`Failed to add track: ${result.error}`);
                return;
            }
            addAudioTrack({ ...newTrack, id: result.data.track_id });
            setShowAddForm(false);
            toast.success('Audio track added');
        },
        [videoId, apiKey, addAudioTrack]
    );

    const handleSave = useCallback(
        async (trackId: string, patch: Partial<Omit<AudioTrack, 'id'>>): Promise<boolean> => {
            if (!apiKey) {
                toast.error('No API key — cannot save track.');
                return false;
            }
            const result = await apiUpdateAudioTrack(videoId, apiKey, trackId, patch);
            if (!result.ok) {
                toast.error(`Failed to update track: ${result.error}`);
                return false;
            }
            updateAudioTrack(trackId, patch);
            toast.success('Track updated');
            return true;
        },
        [videoId, apiKey, updateAudioTrack]
    );

    const handleDelete = useCallback(
        async (trackId: string) => {
            if (!apiKey) {
                toast.error('No API key — cannot delete track.');
                return;
            }
            const result = await apiDeleteAudioTrack(videoId, apiKey, trackId);
            if (!result.ok) {
                toast.error(`Failed to delete track: ${result.error}`);
                return;
            }
            removeAudioTrack(trackId);
            setEditingId(null);
            toast.success('Track removed');
        },
        [videoId, apiKey, removeAudioTrack]
    );

    return (
        <div className="border-t border-gray-200 bg-white">
            {/* Header row */}
            <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
                onClick={() => setExpanded((v) => !v)}
            >
                <Music2 className="size-3.5 text-indigo-500" />
                <span className="flex-1 text-[11px] font-medium text-gray-700">
                    Audio Tracks
                    {audioTracks.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-600">
                            {audioTracks.length}
                        </span>
                    )}
                </span>
                {expanded ? (
                    <ChevronUp className="size-3.5 text-gray-400" />
                ) : (
                    <ChevronDown className="size-3.5 text-gray-400" />
                )}
            </button>

            {expanded && (
                <div className="space-y-2 px-3 pb-3">
                    {/* Track list */}
                    {audioTracks.map((track, idx) => {
                        const color = trackColor(idx);
                        if (editingId === track.id) {
                            return (
                                <EditRow
                                    key={track.id}
                                    track={track}
                                    colorHex={color}
                                    onClose={() => setEditingId(null)}
                                    onDelete={() => handleDelete(track.id)}
                                    onSave={(patch) => handleSave(track.id, patch)}
                                />
                            );
                        }
                        return (
                            <div
                                key={track.id}
                                className="flex items-center gap-2 rounded border px-2.5 py-1.5"
                                style={{ borderColor: `${color}30` }}
                            >
                                <div
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ background: color }}
                                />
                                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-700">
                                    {track.label}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-gray-400">
                                    {Math.round(track.volume * 100)}%
                                    {track.delay > 0 && ` +${track.delay}s`}
                                </span>
                                <button
                                    onClick={() => setEditingId(track.id)}
                                    className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    title="Edit track"
                                >
                                    <ChevronDown className="size-3" />
                                </button>
                            </div>
                        );
                    })}

                    {/* Empty state */}
                    {audioTracks.length === 0 && !showAddForm && (
                        <p className="text-[11px] text-gray-400">
                            No extra tracks. Add background music or sound effects below.
                        </p>
                    )}

                    {/* Add form */}
                    {showAddForm ? (
                        <AddForm onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAddForm(true)}
                            className="h-7 w-full gap-1.5 border-dashed text-[11px] text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
                        >
                            <Plus className="size-3" />
                            Add Track
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
