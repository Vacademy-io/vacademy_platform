import { useVideoEditorStore } from './stores/video-editor-store';
import { getEntryColor } from './utils/track-layout';
import { Eye } from 'lucide-react';

/**
 * Left panel: lists all entries in the timeline.
 * Clicking an entry seeks to its start time and selects it.
 */
export function EntryListPanel() {
    const { entries, meta, currentTime, selectedEntryId, selectEntry, seek } =
        useVideoEditorStore();

    const navigationMode = meta.navigation;

    const handleEntryClick = (entryId: string, index: number) => {
        if (navigationMode === 'time_driven') {
            const entry = entries.find((e) => e.id === entryId);
            if (entry) {
                const t = entry.inTime ?? entry.start ?? 0;
                seek(t);
            }
        } else {
            seek(index);
        }
        selectEntry(entryId);
    };

    const isActiveAtCurrentTime = (entry: (typeof entries)[number], index: number) => {
        if (navigationMode === 'time_driven') {
            const start = entry.inTime ?? entry.start ?? 0;
            const end = entry.exitTime ?? entry.end ?? Infinity;
            return currentTime >= start && currentTime < end;
        }
        return index === Math.floor(currentTime);
    };

    const formatTime = (s?: number) => {
        if (s === undefined) return '—';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const shortLabel = (id: string) => {
        if (id.startsWith('branding-')) return id.replace('branding-', '');
        if (id.startsWith('segment-')) return `seg ${id.replace('segment-', '')}`;
        if (id.startsWith('user-overlay-')) return `overlay`;
        return id.length > 14 ? id.slice(0, 12) + '…' : id;
    };

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
                    entries.map((entry, i) => {
                        const active = isActiveAtCurrentTime(entry, i);
                        const selected = selectedEntryId === entry.id;
                        const color = getEntryColor(entry.id, entry.z);

                        return (
                            <button
                                key={entry.id}
                                className={[
                                    'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors',
                                    selected
                                        ? 'bg-indigo-50 text-indigo-800'
                                        : active
                                          ? 'bg-gray-100 text-gray-800'
                                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                                ].join(' ')}
                                onClick={() => handleEntryClick(entry.id, i)}
                            >
                                {/* Color dot */}
                                <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ background: color }}
                                />

                                {/* Label */}
                                <span className="flex-1 truncate font-mono text-xs">
                                    {shortLabel(entry.id)}
                                </span>

                                {/* Active indicator */}
                                {active && <Eye className="size-3 shrink-0 text-indigo-500" />}

                                {/* Timing badge */}
                                {navigationMode === 'time_driven' ? (
                                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                                        {formatTime(entry.inTime ?? entry.start)}
                                    </span>
                                ) : (
                                    <span className="shrink-0 text-[10px] text-gray-400">
                                        #{i + 1}
                                    </span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
