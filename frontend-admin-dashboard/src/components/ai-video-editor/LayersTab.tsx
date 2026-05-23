import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Type as TypeIcon,
    Image as ImageIcon,
    Video as VideoIcon,
    LayoutGrid,
    Trash2,
    Copy,
    ArrowUp,
    ArrowDown,
    Plus,
    Upload,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVideoEditorStore } from './stores/video-editor-store';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import {
    LayerNode,
    NewLayerKind,
    buildLayerTree,
    pathsEqual,
    patchNodeStyle,
    patchNodeText,
    patchNodeAttr,
    deleteNodeAtPath,
    duplicateNodeAtPath,
    moveNodeAtPath,
    insertChildLayer,
} from './utils/html-tree';
import { inferDisplayMeta } from './registry/friendly-labels';
import { AdvancedSection } from './AdvancedSection';
import { LengthControl, RotationControl } from './controls';
import { OverlayEditor } from './OverlayEditor';
import {
    listOverlays,
    upsertOverlay,
    deleteOverlay,
    newTextOverlay,
    newImageOverlay,
    newVideoOverlay,
    findOverlayPath,
    type Overlay,
} from './utils/html-overlay-editor';

interface LayersTabProps {
    entryId: string;
    entryHtml: string;
}

export function LayersTab({ entryId, entryHtml }: LayersTabProps) {
    const updateEntryHtml = useVideoEditorStore((s) => s.updateEntryHtml);
    const selectedPath = useVideoEditorStore((s) => s.selectedLayerPath);
    const selectLayer = useVideoEditorStore((s) => s.selectLayer);
    const canvasW = useVideoEditorStore((s) => s.meta.dimensions?.width ?? 1080);
    const canvasH = useVideoEditorStore((s) => s.meta.dimensions?.height ?? 1920);

    const tree = useMemo(() => buildLayerTree(entryHtml), [entryHtml]);

    // Chip filter — narrows the visible tree to a kind. "Overlays" matches
    // any node carrying `data-vx-overlay-id` (i.e. anything inside
    // `.vx-overlay`). Container ancestors of matches are preserved so the
    // hierarchy still reads correctly; empty containers with no matching
    // descendants are pruned.
    const [chipFilter, setChipFilter] = useState<ChipFilter>('all');
    const filteredTree = useMemo(
        () => (chipFilter === 'all' ? tree : filterTreeByChip(tree, chipFilter)),
        [tree, chipFilter]
    );

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = useCallback((id: string) => {
        setCollapsed((c) => ({ ...c, [id]: !c[id] }));
    }, []);

    const apply = useCallback(
        (newHtml: string) => {
            updateEntryHtml(entryId, newHtml);
        },
        [entryId, updateEntryHtml]
    );

    const findNode = useCallback(function find(
        nodes: LayerNode[],
        path: number[] | null
    ): LayerNode | null {
        if (!path) return null;
        for (const n of nodes) {
            if (pathsEqual(n.path, path)) return n;
            const inner = find(n.children, path);
            if (inner) return inner;
        }
        return null;
    }, []);

    const selectedNode = useMemo(
        () => findNode(tree, selectedPath),
        [tree, selectedPath, findNode]
    );

    // Overlay detection: a layer node carrying `data-vx-overlay-id` is one of
    // the overlay rows inside the entry's `.vx-overlay` container, and its
    // canonical model lives in the `Overlay` interface (slider-based geometry,
    // anchor, objectFit). When the user selects such a node we render
    // `OverlayEditor` instead of `NodeInspector` so they get the overlay-aware
    // controls — without losing the Layers tree above, where the node still
    // shows in context.
    const overlayId = selectedNode?.attrs['data-vx-overlay-id'];
    const overlays = useMemo<Overlay[]>(
        () => (overlayId ? listOverlays(entryHtml, { w: canvasW, h: canvasH }) : []),
        [overlayId, entryHtml, canvasW, canvasH]
    );
    const selectedOverlay = useMemo<Overlay | null>(
        () => (overlayId ? overlays.find((o) => o.id === overlayId) ?? null : null),
        [overlays, overlayId]
    );

    // File-picker wiring for the OverlayEditor's "Replace" button.
    const { uploadFile, getPublicUrl } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // `id === 'NEW'` is the sentinel meaning "the picked file should create a
    // fresh overlay" (used by the Add-Image / Add-Video toolbar buttons).
    // Any other id means "replace the existing overlay's src" (Replace button
    // inside OverlayEditor).
    const replaceTargetRef = useRef<{ id: string; kind: 'image' | 'video' } | null>(null);
    const [uploadingReplace, setUploadingReplace] = useState(false);

    const onOverlayReplaceSrc = useCallback(() => {
        if (!selectedOverlay) return;
        if (selectedOverlay.kind !== 'image' && selectedOverlay.kind !== 'video') return;
        replaceTargetRef.current = {
            id: selectedOverlay.id,
            kind: selectedOverlay.kind,
        };
        fileInputRef.current?.click();
    }, [selectedOverlay]);

    // Toolbar handlers — Add Text Overlay, Add Image Overlay, Add Video Overlay.
    const addTextOverlay = useCallback(() => {
        const overlay = newTextOverlay('New text');
        const nextHtml = upsertOverlay(entryHtml, overlay);
        updateEntryHtml(entryId, nextHtml);
        // Select the new overlay so the inspector opens immediately on it.
        const path = findOverlayPath(nextHtml, overlay.id);
        if (path) selectLayer(path);
    }, [entryHtml, entryId, updateEntryHtml, selectLayer]);

    const addMediaOverlay = useCallback((kind: 'image' | 'video') => {
        replaceTargetRef.current = { id: 'NEW', kind };
        const input = fileInputRef.current;
        if (!input) return;
        input.accept = kind === 'image' ? 'image/*' : 'video/*';
        input.value = '';
        input.click();
    }, []);

    const handleReplaceFile = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            const target = replaceTargetRef.current;
            // Reset input so picking the same file twice still fires onChange.
            e.target.value = '';
            if (!file || !target) return;
            setUploadingReplace(true);
            try {
                const fileId = await uploadFile({
                    file,
                    setIsUploading: () => {},
                    userId: getUserId(),
                    source: 'VIDEO_EDITOR_MEDIA',
                    sourceId: 'ADMIN',
                    publicUrl: true,
                });
                if (!fileId) {
                    toast.error('Upload failed');
                    return;
                }
                const url = await getPublicUrl(fileId as string);
                if (!url) {
                    toast.error('Could not resolve uploaded URL');
                    return;
                }
                if (target.id === 'NEW') {
                    // Create-overlay flow (Add Image / Add Video toolbar).
                    const fresh =
                        target.kind === 'image' ? newImageOverlay(url) : newVideoOverlay(url);
                    const nextHtml = upsertOverlay(entryHtml, fresh);
                    updateEntryHtml(entryId, nextHtml);
                    const path = findOverlayPath(nextHtml, fresh.id);
                    if (path) selectLayer(path);
                    return;
                }
                // Replace-src flow (Replace button inside OverlayEditor).
                const existing = listOverlays(entryHtml, { w: canvasW, h: canvasH }).find(
                    (o) => o.id === target.id
                );
                if (!existing) return;
                const next = { ...existing, src: url } as Overlay;
                updateEntryHtml(entryId, upsertOverlay(entryHtml, next));
            } finally {
                setUploadingReplace(false);
                replaceTargetRef.current = null;
            }
        },
        [
            entryHtml,
            entryId,
            canvasW,
            canvasH,
            updateEntryHtml,
            uploadFile,
            getPublicUrl,
            selectLayer,
        ]
    );

    const onOverlayPatch = useCallback(
        (patch: Partial<Overlay>) => {
            if (!selectedOverlay) return;
            const next = { ...selectedOverlay, ...patch } as Overlay;
            updateEntryHtml(entryId, upsertOverlay(entryHtml, next));
        },
        [selectedOverlay, entryHtml, entryId, updateEntryHtml]
    );

    const onOverlayDelete = useCallback(() => {
        if (!selectedOverlay) return;
        updateEntryHtml(entryId, deleteOverlay(entryHtml, selectedOverlay.id));
        selectLayer(null);
    }, [selectedOverlay, entryHtml, entryId, updateEntryHtml, selectLayer]);

    const insertChild = useCallback(
        (parentPath: number[] | null, kind: NewLayerKind) => {
            const result = insertChildLayer(entryHtml, parentPath, kind);
            updateEntryHtml(entryId, result.html);
            selectLayer(result.path);
        },
        [entryHtml, entryId, updateEntryHtml, selectLayer]
    );

    /** Apply a structural change (delete/duplicate/move) and clear the layer
     *  selection — the path it was pointing to may now reference the wrong
     *  node or no node at all. */
    const applyStructural = useCallback(
        (newHtml: string) => {
            updateEntryHtml(entryId, newHtml);
            selectLayer(null);
        },
        [entryId, updateEntryHtml, selectLayer]
    );

    // Keyboard shortcuts while a layer is selected.
    useEffect(() => {
        if (!selectedPath) return;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            // Don't steal keys from inputs/textareas/contenteditable.
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.tagName === 'SELECT' ||
                    t.isContentEditable)
            ) {
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                selectLayer(null);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                applyStructural(deleteNodeAtPath(entryHtml, selectedPath));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedPath, entryHtml, applyStructural, selectLayer]);

    return (
        <div className="flex h-full flex-col">
            {/* Add Overlay toolbar — replaces the old Overlays tab. Drops
                Text / Image / Video overlays into the shot's .vx-overlay
                container; the new row appears in the tree below and the
                inspector auto-routes to OverlayEditor for it. */}
            <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-2 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    Add overlay
                </span>
                <button
                    type="button"
                    onClick={addTextOverlay}
                    title="Add text overlay"
                    className="flex h-6 items-center gap-1 rounded border border-gray-200 bg-white px-2 text-[11px] text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                >
                    <TypeIcon className="size-3" />
                    Text
                </button>
                <button
                    type="button"
                    onClick={() => addMediaOverlay('image')}
                    title="Add image overlay"
                    className="flex h-6 items-center gap-1 rounded border border-gray-200 bg-white px-2 text-[11px] text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                >
                    <ImageIcon className="size-3" />
                    Image
                </button>
                <button
                    type="button"
                    onClick={() => addMediaOverlay('video')}
                    title="Add video overlay"
                    className="flex h-6 items-center gap-1 rounded border border-gray-200 bg-white px-2 text-[11px] text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
                >
                    <VideoIcon className="size-3" />
                    Video
                </button>
            </div>

            {/* Chip filters — narrow the tree to a kind without losing
                hierarchy. "All" disables filtering. */}
            {tree.length > 0 && (
                <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-100 px-2 py-1.5">
                    {(
                        [
                            { id: 'all', label: 'All' },
                            { id: 'text', label: 'Text' },
                            { id: 'image', label: 'Image' },
                            { id: 'video', label: 'Video' },
                            { id: 'overlays', label: 'Overlays' },
                        ] as const
                    ).map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setChipFilter(id)}
                            className={[
                                'h-6 shrink-0 rounded-full border px-2.5 text-[11px] transition-colors',
                                chipFilter === id
                                    ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                                    : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800',
                            ].join(' ')}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-1">
                {tree.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-[11px] text-gray-400">
                        <span>Empty document</span>
                        <AddLayerMenu
                            label="Add first layer"
                            onPick={(kind) => insertChild(null, kind)}
                        />
                    </div>
                ) : filteredTree.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[11px] text-gray-400">
                        No {chipFilter} in this entry.
                    </div>
                ) : (
                    filteredTree.map((node) => (
                        <LayerRow
                            key={node.id}
                            node={node}
                            depth={0}
                            collapsed={collapsed}
                            onToggle={toggle}
                            selectedPath={selectedPath}
                            onSelect={selectLayer}
                            entryHtml={entryHtml}
                            apply={apply}
                            applyStructural={applyStructural}
                            onInsertChild={insertChild}
                        />
                    ))
                )}
            </div>

            {/* Inspector — routes by overlay-ness. Nodes inside `.vx-overlay`
                that carry a `data-vx-overlay-id` use the overlay-aware editor
                (sliders + objectFit + auto-aspect). Everything else uses the
                generic DOM-node inspector. */}
            {selectedNode && selectedOverlay ? (
                <div className="border-t border-gray-200 p-2">
                    <OverlayEditor
                        key={selectedOverlay.id}
                        overlay={selectedOverlay}
                        selected={true}
                        onSelect={() => {
                            /* already selected via tree row */
                        }}
                        onPatch={onOverlayPatch}
                        onDelete={onOverlayDelete}
                        onReplaceSrc={onOverlayReplaceSrc}
                        hideHeader={true}
                    />
                    {uploadingReplace && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500">
                            <Loader2 className="size-3 animate-spin" />
                            Uploading replacement…
                        </div>
                    )}
                </div>
            ) : selectedNode ? (
                <NodeInspector
                    key={selectedNode.id}
                    node={selectedNode}
                    entryHtml={entryHtml}
                    apply={apply}
                />
            ) : (
                <div className="border-t border-gray-200 p-3 text-[11px] text-gray-400">
                    Select a layer to edit its properties.
                </div>
            )}

            {/* Hidden file input used by the OverlayEditor's Replace button */}
            <input
                ref={fileInputRef}
                type="file"
                accept={
                    replaceTargetRef.current?.kind === 'video'
                        ? 'video/*'
                        : replaceTargetRef.current?.kind === 'image'
                          ? 'image/*'
                          : 'image/*,video/*'
                }
                className="hidden"
                onChange={handleReplaceFile}
            />
        </div>
    );
}

