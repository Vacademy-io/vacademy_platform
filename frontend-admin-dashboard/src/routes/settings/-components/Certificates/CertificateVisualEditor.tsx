import { useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Trash2, ImagePlus } from 'lucide-react';
import { Palette, Trash } from '@phosphor-icons/react';
import { nanoid } from 'nanoid';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import type {
    FieldMapping,
    ImageTemplate,
} from '@/types/certificate/certificate-types';

// FieldMapping is shared with the bulk wizard, so we don't extend the type.
// Instead we encode "this field is an image" via the fieldName itself:
// - `institute_logo` / `signature`: resolve URL from props.systemImageUrls.
// - `custom_image:<id>`: an admin-uploaded image; URL lives in customImages.
const SYSTEM_IMAGE_FIELDS = new Set(['institute_logo', 'signature']);

const isImageField = (f: FieldMapping): boolean =>
    SYSTEM_IMAGE_FIELDS.has(f.fieldName) || f.fieldName.startsWith('custom_image:');

interface CustomImage {
    id: string; // matches the custom_image:<id> fieldName
    dataUrl: string;
}

interface Props {
    imageTemplate: ImageTemplate;
    fieldMappings: FieldMapping[];
    onFieldMappingsChange: (mappings: FieldMapping[]) => void;
    /**
     * Resolved URLs for system image fields. Currently `institute_logo` and
     * optionally `signature`. Editor uses these to render real previews.
     */
    systemImageUrls?: Partial<Record<'institute_logo' | 'signature', string>>;
    /**
     * Admin-uploaded custom images persisted alongside the template state.
     * Editor exposes an "Upload custom image" button that calls
     * onCustomImagesChange to append.
     */
    customImages?: CustomImage[];
    onCustomImagesChange?: (next: CustomImage[]) => void;
}

type DragMode =
    | { kind: 'idle' }
    | { kind: 'move'; id: string; offsetX: number; offsetY: number }
    | { kind: 'resize'; id: string; startX: number; startY: number; w: number; h: number };

const SCALE_PADDING_PX = 32;

