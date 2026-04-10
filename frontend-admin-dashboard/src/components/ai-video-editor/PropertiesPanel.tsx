import { useState, useMemo, useCallback } from 'react';
import { Layers, Type, Sliders, Image, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoEditorStore, DEFAULT_TRANSFORM } from './stores/video-editor-store';
import {
    extractTextElements,
    applyTextPatch,
    deleteTextElement,
    TextElement,
} from './utils/html-text-editor';
import {
    extractMediaElements,
    replaceMediaSrc,
    deleteMediaElement,
    MediaElement,
} from './utils/html-media-editor';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';

// ── Shared helpers ─────────────────────────────────────────────────────────

function formatTime(s?: number | null): string {
    if (s == null) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Slider field ───────────────────────────────────────────────────────────

interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
}

function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{label}</span>
                <span className="font-mono text-[11px] text-gray-700">
                    {Number.isInteger(value) ? value : value.toFixed(2)}
                    {unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
            />
        </div>
    );
}

// ── Transform tab ──────────────────────────────────────────────────────────

interface TransformTabProps {
    entryId: string;
    canvasW: number;
    canvasH: number;
}

function TransformTab({ entryId, canvasW, canvasH }: TransformTabProps) {
    const { entryTransforms, updateEntryTransform, resetEntryTransform } = useVideoEditorStore();
    const transform = entryTransforms[entryId] ?? DEFAULT_TRANSFORM;

    return (
        <div className="space-y-3 p-3">
            <SliderField
                label="X Offset"
                value={transform.x}
                min={-Math.round(canvasW / 2)}
                max={Math.round(canvasW / 2)}
                step={10}
                unit="px"
                onChange={(v) => updateEntryTransform(entryId, { x: v })}
            />
            <SliderField
                label="Y Offset"
                value={transform.y}
                min={-Math.round(canvasH / 2)}
                max={Math.round(canvasH / 2)}
                step={10}
                unit="px"
                onChange={(v) => updateEntryTransform(entryId, { y: v })}
            />
            <SliderField
                label="Scale"
                value={Math.round(transform.scale * 100)}
                min={10}
                max={300}
                step={5}
                unit="%"
                onChange={(v) => updateEntryTransform(entryId, { scale: v / 100 })}
            />
            <SliderField
                label="Rotation"
                value={transform.rotation}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={(v) => updateEntryTransform(entryId, { rotation: v })}
            />
            <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs text-gray-600"
                onClick={() => resetEntryTransform(entryId)}
            >
                Reset Transform
            </Button>
        </div>
    );
}

// ── Text tab ───────────────────────────────────────────────────────────────

const FONT_SIZES = [
    '10px',
    '12px',
    '14px',
    '16px',
    '18px',
    '20px',
    '24px',
    '28px',
    '32px',
    '40px',
    '48px',
    '56px',
    '64px',
    '80px',
    '96px',
];
const FONT_WEIGHTS = [
    { label: 'Normal', value: 'normal' },
    { label: 'Bold', value: 'bold' },
    { label: '300', value: '300' },
    { label: '500', value: '500' },
    { label: '700', value: '700' },
    { label: '900', value: '900' },
];
const ALIGN_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'L', value: 'left' },
    { label: 'C', value: 'center' },
    { label: 'R', value: 'right' },
];

interface TextItemProps {
    el: TextElement;
    canvasW: number;
    canvasH: number;
    onPatch: (index: number, patch: Parameters<typeof applyTextPatch>[2]) => void;
    onDelete: (index: number) => void;
}