interface LayerRowProps {
    node: LayerNode;
    depth: number;
    collapsed: Record<string, boolean>;
    onToggle: (id: string) => void;
    selectedPath: number[] | null;
    onSelect: (path: number[] | null) => void;
    entryHtml: string;
    apply: (newHtml: string) => void;
    /** Like `apply` but also clears selection — use for delete/move/duplicate
     *  where the path may stop pointing to the same node. */
    applyStructural: (newHtml: string) => void;
    onInsertChild: (parentPath: number[] | null, kind: NewLayerKind) => void;
}

function LayerRow({
    node,
    depth,
    collapsed,
    onToggle,
    selectedPath,
    onSelect,
    entryHtml,
    apply,
    applyStructural,
    onInsertChild,
}: LayerRowProps) {
    const viewMode = useVideoEditorStore((s) => s.viewMode);
    const display = inferDisplayMeta({
        tag: node.tag,
        kind: node.kind,
        style: node.style,
    });
    const Icon = display.icon;
    const isSelected = pathsEqual(node.path, selectedPath);
    const isCollapsed = collapsed[node.id] ?? false;
    const preview = nodePreview(node);
    // In simple mode, filter advanced children (SVG filter primitives etc.)
    // out of the visible tree. Capability is preserved — switch to developer
    // mode to see and edit them, or use the entry's HTML/Code tab.
    const visibleChildren =
        viewMode === 'simple'
            ? node.children.filter(
                  (c) => !inferDisplayMeta({ tag: c.tag, kind: c.kind, style: c.style }).advanced
              )
            : node.children;
    const hasChildren = visibleChildren.length > 0;

    return (
        <div>
            <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(node.path)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(node.path);
                    }
                }}
                className={[
                    'group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] transition-colors',
                    isSelected
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'text-gray-700 hover:bg-gray-100',
                ].join(' ')}
                style={{ paddingLeft: 4 + depth * 12 }}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle(node.id);
                    }}
                    className={[
                        'flex size-3.5 shrink-0 items-center justify-center rounded text-gray-400',
                        hasChildren ? 'hover:bg-gray-200 hover:text-gray-700' : 'opacity-0',
                    ].join(' ')}
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? (
                        <ChevronRight className="size-3" />
                    ) : (
                        <ChevronDown className="size-3" />
                    )}
                </button>

                <Icon className="size-3 shrink-0 text-gray-400" />

                {/* Label + content preview. The label tells the user what
                    kind of node this is ("Text", "Image", "Heading"); the
                    preview shows *which one* — the actual words for text,
                    the file name / alt for media — so a tree of half a
                    dozen "Text" rows can be told apart at a glance. */}
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                    <span className="shrink-0">{display.label}</span>
                    {preview && (
                        <span
                            className={[
                                'min-w-0 flex-1 truncate text-[10px]',
                                isSelected ? 'text-indigo-500' : 'text-gray-400',
                            ].join(' ')}
                            title={preview.full}
                        >
                            {preview.short}
                        </span>
                    )}
                </span>

                {/* Tag-name badge — only shown in developer mode. Layman users
                    don't need to know whether something is a `div` or a `span`. */}
                {viewMode === 'developer' && (
                    <span className="hidden shrink-0 font-mono text-[9px] text-gray-400 group-hover:inline">
                        {node.tag}
                    </span>
                )}

                {/* Row actions — only for the selected row to avoid clutter */}
                {isSelected && (
                    <span className="flex shrink-0 items-center gap-0.5">
                        <AddLayerMenuButton onPick={(kind) => onInsertChild(node.path, kind)} />
                        <RowAction
                            title="Move up"
                            onClick={(e) => {
                                e.stopPropagation();
                                applyStructural(moveNodeAtPath(entryHtml, node.path, 'up'));
                            }}
                        >
                            <ArrowUp className="size-3" />
                        </RowAction>
                        <RowAction
                            title="Move down"
                            onClick={(e) => {
                                e.stopPropagation();
                                applyStructural(moveNodeAtPath(entryHtml, node.path, 'down'));
                            }}
                        >
                            <ArrowDown className="size-3" />
                        </RowAction>
                        <RowAction
                            title="Duplicate"
                            onClick={(e) => {
                                e.stopPropagation();
                                applyStructural(duplicateNodeAtPath(entryHtml, node.path));
                            }}
                        >
                            <Copy className="size-3" />
                        </RowAction>
                        <RowAction
                            title="Delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                applyStructural(deleteNodeAtPath(entryHtml, node.path));
                            }}
                            danger
                        >
                            <Trash2 className="size-3" />
                        </RowAction>
                    </span>
                )}
            </div>

            {hasChildren && !isCollapsed && (
                <div>
                    {visibleChildren.map((child) => (
                        <LayerRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            collapsed={collapsed}
                            onToggle={onToggle}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            entryHtml={entryHtml}
                            apply={apply}
                            applyStructural={applyStructural}
                            onInsertChild={onInsertChild}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Click-anchored popover that lets the user pick a kind for a new layer.
 * Used both inline in each row's action group (as an icon button) and as
 * a labeled button on the empty-tree fallback.
 */
function AddLayerMenu({ label, onPick }: { label: string; onPick: (kind: NewLayerKind) => void }) {
    return (
        <AddLayerPopover
            onPick={onPick}
            renderTrigger={(toggle) => (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggle();
                    }}
                    className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                    <Plus className="size-3" />
                    {label}
                </button>
            )}
        />
    );
}

function AddLayerMenuButton({ onPick }: { onPick: (kind: NewLayerKind) => void }) {
    return (
        <AddLayerPopover
            onPick={onPick}
            renderTrigger={(toggle) => (
                <button
                    type="button"
                    title="Add child layer"
                    aria-label="Add child layer"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggle();
                    }}
                    className="flex size-4 items-center justify-center rounded text-gray-400 transition hover:bg-gray-200 hover:text-indigo-600"
                >
                    <Plus className="size-3" />
                </button>
            )}
        />
    );
}

function AddLayerPopover({
    onPick,
    renderTrigger,
}: {
    onPick: (kind: NewLayerKind) => void;
    renderTrigger: (toggle: () => void) => React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const pick = (kind: NewLayerKind) => {
        onPick(kind);
        setOpen(false);
    };

    return (
        <span ref={containerRef} className="relative inline-flex">
            {renderTrigger(() => setOpen((v) => !v))}
            {open && (
                <div
                    className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <AddLayerOption
                        icon={<TypeIcon className="size-3.5" />}
                        label="Text"
                        onClick={() => pick('text')}
                    />
                    <AddLayerOption
                        icon={<ImageIcon className="size-3.5" />}
                        label="Image"
                        onClick={() => pick('image')}
                    />
                    <AddLayerOption
                        icon={<VideoIcon className="size-3.5" />}
                        label="Video"
                        onClick={() => pick('video')}
                    />
                    <AddLayerOption
                        icon={<LayoutGrid className="size-3.5" />}
                        label="Group"
                        onClick={() => pick('group')}
                    />
                </div>
            )}
        </span>
    );
}

function AddLayerOption({
    icon,
    label,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
        >
            <span className="text-gray-500">{icon}</span>
            {label}
        </button>
    );
}

function RowAction({
    title,
    danger,
    onClick,
    children,
}: {
    title: string;
    danger?: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className={[
                'flex size-4 items-center justify-center rounded transition',
                danger
                    ? 'text-gray-400 hover:bg-red-100 hover:text-red-600'
                    : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700',
            ].join(' ')}
        >
            {children}
        </button>
    );
}

interface NodeInspectorProps {
    node: LayerNode;
    entryHtml: string;
    apply: (newHtml: string) => void;
}

function NodeInspector({ node, entryHtml, apply }: NodeInspectorProps) {
    const viewMode = useVideoEditorStore((s) => s.viewMode);
    const display = inferDisplayMeta({ tag: node.tag, kind: node.kind, style: node.style });
    const setStyle = (patch: Record<string, string | null>) => {
        apply(patchNodeStyle(entryHtml, node.path, patch));
    };
    const setAttr = (attr: string, value: string | null) => {
        apply(patchNodeAttr(entryHtml, node.path, attr, value));
    };
    const setText = (value: string) => {
        apply(patchNodeText(entryHtml, node.path, value));
    };

    return (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-gray-200 bg-gray-50 p-3">
            {/* Header — friendly kind label. The raw HTML tag only shows in
                developer mode so layman users don't see `div` / `svg` etc. */}
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
                <span className="font-semibold text-gray-600">{display.label}</span>
                {viewMode === 'developer' && (
                    <span className="font-mono text-indigo-500">{node.tag}</span>
                )}
            </div>

            {node.kind === 'text' && (
                <Field label="Text">
                    <ControlledTextarea
                        value={node.textContent ?? ''}
                        rows={2}
                        onCommit={(v) => setText(v)}
                    />
                </Field>
            )}

            {(node.kind === 'image' || node.kind === 'video') && (
                <Field label="Source">
                    <MediaSourceField
                        value={node.attrs.src ?? ''}
                        kind={node.kind}
                        onCommit={(v) => setAttr('src', v || null)}
                    />
                </Field>
            )}

            {/* Primary controls — friendly sliders / pickers. Non-percentage
                values (auto / px / calc) fall back to a raw text input via
                LengthControl's `Custom` mode, so every value is reachable. */}
            <Field label="X position">
                <LengthControl
                    value={node.style.left ?? ''}
                    onCommit={(v) => setStyle({ left: v || null })}
                    placeholder="40%"
                    min={-50}
                    max={100}
                />
            </Field>
            <Field label="Y position">
                <LengthControl
                    value={node.style.top ?? ''}
                    onCommit={(v) => setStyle({ top: v || null })}
                    placeholder="40%"
                    min={-50}
                    max={100}
                />
            </Field>
            <Field label="Width">
                <LengthControl
                    value={node.style.width ?? ''}
                    onCommit={(v) => setStyle({ width: v || null })}
                    placeholder="auto"
                />
            </Field>
            <Field label="Height">
                <LengthControl
                    value={node.style.height ?? ''}
                    onCommit={(v) => setStyle({ height: v || null })}
                    placeholder="auto"
                />
            </Field>

            <Field label="Opacity">
                <StyleInput
                    value={node.style.opacity ?? ''}
                    onCommit={(v) => setStyle({ opacity: v || null })}
                    placeholder="1"
                />
            </Field>

            {(node.kind === 'text' || node.kind === 'group' || node.kind === 'other') && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Color">
                        <StyleInput
                            value={node.style.color ?? ''}
                            onCommit={(v) => setStyle({ color: v || null })}
                            placeholder="#fff"
                        />
                    </Field>
                    <Field label="Text size">
                        <StyleInput
                            value={node.style['font-size'] ?? ''}
                            onCommit={(v) => setStyle({ 'font-size': v || null })}
                            placeholder="32px"
                        />
                    </Field>
                </div>
            )}

            {/* Advanced — raw CSS escape hatches plus the friendly rotation
                control. Collapsed in simple mode, expanded in developer mode;
                the user can always click to expand. Nothing here is hidden
                from a layman who wants to drill in. */}
            <AdvancedSection>
                <Field label="Rotation">
                    <RotationControl
                        value={node.style.transform ?? ''}
                        onCommit={(v) => setStyle({ transform: v || null })}
                    />
                </Field>
                <Field label="Transform (raw CSS)">
                    <StyleInput
                        value={node.style.transform ?? ''}
                        onCommit={(v) => setStyle({ transform: v || null })}
                        placeholder="translate(-50%,-50%) rotate(0deg)"
                    />
                </Field>
                <Field label="Layer order (z-index)">
                    <StyleInput
                        value={node.style['z-index'] ?? ''}
                        onCommit={(v) => setStyle({ 'z-index': v || null })}
                        placeholder="1"
                    />
                </Field>
                <Field label="CSS class">
                    <ControlledTextInput
                        value={node.attrs.class ?? ''}
                        onCommit={(v) => setAttr('class', v || null)}
                    />
                </Field>
            </AdvancedSection>
        </div>
    );
}

function MediaSourceField({
    value,
    kind,
    onCommit,
}: {
    value: string;
    kind: 'image' | 'video';
    onCommit: (v: string) => void;
}) {
    const { uploadFile, getPublicUrl } = useFileUpload();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);

    const onPick = () => inputRef.current?.click();

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            if (!fileId) throw new Error('Upload failed');
            const url = await getPublicUrl(fileId as string);
            if (!url) throw new Error('Failed to resolve public URL');
            onCommit(url);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
                <ControlledTextInput value={value} onCommit={onCommit} />
            </div>
            <button
                type="button"
                onClick={onPick}
                disabled={uploading}
                title={`Upload ${kind}`}
                className="flex h-[26px] shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2 text-[10px] text-gray-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
            >
                {uploading ? (
                    <Loader2 className="size-3 animate-spin" />
                ) : (
                    <Upload className="size-3" />
                )}
                {uploading ? 'Uploading' : 'Upload'}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept={kind === 'image' ? 'image/*' : 'video/*'}
                className="hidden"
                onChange={onFile}
            />
        </div>
    );
}