export const CertificateVisualEditor = ({
    imageTemplate,
    fieldMappings,
    onFieldMappingsChange,
    systemImageUrls,
    customImages,
    onCustomImagesChange,
}: Props) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const customImageInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [drag, setDrag] = useState<DragMode>({ kind: 'idle' });
    const [scale, setScale] = useState(1);

    const { setNodeRef, isOver } = useDroppable({
        id: 'image-editor',
        data: { type: 'image-editor' },
    });

    // Compute a fit-to-container scale so a large background image still fits.
    useEffect(() => {
        const recalc = () => {
            const c = containerRef.current;
            if (!c) return;
            const w = c.clientWidth - SCALE_PADDING_PX;
            const s = Math.min(1, w / imageTemplate.width);
            setScale(s);
        };
        recalc();
        const obs = new ResizeObserver(recalc);
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, [imageTemplate.width]);

    // Convert a pointer event to image-natural-coordinate (x, y).
    const evtToImagePos = (e: React.PointerEvent | PointerEvent) => {
        const surface = document.getElementById('cert-editor-surface');
        if (!surface) return { x: 0, y: 0 };
        const rect = surface.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale,
        };
    };

    const updateField = (id: string, patch: Partial<FieldMapping>) => {
        onFieldMappingsChange(
            fieldMappings.map((f) => (f.id === id ? { ...f, ...patch } : f))
        );
    };

    const updateFieldStyle = (id: string, patch: Partial<FieldMapping['style']>) => {
        onFieldMappingsChange(
            fieldMappings.map((f) =>
                f.id === id ? { ...f, style: { ...f.style, ...patch } } : f
            )
        );
    };

    const updateFieldPos = (id: string, patch: Partial<FieldMapping['position']>) => {
        onFieldMappingsChange(
            fieldMappings.map((f) =>
                f.id === id ? { ...f, position: { ...f.position, ...patch } } : f
            )
        );
    };

    const removeField = (id: string) => {
        onFieldMappingsChange(fieldMappings.filter((f) => f.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const startMove = (e: React.PointerEvent, f: FieldMapping) => {
        e.stopPropagation();
        setSelectedId(f.id);
        const pos = evtToImagePos(e);
        setDrag({
            kind: 'move',
            id: f.id,
            offsetX: pos.x - f.position.x,
            offsetY: pos.y - f.position.y,
        });
    };

    const startResize = (e: React.PointerEvent, f: FieldMapping) => {
        e.stopPropagation();
        setSelectedId(f.id);
        setDrag({
            kind: 'resize',
            id: f.id,
            startX: e.clientX,
            startY: e.clientY,
            w: f.position.width,
            h: f.position.height,
        });
    };

    // Global pointermove/up so drags continue if the cursor leaves a field.
    useEffect(() => {
        if (drag.kind === 'idle') return;
        const onMove = (e: PointerEvent) => {
            if (drag.kind === 'move') {
                const pos = evtToImagePos(e);
                updateFieldPos(drag.id, {
                    x: Math.max(0, Math.min(imageTemplate.width, pos.x - drag.offsetX)),
                    y: Math.max(0, Math.min(imageTemplate.height, pos.y - drag.offsetY)),
                });
            } else if (drag.kind === 'resize') {
                const dx = (e.clientX - drag.startX) / scale;
                const dy = (e.clientY - drag.startY) / scale;
                updateFieldPos(drag.id, {
                    width: Math.max(20, drag.w + dx),
                    height: Math.max(16, drag.h + dy),
                });
            }
        };
        const onUp = () => setDrag({ kind: 'idle' });
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drag, scale, imageTemplate.width, imageTemplate.height]);

    // Resolve the URL to render for an image-typed field.
    const resolveImageUrl = (f: FieldMapping): string => {
        if (f.fieldName === 'institute_logo') return systemImageUrls?.institute_logo || '';
        if (f.fieldName === 'signature') return systemImageUrls?.signature || '';
        if (f.fieldName.startsWith('custom_image:')) {
            const id = f.fieldName.split(':')[1];
            return customImages?.find((c) => c.id === id)?.dataUrl || '';
        }
        return '';
    };

    // Upload a custom image: persists data URL + auto-places a FieldMapping.
    const onCustomImagePicked = async (file: File) => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
        });
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.src = dataUrl;
        });
        const id = nanoid(8);
        const next: CustomImage[] = [...(customImages || []), { id, dataUrl }];
        onCustomImagesChange?.(next);

        // Place a sized field at the center, scaled so its longest side ≈ 25% of the canvas.
        const targetMax = Math.max(imageTemplate.width, imageTemplate.height) * 0.25;
        const longest = Math.max(dims.w, dims.h);
        const fit = longest > 0 ? targetMax / longest : 1;
        const w = Math.round(dims.w * fit);
        const h = Math.round(dims.h * fit);
        onFieldMappingsChange([
            ...fieldMappings,
            {
                id: nanoid(),
                fieldName: `custom_image:${id}`,
                displayName: file.name,
                type: 'text',
                position: {
                    x: Math.max(0, (imageTemplate.width - w) / 2),
                    y: Math.max(0, (imageTemplate.height - h) / 2),
                    width: w,
                    height: h,
                },
                style: {
                    fontSize: 14,
                    fontColor: '#000000',
                    fontFamily: 'Arial',
                    alignment: 'left',
                    fontWeight: 'normal',
                },
            },
        ]);
    };

    const selectedField = useMemo(
        () => fieldMappings.find((f) => f.id === selectedId) || null,
        [fieldMappings, selectedId]
    );

    return (
        <div className="flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between rounded border bg-card px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{fieldMappings.length} fields placed</span>
                    {isOver && <span className="text-purple-600">— drop to add</span>}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={customImageInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onCustomImagePicked(f);
                            if (customImageInputRef.current) customImageInputRef.current.value = '';
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => customImageInputRef.current?.click()}
                        className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                    >
                        <ImagePlus className="size-3.5" /> Upload custom image
                    </button>
                </div>
            </div>

            {/* Canvas surface */}
            <div ref={containerRef} className="relative rounded border bg-neutral-100 p-4">
                {selectedField && (
                    <FloatingPropertiesPanel
                        field={selectedField}
                        isImage={isImageField(selectedField)}
                        onChangeStyle={(p) => updateFieldStyle(selectedField.id, p)}
                        onChangePos={(p) => updateFieldPos(selectedField.id, p)}
                        onChangeField={(p) => updateField(selectedField.id, p)}
                        onRemove={() => removeField(selectedField.id)}
                        onClose={() => setSelectedId(null)}
                    />
                )}
                <div
                    ref={setNodeRef}
                    id="cert-editor-surface"
                    className="relative mx-auto bg-white shadow-sm"
                    style={{
                        width: imageTemplate.width * scale,
                        height: imageTemplate.height * scale,
                    }}
                    onClick={() => setSelectedId(null)}
                >
                    <img
                        src={imageTemplate.imageDataUrl}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute inset-0 size-full object-contain"
                    />
                    {/* Inner scaled coordinate system so children use natural pixels */}
                    <div
                        className="absolute left-0 top-0"
                        style={{
                            width: imageTemplate.width,
                            height: imageTemplate.height,
                            transform: `scale(${scale})`,
                            transformOrigin: '0 0',
                        }}
                    >
                        {fieldMappings.map((f) => {
                            const isImg = isImageField(f);
                            const imgUrl = isImg ? resolveImageUrl(f) : '';
                            const selected = f.id === selectedId;
                            return (
                                <div
                                    key={f.id}
                                    onPointerDown={(e) => startMove(e, f)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedId(f.id);
                                    }}
                                    className={`absolute box-border cursor-grab ${selected ? 'ring-2 ring-purple-500' : 'ring-1 ring-neutral-300/60 hover:ring-purple-400'}`}
                                    style={{
                                        left: f.position.x,
                                        top: f.position.y,
                                        width: f.position.width,
                                        height: f.position.height,
                                        background: f.style.backgroundColor,
                                    }}
                                >
                                    {isImg ? (
                                        imgUrl ? (
                                            <img
                                                src={imgUrl}
                                                alt={f.displayName}
                                                draggable={false}
                                                className="size-full object-contain"
                                            />
                                        ) : (
                                            <div className="flex size-full items-center justify-center bg-neutral-100/70 text-[11px] text-neutral-500">
                                                {f.displayName}
                                            </div>
                                        )
                                    ) : (
                                        <div
                                            className="flex size-full items-center"
                                            style={{
                                                color: f.style.fontColor,
                                                fontFamily: f.style.fontFamily,
                                                fontSize: f.style.fontSize,
                                                fontWeight: f.style.fontWeight,
                                                justifyContent:
                                                    f.style.alignment === 'center'
                                                        ? 'center'
                                                        : f.style.alignment === 'right'
                                                          ? 'flex-end'
                                                          : 'flex-start',
                                                padding: f.style.padding,
                                            }}
                                        >
                                            {f.displayName}
                                        </div>
                                    )}

                                    {selected && (
                                        <>
                                            <div
                                                onPointerDown={(e) => startResize(e, f)}
                                                className="absolute bottom-0 right-0 size-3 cursor-se-resize bg-purple-500"
                                                style={{ transform: 'translate(50%,50%)' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeField(f.id);
                                                }}
                                                className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                                                title="Remove"
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

        </div>
    );
};

// Floating, draggable, dismissible properties panel matching the bulk
// wizard's pdf-annotation-editor design pixel-for-pixel: viewport-fixed
// position, gradient purple→blue header with Palette icon, font-size slider,
// font/weight dropdowns, hex text-color input, individual alignment buttons,
// background-color with Clear, Position, and Field Size groups.
const FloatingPropertiesPanel = ({
    field,
    isImage,
    onChangeStyle,
    onChangePos,
    onRemove,
    onClose,
}: {
    field: FieldMapping;
    isImage: boolean;
    onChangeStyle: (p: Partial<FieldMapping['style']>) => void;
    onChangePos: (p: Partial<FieldMapping['position']>) => void;
    onChangeField: (p: Partial<FieldMapping>) => void;
    onRemove: () => void;
    onClose: () => void;
}) => {
    const [pos, setPos] = useState({ x: 20, y: 20 });
    const dragRef = useRef<{ ox: number; oy: number } | null>(null);

    const onHeaderDown = (e: React.MouseEvent) => {
        dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
        const move = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const newX = ev.clientX - dragRef.current.ox;
            const newY = ev.clientY - dragRef.current.oy;
            // Keep panel within viewport bounds (matches the original).
            const maxX = window.innerWidth - 320;
            const maxY = window.innerHeight - 400;
            setPos({
                x: Math.max(0, Math.min(maxX, newX)),
                y: Math.max(0, Math.min(maxY, newY)),
            });
        };
        const up = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    return (
        <div
            className="fixed z-50 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg"
            style={{ left: pos.x, top: pos.y }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Draggable Header */}
            <div
                className="flex cursor-move items-center justify-between rounded-t-lg border-b border-neutral-200 bg-gradient-to-r from-purple-50 to-blue-50 p-3"
                onMouseDown={onHeaderDown}
            >
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-purple-100 p-2">
                        <Palette className="size-4 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-neutral-700">Field Properties</h3>
                        <p className="text-xs text-neutral-500">{field.displayName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={onRemove}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        <Trash className="mr-1 size-3" />
                        Remove
                    </MyButton>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                        title="Close properties"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Panel Content */}
            <div className="p-4">
                <div className="space-y-4">
                    {!isImage && (
                        <>
                            {/* Font Size — max scales with the field box so
                                large boxes on high-res templates can fit large
                                text. Floor at 72 so small boxes still allow a
                                reasonable range. */}
                            {(() => {
                                const dynamicMax = Math.max(
                                    72,
                                    Math.round(field.position.height * 0.9)
                                );
                                return (
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-neutral-700">
                                            Font Size
                                        </label>
                                        <input
                                            type="range"
                                            min={8}
                                            max={dynamicMax}
                                            value={Math.min(field.style.fontSize, dynamicMax)}
                                            onChange={(e) =>
                                                onChangeStyle({
                                                    fontSize: parseInt(e.target.value),
                                                })
                                            }
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>8px</span>
                                            <span className="font-medium">
                                                {field.style.fontSize}px
                                            </span>
                                            <span>{dynamicMax}px</span>
                                        </div>
                                        <input
                                            type="number"
                                            min={8}
                                            value={field.style.fontSize}
                                            onChange={(e) =>
                                                onChangeStyle({
                                                    fontSize: Math.max(
                                                        8,
                                                        parseInt(e.target.value) || 8
                                                    ),
                                                })
                                            }
                                            className="mt-2 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                                            placeholder="Custom px"
                                        />
                                    </div>
                                );
                            })()}

                            {/* Font Family */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    Font Family
                                </label>
                                <select
                                    value={field.style.fontFamily}
                                    onChange={(e) => onChangeStyle({ fontFamily: e.target.value })}
                                    className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                                >
                                    <option value="Arial, sans-serif">Arial</option>
                                    <option value="Times New Roman, serif">Times New Roman</option>
                                    <option value="Helvetica, sans-serif">Helvetica</option>
                                    <option value="Georgia, serif">Georgia</option>
                                    <option value="Courier New, monospace">Courier New</option>
                                    <option value="Verdana, sans-serif">Verdana</option>
                                    <option value="Impact, sans-serif">Impact</option>
                                </select>
                            </div>

                            {/* Font Weight */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    Font Weight
                                </label>
                                <select
                                    value={field.style.fontWeight}
                                    onChange={(e) =>
                                        onChangeStyle({
                                            fontWeight: e.target.value as 'normal' | 'bold',
                                        })
                                    }
                                    className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                                >
                                    <option value="normal">Normal</option>
                                    <option value="bold">Bold</option>
                                </select>
                            </div>

                            {/* Text Color */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    Text Color
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={field.style.fontColor}
                                        onChange={(e) =>
                                            onChangeStyle({ fontColor: e.target.value })
                                        }
                                        className="h-8 w-12 cursor-pointer rounded border border-neutral-200"
                                    />
                                    <input
                                        type="text"
                                        value={field.style.fontColor}
                                        onChange={(e) =>
                                            onChangeStyle({ fontColor: e.target.value })
                                        }
                                        className="flex-1 rounded-md border border-neutral-200 p-2 text-sm"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>

                            {/* Text Alignment */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    Text Alignment
                                </label>
                                <div className="flex gap-1">
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                        <button
                                            key={align}
                                            onClick={() => onChangeStyle({ alignment: align })}
                                            className={cn(
                                                'flex-1 rounded-md border p-2 text-xs transition-all',
                                                field.style.alignment === align
                                                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                                                    : 'border-neutral-200 hover:border-neutral-300'
                                            )}
                                        >
                                            {align.charAt(0).toUpperCase() + align.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Background Color */}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-neutral-700">
                                    Background Color
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={
                                            field.style.backgroundColor &&
                                            field.style.backgroundColor !== 'transparent' &&
                                            !field.style.backgroundColor.includes('rgba')
                                                ? field.style.backgroundColor
                                                : '#ffffff'
                                        }
                                        onChange={(e) =>
                                            onChangeStyle({ backgroundColor: e.target.value })
                                        }
                                        className="h-8 w-12 cursor-pointer rounded border border-neutral-200"
                                    />
                                    <button
                                        onClick={() =>
                                            onChangeStyle({ backgroundColor: 'transparent' })
                                        }
                                        className="rounded-md border border-neutral-200 px-3 py-2 text-xs hover:bg-neutral-50"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Current: {field.style.backgroundColor || 'transparent'}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Position */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">
                            Position
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="mb-1 block text-xs text-neutral-500">
                                    X Position
                                </label>
                                <input
                                    type="number"
                                    value={Math.round(field.position.x)}
                                    onChange={(e) =>
                                        onChangePos({ x: parseInt(e.target.value) || 0 })
                                    }
                                    className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-neutral-500">
                                    Y Position
                                </label>
                                <input
                                    type="number"
                                    value={Math.round(field.position.y)}
                                    onChange={(e) =>
                                        onChangePos({ y: parseInt(e.target.value) || 0 })
                                    }
                                    className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                                    min={0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Field Size */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-700">
                            Field Size
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="mb-1 block text-xs text-neutral-500">
                                    Width
                                </label>
                                <input
                                    type="number"
                                    value={field.position.width}
                                    onChange={(e) =>
                                        onChangePos({
                                            width: Math.max(20, parseInt(e.target.value) || 120),
                                        })
                                    }
                                    className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                                    min={20}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-neutral-500">
                                    Height
                                </label>
                                <input
                                    type="number"
                                    value={field.position.height}
                                    onChange={(e) =>
                                        onChangePos({
                                            height: Math.max(16, parseInt(e.target.value) || 24),
                                        })
                                    }
                                    className="w-full rounded-md border border-neutral-200 p-2 text-sm"
                                    min={16}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Re-export the helper-types so callers can persist customImages alongside
// the imageTemplateJson payload.
export type { CustomImage };