function TextItem({ el, canvasW, canvasH, onPatch, onDelete }: TextItemProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-gray-100 last:border-0">
            {/* Row header */}
            <div className="flex items-center">
                <button
                    className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => setOpen((v) => !v)}
                >
                    <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] uppercase text-gray-500">
                        {el.tagName.toLowerCase()}
                    </span>
                    <span className="flex-1 truncate text-[11px] text-gray-700">{el.text}</span>
                    <span className="text-[10px] text-gray-400">{open ? '▲' : '▼'}</span>
                </button>
                <button
                    className="p-2 text-gray-300 transition-colors hover:text-red-500"
                    title="Delete text element"
                    onClick={() => onDelete(el.index)}
                >
                    <Trash2 className="size-3" />
                </button>
            </div>

            {open && (
                <div className="space-y-2 bg-gray-50 px-3 pb-3 pt-1">
                    {/* Text content */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Text</label>
                        <textarea
                            rows={3}
                            defaultValue={el.text}
                            onBlur={(e) => {
                                if (e.target.value !== el.text) {
                                    onPatch(el.index, { text: e.target.value });
                                }
                            }}
                            className="w-full resize-none rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                        />
                    </div>

                    {/* Font size */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Font Size</label>
                        <select
                            value={el.fontSize || ''}
                            onChange={(e) => onPatch(el.index, { fontSize: e.target.value })}
                            className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                        >
                            <option value="">— inherited —</option>
                            {FONT_SIZES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-medium text-gray-500">Color</label>
                        <input
                            type="color"
                            value={el.color || '#000000'}
                            onChange={(e) => onPatch(el.index, { color: e.target.value })}
                            className="h-6 w-10 cursor-pointer rounded border border-gray-200 p-0.5"
                        />
                        <span className="font-mono text-[10px] text-gray-400">
                            {el.color || 'inherited'}
                        </span>
                    </div>

                    {/* Font weight */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Weight</label>
                        <select
                            value={el.fontWeight || ''}
                            onChange={(e) => onPatch(el.index, { fontWeight: e.target.value })}
                            className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                        >
                            <option value="">— inherited —</option>
                            {FONT_WEIGHTS.map((w) => (
                                <option key={w.value} value={w.value}>
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Alignment */}
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-medium text-gray-500">Align</label>
                        <div className="flex gap-1">
                            {ALIGN_OPTIONS.map((a) => (
                                <button
                                    key={a.value}
                                    onClick={() => onPatch(el.index, { textAlign: a.value })}
                                    className={[
                                        'h-6 w-7 rounded border text-[10px] transition-colors',
                                        el.textAlign === a.value
                                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                                    ].join(' ')}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Position (translate) */}
                    <div className="space-y-2 border-t border-gray-200 pt-2">
                        <label className="text-[10px] font-medium text-gray-500">Position</label>
                        <SliderField
                            label="X"
                            value={el.translateX}
                            min={-Math.round(canvasW / 2)}
                            max={Math.round(canvasW / 2)}
                            step={10}
                            unit="px"
                            onChange={(v) => onPatch(el.index, { translateX: v })}
                        />
                        <SliderField
                            label="Y"
                            value={el.translateY}
                            min={-Math.round(canvasH / 2)}
                            max={Math.round(canvasH / 2)}
                            step={10}
                            unit="px"
                            onChange={(v) => onPatch(el.index, { translateY: v })}
                        />
                        {(el.translateX !== 0 || el.translateY !== 0) && (
                            <button
                                onClick={() => onPatch(el.index, { translateX: 0, translateY: 0 })}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700"
                            >
                                Reset position
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

interface TextTabProps {
    entryId: string;
    entryHtml: string;
    canvasW: number;
    canvasH: number;
}

function TextTab({ entryId, entryHtml, canvasW, canvasH }: TextTabProps) {
    const { updateEntryHtml } = useVideoEditorStore();

    const textElements = useMemo(() => extractTextElements(entryHtml), [entryHtml]);

    const handlePatch = useCallback(
        (index: number, patch: Parameters<typeof applyTextPatch>[2]) => {
            updateEntryHtml(entryId, applyTextPatch(entryHtml, index, patch));
        },
        [entryHtml, entryId, updateEntryHtml]
    );

    const handleDelete = useCallback(
        (index: number) => {
            updateEntryHtml(entryId, deleteTextElement(entryHtml, index));
        },
        [entryHtml, entryId, updateEntryHtml]
    );

    if (textElements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <Type className="mb-2 size-6 text-gray-300" />
                <p className="text-xs text-gray-400">No editable text found in this entry</p>
            </div>
        );
    }

    return (
        <div>
            {textElements.map((el) => (
                <TextItem
                    key={el.index}
                    el={el}
                    canvasW={canvasW}
                    canvasH={canvasH}
                    onPatch={handlePatch}
                    onDelete={handleDelete}
                />
            ))}
        </div>
    );
}

// ── Media tab ──────────────────────────────────────────────────────────────

interface MediaItemProps {
    el: MediaElement;
    onReplace: (index: number, newSrc: string) => void;
    onDelete: (index: number) => void;
}

function MediaItem({ el, onReplace, onDelete }: MediaItemProps) {
    const { uploadFile, getPublicUrl } = useFileUpload();
    const [uploading, setUploading] = useState(false);

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
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
                    if (url) onReplace(el.index, url);
                }
            } finally {
                setUploading(false);
            }
        },
        [el.index, onReplace, uploadFile, getPublicUrl]
    );

    return (
        <div className="border-b border-gray-100 p-3 last:border-0">
            {/* Preview */}
            <div className="mb-2 overflow-hidden rounded border border-gray-200 bg-gray-100">
                {el.tagName === 'IMG' ? (
                    <img
                        src={el.src}
                        alt={el.alt || 'media'}
                        className="max-h-24 w-full object-contain"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <video src={el.src} className="max-h-24 w-full object-contain" muted />
                )}
            </div>
            <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] uppercase text-gray-500">
                    {el.tagName.toLowerCase()}
                </span>
                <div className="flex items-center gap-2">
                    <span className="max-w-[110px] truncate text-[10px] text-gray-400">
                        {el.src.split('/').pop()}
                    </span>
                    <button
                        onClick={() => onDelete(el.index)}
                        className="text-gray-300 transition-colors hover:text-red-500"
                        title="Delete media element"
                    >
                        <Trash2 className="size-3" />
                    </button>
                </div>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-1.5 text-[11px] text-gray-500 transition-colors hover:border-indigo-400 hover:text-indigo-600">
                {uploading ? (
                    <>
                        <Loader2 className="size-3 animate-spin" />
                        Uploading…
                    </>
                ) : (
                    <>
                        <Image className="size-3" />
                        Replace {el.tagName === 'VIDEO' ? 'video' : 'image'}
                    </>
                )}
                <input
                    type="file"
                    accept={el.tagName === 'VIDEO' ? 'video/*' : 'image/*'}
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
            </label>
        </div>
    );
}

interface MediaTabProps {
    entryId: string;
    entryHtml: string;
}

function MediaTab({ entryId, entryHtml }: MediaTabProps) {
    const { updateEntryHtml } = useVideoEditorStore();

    const mediaElements = useMemo(() => extractMediaElements(entryHtml), [entryHtml]);

    const handleReplace = useCallback(
        (index: number, newSrc: string) => {
            updateEntryHtml(entryId, replaceMediaSrc(entryHtml, index, newSrc));
        },
        [entryHtml, entryId, updateEntryHtml]
    );

    const handleDelete = useCallback(
        (index: number) => {
            updateEntryHtml(entryId, deleteMediaElement(entryHtml, index));
        },
        [entryHtml, entryId, updateEntryHtml]
    );

    if (mediaElements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <Image className="mb-2 size-6 text-gray-300" />
                <p className="text-xs text-gray-400">No images or videos found in this entry</p>
            </div>
        );
    }

    return (
        <div>
            {mediaElements.map((el) => (
                <MediaItem
                    key={el.index}
                    el={el}
                    onReplace={handleReplace}
                    onDelete={handleDelete}
                />
            ))}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = 'transform' | 'text' | 'media';

interface PropertiesPanelProps {
    /**
     * 'column' (default) — fixed-width right column for landscape layout.
     * 'drawer'           — full-width bottom panel for portrait layout.
     */
    variant?: 'column' | 'drawer';
}

/**
 * Properties panel: transform controls + text editing + media replace.
 * Works as a right column (landscape) or bottom drawer (portrait).
 */
export function PropertiesPanel({ variant = 'column' }: PropertiesPanelProps) {
    const { entries, meta, selectedEntryId, deleteEntry } = useVideoEditorStore();
    const [tab, setTab] = useState<Tab>('transform');

    const entry = selectedEntryId ? entries.find((e) => e.id === selectedEntryId) : null;
    const canvasW = meta.dimensions?.width ?? 1920;
    const canvasH = meta.dimensions?.height ?? 1080;

    const isDrawer = variant === 'drawer';

    // ── Outer wrapper classes ──────────────────────────────────────────────
    const wrapperCls = isDrawer
        ? 'flex w-full shrink-0 flex-col overflow-hidden border-t border-gray-200 bg-white'
        : 'flex h-full w-64 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white';

    // ── Empty state ────────────────────────────────────────────────────────
    if (!entry) {
        if (isDrawer) {
            // In portrait, hide the drawer entirely when nothing is selected
            return null;
        }
        return (
            <div className="flex h-full w-64 shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-white px-4 text-center">
                <Layers className="mb-2 size-8 text-gray-300" />
                <p className="text-xs text-gray-400">
                    Click an entry in the timeline or list to edit its properties
                </p>
            </div>
        );
    }

    const inTime = entry.inTime ?? entry.start;
    const outTime = entry.exitTime ?? entry.end;
    const entryId = entry.id;

    return (
        <div className={wrapperCls} style={isDrawer ? { maxHeight: 280 } : undefined}>
            {/* Header */}
            <div className="shrink-0 border-b border-gray-200 px-3 py-1.5">
                <div className="flex items-center gap-2">
                    <p className="flex-1 truncate font-mono text-xs font-semibold text-gray-800">
                        {entry.id}
                    </p>
                    <span className="text-[10px] text-gray-400">
                        z:{entry.z ?? 0}
                        {meta.navigation === 'time_driven' ? (
                            <span className="ml-1">
                                {formatTime(inTime)} → {formatTime(outTime)}
                            </span>
                        ) : (
                            <span className="ml-1">#{entries.indexOf(entry) + 1}</span>
                        )}
                    </span>
                    <button
                        onClick={() => deleteEntry(entryId)}
                        className="shrink-0 text-gray-300 transition-colors hover:text-red-500"
                        title="Delete entry"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex shrink-0 border-b border-gray-200">
                {(
                    [
                        {
                            id: 'transform',
                            icon: <Sliders className="size-3" />,
                            label: 'Transform',
                        },
                        { id: 'text', icon: <Type className="size-3" />, label: 'Text' },
                        { id: 'media', icon: <Image className="size-3" />, label: 'Media' },
                    ] as const
                ).map(({ id, icon, label }) => (
                    <button
                        key={id}
                        className={[
                            'flex flex-1 items-center justify-center gap-1 py-2 text-[11px] transition-colors',
                            tab === id
                                ? 'border-b-2 border-indigo-500 text-indigo-600'
                                : 'text-gray-500 hover:text-gray-700',
                        ].join(' ')}
                        onClick={() => setTab(id)}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
                {tab === 'transform' && (
                    <TransformTab entryId={entryId} canvasW={canvasW} canvasH={canvasH} />
                )}
                {tab === 'text' && (
                    <TextTab
                        entryId={entryId}
                        entryHtml={entry.html}
                        canvasW={canvasW}
                        canvasH={canvasH}
                    />
                )}
                {tab === 'media' && <MediaTab entryId={entryId} entryHtml={entry.html} />}
            </div>

            {/* Footer: HTML size */}
            <div className="shrink-0 border-t border-gray-100 px-3 py-1">
                <span className="text-[10px] text-gray-400">
                    HTML: {(new TextEncoder().encode(entry.html).length / 1024).toFixed(1)} KB
                    {entry.audio_url && <span className="ml-2 text-green-600">• audio</span>}
                </span>
            </div>
        </div>
    );
}