function ControlledTextInput({
    value,
    onCommit,
}: {
    value: string;
    onCommit: (v: string) => void;
}) {
    const [draft, setDraft] = useState(value);
    useEffect(() => {
        setDraft(value);
    }, [value]);
    return (
        <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={() => {
                if (draft !== value) onCommit(draft);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
            }}
            className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-[11px]"
        />
    );
}

function ControlledTextarea({
    value,
    rows,
    onCommit,
}: {
    value: string;
    rows: number;
    onCommit: (v: string) => void;
}) {
    const [draft, setDraft] = useState(value);
    useEffect(() => {
        setDraft(value);
    }, [value]);
    return (
        <textarea
            rows={rows}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={() => {
                if (draft !== value) onCommit(draft);
            }}
            className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-[11px]"
        />
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="mb-2 block">
            <span className="mb-0.5 block text-[10px] font-medium text-gray-500">{label}</span>
            {children}
        </label>
    );
}

function StyleInput({
    value,
    onCommit,
    placeholder,
}: {
    value: string;
    onCommit: (v: string) => void;
    placeholder?: string;
}) {
    // Controlled with a local draft so users can type freely, but the draft
    // resyncs whenever the underlying value changes externally (undo, store
    // commit from elsewhere, etc.) — `defaultValue` would have masked those.
    const [draft, setDraft] = useState(value);
    useEffect(() => {
        setDraft(value);
    }, [value]);
    return (
        <input
            type="text"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={() => {
                if (draft !== value) onCommit(draft);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
            }}
            className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-[11px]"
        />
    );
}

