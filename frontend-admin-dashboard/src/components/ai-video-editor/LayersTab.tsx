import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Type as TypeIcon,
    Image as ImageIcon,
    Video as VideoIcon,
    Box,
    LayoutGrid,
    Trash2,
    Copy,
    ArrowUp,
    ArrowDown,
    Shapes,
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
    LayerKind,
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

const KIND_ICON: Record<LayerKind, React.ComponentType<{ className?: string }>> = {
    text: TypeIcon,
    image: ImageIcon,
    video: VideoIcon,
    svg: Shapes,
    group: LayoutGrid,
    other: Box,
};

interface LayersTabProps {
    entryId: string;
    entryHtml: string;
}

export function LayersTab({ entryId, entryHtml }: LayersTabProps) {
    const updateEntryHtml = useVideoEditorStore((s) => s.updateEntryHtml);
    const selectedPath = useVideoEditorStore((s) => s.selectedLayerPath);
    const selectLayer = useVideoEditorStore((s) => s.selectLayer);

    const tree = useMemo(() => buildLayerTree(entryHtml), [entryHtml]);

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
                ) : (
                    tree.map((node) => (
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

            {/* Inspector */}
            {selectedNode ? (
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
    const Icon = KIND_ICON[node.kind];
    const isSelected = pathsEqual(node.path, selectedPath);
    const isCollapsed = collapsed[node.id] ?? false;
    const hasChildren = node.children.length > 0;

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

                <span className="flex-1 truncate">{node.label}</span>

                <span className="hidden shrink-0 font-mono text-[9px] text-gray-400 group-hover:inline">
                    {node.tag}
                </span>

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
                    {node.children.map((child) => (
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
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
                <span>Layer:</span>
                <span className="font-mono text-indigo-600">{node.tag}</span>
                <span className="text-gray-400">· {node.kind}</span>
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

            {/* Geometry */}
            <div className="grid grid-cols-2 gap-2">
                <Field label="Left">
                    <StyleInput
                        value={node.style.left ?? ''}
                        onCommit={(v) => setStyle({ left: v || null })}
                        placeholder="40%"
                    />
                </Field>
                <Field label="Top">
                    <StyleInput
                        value={node.style.top ?? ''}
                        onCommit={(v) => setStyle({ top: v || null })}
                        placeholder="40%"
                    />
                </Field>
                <Field label="Width">
                    <StyleInput
                        value={node.style.width ?? ''}
                        onCommit={(v) => setStyle({ width: v || null })}
                        placeholder="auto"
                    />
                </Field>
                <Field label="Height">
                    <StyleInput
                        value={node.style.height ?? ''}
                        onCommit={(v) => setStyle({ height: v || null })}
                        placeholder="auto"
                    />
                </Field>
            </div>

            <Field label="Transform">
                <StyleInput
                    value={node.style.transform ?? ''}
                    onCommit={(v) => setStyle({ transform: v || null })}
                    placeholder="translate(-50%,-50%) rotate(0deg)"
                />
            </Field>

            <div className="grid grid-cols-2 gap-2">
                <Field label="Opacity">
                    <StyleInput
                        value={node.style.opacity ?? ''}
                        onCommit={(v) => setStyle({ opacity: v || null })}
                        placeholder="1"
                    />
                </Field>
                <Field label="z-index">
                    <StyleInput
                        value={node.style['z-index'] ?? ''}
                        onCommit={(v) => setStyle({ 'z-index': v || null })}
                        placeholder="1"
                    />
                </Field>
            </div>

            {(node.kind === 'text' || node.kind === 'group' || node.kind === 'other') && (
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Color">
                        <StyleInput
                            value={node.style.color ?? ''}
                            onCommit={(v) => setStyle({ color: v || null })}
                            placeholder="#fff"
                        />
                    </Field>
                    <Field label="Font size">
                        <StyleInput
                            value={node.style['font-size'] ?? ''}
                            onCommit={(v) => setStyle({ 'font-size': v || null })}
                            placeholder="32px"
                        />
                    </Field>
                </div>
            )}

            {/* CSS class — handy escape hatch */}
            <Field label="Class">
                <ControlledTextInput
                    value={node.attrs.class ?? ''}
                    onCommit={(v) => setAttr('class', v || null)}
                />
            </Field>
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
