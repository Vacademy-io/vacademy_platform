/**
 * PageCanvas — the canvas's "Structure" view: an honest outline of the page.
 *
 * One row per block (its name, the first heading a visitor reads, what it is
 * made of, and a Hidden badge), between the site header and footer. The look
 * of the page lives in the Website view (LiveSiteFrame, the real site); this
 * view is for order and picking a block.
 *
 * - Click a row to edit that block.
 * - Drag a row by its handle (or focus the handle and press ↑ / ↓) to move it.
 *   Native drag events, so it never mixes with the library's dnd-kit drags.
 * - Drag a block from the library onto the outline to add it at the end, or
 *   onto a column of a column layout to add it there (same drop ids as before).
 */
import {
    useEffect,
    useRef,
    useState,
    type DragEvent,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DotsSixVertical, EyeSlash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../-stores/editor-store';
import { useLocalizedView } from '../-hooks/use-localized-editing';
import type { Component } from '../-types/editor-types';
import { componentLabel } from '../-utils/component-labels';
import { firstHeading, moveItem } from '../-utils/block-summary';
import { describeCatalogFeatures } from './ComponentPreviews';

interface PageCanvasProps {
    /** The canvas's own 'canvas-drop-zone' droppable — owned by CanvasRenderer. */
    dropRef: (node: HTMLElement | null) => void;
    isDropOver: boolean;
}

/** Column layouts show their columns side by side, up to four across. */
const COLUMN_GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
};

const HiddenBadge = () => {
    const { t } = useTranslation('managePagesPageCanvas');
    return (
        <span
            className="flex shrink-0 items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-neutral-600"
            title={t('structure.hiddenTitle')}
        >
            <EyeSlash className="size-3" />
            {t('structure.hidden')}
        </span>
    );
};

/** Name, first heading and summary of one block — the body of every row. */
const BlockText = ({ component, summary }: { component: Component; summary?: string }) => {
    const { t } = useTranslation('managePagesPageCanvas');
    const heading = firstHeading(component);
    return (
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-neutral-800">
                    {componentLabel(component.type)}
                </span>
                {component.enabled === false && <HiddenBadge />}
            </div>
            <div
                className={`truncate text-xs ${heading ? 'text-neutral-600' : 'italic text-neutral-400'}`}
            >
                {heading || t('structure.noHeading')}
            </div>
            {summary && <div className="truncate text-caption text-neutral-500">{summary}</div>}
        </div>
    );
};

/** A column of a column layout: its blocks, and a drop target for new ones. */
const ColumnSlot = ({
    layoutId,
    index,
    blocks,
}: {
    layoutId: string;
    index: number;
    blocks: Component[];
}) => {
    const { t } = useTranslation('managePagesPageCanvas');
    const { selectedComponentId, selectComponent } = useEditorStore();
    // '::' separates the ids — component ids only contain [a-z0-9-].
    const { setNodeRef, isOver } = useDroppable({ id: `slot::${layoutId}::${index}` });
    return (
        <div
            ref={setNodeRef}
            className={`rounded-md border border-dashed p-2 ${
                isOver ? 'border-primary-400 bg-primary-50' : 'border-neutral-200'
            }`}
        >
            <div className="mb-1 text-caption font-semibold uppercase text-neutral-500">
                {t('structure.column', { index: index + 1 })}
            </div>
            {blocks.length === 0 && (
                <div className="text-caption text-neutral-400">{t('structure.emptyColumn')}</div>
            )}
            <div className="flex flex-col gap-1">
                {blocks.map((child) => (
                    <button
                        key={child.id}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            selectComponent(child.id);
                        }}
                        className={`flex w-full rounded border bg-white px-2 py-1 text-start ${
                            child.id === selectedComponentId
                                ? 'border-primary-500 ring-1 ring-primary-200'
                                : 'border-neutral-200 hover:border-primary-300'
                        }`}
                    >
                        <BlockText component={child} />
                    </button>
                ))}
            </div>
        </div>
    );
};

