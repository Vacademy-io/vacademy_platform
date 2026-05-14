import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './stores/video-editor-store';
import { getEntryColor } from './utils/track-layout';
import { Eye, SkipForward, GripVertical, Lock, Pencil } from 'lucide-react';
import type { Entry, NavigationType } from '@/components/ai-video-player/types';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { friendlyEntryName } from './registry/friendly-labels';

/**
 * Left panel: lists all entries in the timeline.
 * Single-click selects without moving the playhead — so the canvas keeps showing
 * what's actually on screen at currentTime. Double-click (or the pencil icon)
 * opens an inline rename. The grip icon drags the entry to a new position;
 * releasing fires `reorderEntries` which queues a `/frame/reorder` op
 * committed on save. Branding entries are locked at their positions
 * (intro/outro must stay at the ends) but can still be renamed.
 *
 * Each row subscribes to its own `isActive` boolean — Zustand bails out of a
 * re-render when the selected slice's reference is unchanged, so playhead
 * ticks only re-render the (typically one) row whose active state flipped.
 */
export function EntryListPanel() {
    const {
        entries,
        meta,
        selectedEntryId,
        selectEntry,
        seek,
        reorderEntries,
        displayNames,
        setEntryDisplayName,
    } = useVideoEditorStore(
        useShallow((s) => ({
            entries: s.entries,
            meta: s.meta,
            selectedEntryId: s.selectedEntryId,
            selectEntry: s.selectEntry,
            seek: s.seek,
            reorderEntries: s.reorderEntries,
            displayNames: s.displayNames,
            setEntryDisplayName: s.setEntryDisplayName,
        }))
    );

    const navigationMode = meta.navigation;

    // 8 px distance threshold means the grip can be hovered/clicked without
    // committing to a drag, so the row's onClick still fires on a tap.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const seekToEntry = (entry: Entry, index: number) => {
        if (navigationMode === 'time_driven') {
            seek(entry.inTime ?? entry.start ?? 0);
        } else {
            seek(index);
        }
    };

    const handleDragEnd = useCallback(
        (e: DragEndEvent) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            const from = entries.findIndex((x) => x.id === active.id);
            const to = entries.findIndex((x) => x.id === over.id);
            if (from < 0 || to < 0) return;
            reorderEntries(from, to);
        },
        [entries, reorderEntries]
    );

    return (
        <div className="flex h-full flex-col border-r border-gray-200 bg-white">
            {/* Header */}
            <div className="shrink-0 border-b border-gray-200 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Entries
                </span>
                <span className="ml-2 text-xs text-gray-400">({entries.length})</span>
            </div>

            {/* Entry list */}
            <div className="flex-1 overflow-y-auto py-1">
                {entries.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                        No entries loaded
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={entries.map((e) => e.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {entries.map((entry, i) => (
                                <EntryRow
                                    key={entry.id}
                                    entry={entry}
                                    index={i}
                                    isSelected={selectedEntryId === entry.id}
                                    navigationMode={navigationMode}
                                    displayName={friendlyEntryName(entry, i, entries, displayNames)}
                                    hasOverride={!!displayNames[entry.id]}
                                    onSelect={() => selectEntry(entry.id)}
                                    onJump={() => {
                                        seekToEntry(entry, i);
                                        selectEntry(entry.id);
                                    }}
                                    onRename={(name) => setEntryDisplayName(entry.id, name)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
}

interface EntryRowProps {
    entry: Entry;
    index: number;
    isSelected: boolean;
    navigationMode: NavigationType | undefined;
    displayName: string;
    hasOverride: boolean;
    onSelect: () => void;
    onJump: () => void;
    onRename: (name: string) => void;
}

const EntryRow = memo(function EntryRow({
    entry,
    index,
    isSelected,
    navigationMode,
    displayName,
    hasOverride,
    onSelect,
    onJump,
    onRename,
}: EntryRowProps) {
    // Per-row subscription: select a boolean, so re-renders only fire when
    // *this* row's active state changes — not on every currentTime tick.
    const isActive = useVideoEditorStore((s) => {
        if (navigationMode === 'time_driven') {
            const start = entry.inTime ?? entry.start ?? 0;
            const end = entry.exitTime ?? entry.end ?? Infinity;
            return s.currentTime >= start && s.currentTime < end;
        }
        return index === Math.floor(s.currentTime);
    });

    const color = getEntryColor(entry.id, entry.z);
    const isLocked = entry.id.startsWith('branding-');

    // Sortable hooks — disabled on branding entries so they can't drift from
    // their fixed positions (intro at top, outro at bottom). Rename still
    // works for branding so the user can call "Intro" → "Welcome" if they
    // want.
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: entry.id,
        disabled: isLocked,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : 1,
    };

    // ── Inline rename state ────────────────────────────────────────────────
    const [renaming, setRenaming] = useState(false);
    const [draft, setDraft] = useState(displayName);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const startRename = () => {
        setDraft(displayName);
        setRenaming(true);
    };
    const commitRename = useCallback(() => {
        const trimmed = draft.trim();
        // Don't write the override if the user typed exactly the auto-derived
        // name — keep the override slot empty so future auto-renumbering
        // (after reorders) still works.
        if (trimmed === displayName || trimmed === '') {
            if (!hasOverride && trimmed === '') {
                // already in the "auto" state — no-op
            } else if (hasOverride && trimmed === '') {
                onRename(''); // clear override
            }
        } else {
            onRename(trimmed);
        }
        setRenaming(false);
    }, [draft, displayName, hasOverride, onRename]);

    useEffect(() => {
        if (renaming) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [renaming]);

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            role="button"
            tabIndex={0}
            style={style}
            className={[
                'group flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors',
                isSelected
                    ? 'bg-indigo-50 text-indigo-800'
                    : isActive
                      ? 'bg-gray-100 text-gray-800'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                isDragging ? 'shadow ring-1 ring-indigo-200' : '',
            ].join(' ')}
            onClick={() => {
                if (renaming) return;
                onSelect();
            }}
            onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startRename();
            }}
            onKeyDown={(e) => {
                if (renaming) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            {/* Drag handle — listeners attach here only, so the rest of the
                row keeps its click/double-click semantics intact. */}
            {isLocked ? (
                <span
                    title="Locked — branding entries can't be reordered"
                    className="flex size-4 shrink-0 items-center justify-center text-gray-300"
                >
                    <Lock className="size-3" />
                </span>
            ) : (
                <span
                    {...listeners}
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                    className="flex size-4 shrink-0 cursor-grab items-center justify-center text-gray-300 opacity-0 hover:text-gray-600 focus:opacity-100 active:cursor-grabbing group-hover:opacity-100"
                >
                    <GripVertical className="size-3" />
                </span>
            )}

            <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />

            {renaming ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.currentTarget.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenaming(false);
                        }
                    }}
                    onBlur={commitRename}
                    maxLength={48}
                    className="flex-1 rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
            ) : (
                <span className="flex-1 truncate text-xs" title={displayName}>
                    {displayName}
                </span>
            )}

            {!renaming && (
                <>
                    <button
                        type="button"
                        title="Rename (double-click the label)"
                        aria-label="Rename entry"
                        className={[
                            'flex size-4 shrink-0 items-center justify-center rounded text-gray-400 transition hover:bg-gray-200 hover:text-gray-700',
                            isSelected
                                ? 'opacity-100'
                                : 'opacity-0 focus:opacity-100 group-hover:opacity-100',
                        ].join(' ')}
                        onClick={(e) => {
                            e.stopPropagation();
                            startRename();
                        }}
                    >
                        <Pencil className="size-3" />
                    </button>

                    {isActive && <Eye className="size-3 shrink-0 text-indigo-500" />}

                    <button
                        type="button"
                        title="Jump playhead to this entry's start"
                        aria-label="Jump playhead to this entry's start"
                        className={[
                            'flex size-4 shrink-0 items-center justify-center rounded text-gray-400 transition hover:bg-gray-200 hover:text-gray-700',
                            isSelected
                                ? 'opacity-100'
                                : 'opacity-0 focus:opacity-100 group-hover:opacity-100',
                        ].join(' ')}
                        onClick={(e) => {
                            e.stopPropagation();
                            onJump();
                        }}
                    >
                        <SkipForward className="size-3" />
                    </button>

                    {navigationMode === 'time_driven' ? (
                        <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                            {formatTime(entry.inTime ?? entry.start)}
                        </span>
                    ) : (
                        <span className="shrink-0 text-[10px] text-gray-400">#{index + 1}</span>
                    )}
                </>
            )}
        </div>
    );
});

function formatTime(s?: number) {
    if (s === undefined) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}