// ── Chip filter ─────────────────────────────────────────────────────────────

/** Active chip filter for the Layers tree. */
type ChipFilter = 'all' | 'text' | 'image' | 'video' | 'overlays';

/** Whether a single node satisfies the chip filter. */
function nodeMatchesChip(node: LayerNode, filter: ChipFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'overlays') return !!node.attrs['data-vx-overlay-id'];
    if (filter === 'text') return node.kind === 'text';
    if (filter === 'image') return node.kind === 'image';
    if (filter === 'video') return node.kind === 'video';
    return true;
}

/**
 * Recursively prune the tree to nodes that either match the chip filter or
 * have at least one matching descendant. Preserves the hierarchy so a Text
 * inside two Containers still shows both containers as expandable ancestors
 * — the chip narrows the view, it doesn't flatten it.
 */
function filterTreeByChip(nodes: LayerNode[], filter: ChipFilter): LayerNode[] {
    if (filter === 'all') return nodes;
    const out: LayerNode[] = [];
    for (const n of nodes) {
        const children = filterTreeByChip(n.children, filter);
        if (nodeMatchesChip(n, filter) || children.length > 0) {
            out.push({ ...n, children });
        }
    }
    return out;
}

/**
 * Compute a short content preview for a layer-tree row so the user can tell
 * which "Text" or "Image" node is which.
 *
 * Text     → first few words of the visible text
 * Image    → alt attribute, or basename of src
 * Video    → basename of src
 * Group/SVG/other → no preview; the label alone is enough
 *
 * Returns `null` when no useful preview is available, so the renderer can
 * skip the muted-snippet span entirely.
 */
function nodePreview(node: LayerNode): { short: string; full: string } | null {
    const PREVIEW_MAX = 32;
    const truncate = (s: string) =>
        s.length > PREVIEW_MAX ? s.slice(0, PREVIEW_MAX - 1).trimEnd() + '…' : s;

    if (node.kind === 'text') {
        const text = (node.textContent ?? '').trim().replace(/\s+/g, ' ');
        if (!text) return null;
        return { short: `"${truncate(text)}"`, full: text };
    }

    if (node.kind === 'image' || node.kind === 'video') {
        const alt = node.attrs.alt?.trim();
        const src = node.attrs.src ?? '';
        const basename = src.split(/[?#]/)[0]?.split('/').pop() ?? '';
        const label = alt || basename;
        if (!label) return null;
        return { short: truncate(label), full: alt ? `${alt} (${src})` : src };
    }

    return null;
}