/** Site header / footer: shared by every page, so it has no drag handle. */
const ChromeRow = ({
    section,
    component,
}: {
    section: 'header' | 'footer';
    component: Component;
}) => {
    const { t } = useTranslation('managePagesPageCanvas');
    const { selectedGlobalLayout, selectGlobalLayout } = useEditorStore();
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                selectGlobalLayout(section);
            }}
            className={`flex w-full items-center gap-3 rounded-lg border border-dashed bg-white px-3 py-2 text-start ${
                selectedGlobalLayout === section
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-neutral-300 hover:border-primary-300'
            }`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-800">
                        {t(section === 'header' ? 'structure.header' : 'structure.footer')}
                    </span>
                    <span className="text-caption text-neutral-500">
                        {t('structure.everyPage')}
                    </span>
                    {component.enabled === false && <HiddenBadge />}
                </div>
                <div className="truncate text-xs text-neutral-600">{firstHeading(component)}</div>
            </div>
        </button>
    );
};

export const PageCanvas = ({ dropRef, isDropOver }: PageCanvasProps) => {
    const { t } = useTranslation('managePagesPageCanvas');
    const { t: tPreviews } = useTranslation('managePagesComponentPreviews');
    const {
        config: storeConfig,
        editingLocale,
        selectedPageId,
        selectedComponentId,
        selectComponent,
        reorderComponents,
    } = useEditorStore();
    // Headings read in the language being edited; order is shared by all
    // languages, so moves are applied to the stored (base) blocks.
    const config = useLocalizedView(storeConfig, editingLocale);
    const page = config?.pages.find((p) => p.id === selectedPageId);
    const layout = config?.globalSettings?.layout;

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);
    const rowRefs = useRef(new Map<string, HTMLElement>());

    // Keep the selected block in view when it is picked elsewhere (Layers).
    useEffect(() => {
        if (selectedComponentId) {
            rowRefs.current.get(selectedComponentId)?.scrollIntoView?.({ block: 'nearest' });
        }
    }, [selectedComponentId]);

    const moveBlock = (blockId: string, to: number) => {
        const blocks = storeConfig?.pages.find((p) => p.id === selectedPageId)?.components ?? [];
        const next = moveItem(
            blocks,
            blocks.findIndex((b) => b.id === blockId),
            to
        );
        if (next && selectedPageId) reorderComponents(selectedPageId, next);
    };

    const endDrag = () => {
        setDraggingId(null);
        setOverIndex(null);
    };

    // Every row is a drop target; only the handle starts a drag, so dragging a
    // block inside a column never drags its whole column layout.
    const rowDropProps = (index: number) => ({
        onDragOver: (e: DragEvent) => {
            if (!draggingId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOverIndex(index);
        },
        onDrop: (e: DragEvent) => {
            if (!draggingId) return;
            e.preventDefault();
            moveBlock(draggingId, index);
            endDrag();
        },
    });

    const handleDragProps = (blockId: string) => ({
        draggable: true,
        onDragStart: (e: DragEvent) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', blockId);
            // Show the whole row under the pointer, not just the handle.
            const row = rowRefs.current.get(blockId);
            if (row) e.dataTransfer.setDragImage?.(row, 16, 16);
            setDraggingId(blockId);
        },
        onDragEnd: endDrag,
    });

    const onHandleKey = (e: KeyboardEvent, index: number, blockId: string) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        // The handle keeps focus: React refocuses it after moving its row.
        moveBlock(blockId, e.key === 'ArrowUp' ? index - 1 : index + 1);
    };

    let body: ReactNode;
    if (!config || !page) {
        body = (
            <p className="py-16 text-center text-sm text-neutral-500">{t('structure.noPage')}</p>
        );
    } else if (page.components.length === 0) {
        body = (
            <p className="rounded-lg border-2 border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500">
                {t('structure.empty')}
            </p>
        );
    } else {
        const draggingIndex = page.components.findIndex((b) => b.id === draggingId);
        body = (
            <ol
                className="flex flex-col gap-2"
                aria-label={t('structure.blockCount', { count: page.components.length })}
            >
                {page.components.map((block, index) => {
                    const isSelected = block.id === selectedComponentId;
                    const slots =
                        block.type === 'columnLayout' && Array.isArray(block.props?.slots)
                            ? (block.props.slots as Component[][])
                            : null;
                    const summary = slots
                        ? t('structure.columns', { count: slots.length })
                        : block.type === 'courseCatalog'
                          ? describeCatalogFeatures(block.props, tPreviews)
                          : '';
                    // Where the dragged row will land: a line on that side.
                    const dropLine =
                        overIndex === index && draggingIndex !== -1 && draggingIndex !== index
                            ? draggingIndex > index
                                ? 'border-t-primary-500'
                                : 'border-b-primary-500'
                            : '';
                    return (
                        <li
                            key={block.id}
                            ref={(node) => {
                                if (node) rowRefs.current.set(block.id, node);
                                else rowRefs.current.delete(block.id);
                            }}
                            data-block-id={block.id}
                            {...rowDropProps(index)}
                            onClick={(e) => {
                                e.stopPropagation();
                                selectComponent(block.id);
                            }}
                            className={`cursor-pointer rounded-lg border-2 bg-white p-2 transition-colors ${
                                isSelected
                                    ? 'border-primary-500'
                                    : 'border-neutral-200 hover:border-primary-300'
                            } ${dropLine} ${draggingId === block.id ? 'opacity-50' : ''}`}
                        >
                            <div className="flex items-center gap-2">
                                {/* A span, not a <button>: Firefox will not start a
                                    drag from a button. */}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    {...handleDragProps(block.id)}
                                    className="flex shrink-0 cursor-grab items-center rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
                                    aria-label={t('structure.dragHandle', {
                                        name: componentLabel(block.type),
                                    })}
                                    title={t('structure.dragHandle', {
                                        name: componentLabel(block.type),
                                    })}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => onHandleKey(e, index, block.id)}
                                >
                                    <DotsSixVertical className="size-4" weight="bold" />
                                </span>
                                <span className="w-5 shrink-0 text-center text-caption text-neutral-400">
                                    {index + 1}
                                </span>
                                {/* A real button, so the keyboard can open the block too. */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectComponent(block.id);
                                    }}
                                    className="flex min-w-0 flex-1 rounded text-start"
                                >
                                    <BlockText component={block} summary={summary} />
                                </button>
                            </div>
                            {slots && (
                                <div
                                    className={`mt-2 grid gap-2 ps-14 ${COLUMN_GRID[Math.min(slots.length, 4)] ?? ''}`}
                                >
                                    {slots.map((slotBlocks, slotIndex) => (
                                        <ColumnSlot
                                            key={slotIndex}
                                            layoutId={block.id}
                                            index={slotIndex}
                                            blocks={Array.isArray(slotBlocks) ? slotBlocks : []}
                                        />
                                    ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>
        );
    }

    return (
        <div
            ref={dropRef}
            className={`flex flex-1 justify-center overflow-auto p-6 transition-colors ${isDropOver ? 'bg-primary-50' : ''}`}
            onClick={() => selectComponent(null)}
        >
            <div className="flex w-full max-w-3xl flex-col gap-2">
                <p className="text-xs text-neutral-500">{t('structure.intro')}</p>
                {layout?.header && (
                    <ChromeRow section="header" component={layout.header as Component} />
                )}
                {body}
                {isDropOver && (
                    <div className="rounded-lg border-2 border-dashed border-primary-400 p-3 text-center text-xs text-primary-600">
                        {t('structure.dropHere')}
                    </div>
                )}
                {layout?.footer && (
                    <ChromeRow section="footer" component={layout.footer as Component} />
                )}
            </div>
        </div>
    );
};
