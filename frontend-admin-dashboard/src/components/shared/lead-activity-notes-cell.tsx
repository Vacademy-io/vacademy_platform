import { useState } from 'react';
import { Plus } from 'lucide-react';
import { NotePencil } from '@phosphor-icons/react';
import type { LatestNoteEvent } from '@/hooks/use-latest-notes-batch';

interface LeadActivityNotesCellProps {
    /** Recent events (most-recent first), capped server-side at 5. */
    recent: LatestNoteEvent[];
    /** Total notes count (may exceed `recent.length`). */
    count: number;
    /** Click handler for the Add Note affordance. */
    onAdd: () => void;
}

const formatTimestamp = (iso: string | undefined | null) =>
    iso
        ? new Date(iso).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: '2-digit',
          })
        : '';

const NoteCard = ({ note }: { note: LatestNoteEvent }) => {
    const desc = note.description?.trim();
    return (
        <div className="rounded-md bg-neutral-50 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
                <NotePencil weight="fill" className="size-3 text-neutral-500" />
                <span className="truncate text-xs font-medium text-neutral-800">{note.title}</span>
            </div>
            {desc && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-600">{desc}</p>
            )}
            <p className="mt-0.5 text-[10px] text-neutral-400">
                {formatTimestamp(note.created_at)}
                {note.actor_name ? ` · by ${note.actor_name}` : ''}
            </p>
        </div>
    );
};

/**
 * Activity & Notes cell shared between the Lead List and Recent Leads tables.
 *
 * Default state: shows only the latest entry plus a "Show more" link when the
 * user has more than one note. Click expands to a scrollable stack of all
 * recent entries (already capped to 5 by the backend) with a "Show less"
 * toggle. The Add Note button is always visible — bordered so it stands out
 * regardless of whether notes exist.
 */
export const LeadActivityNotesCell = ({ recent, count, onAdd }: LeadActivityNotesCellProps) => {
    const [expanded, setExpanded] = useState(false);

    if (recent.length === 0) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                }}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-primary-300 hover:text-primary-600"
            >
                <Plus className="size-3.5" />
                Add Note
            </button>
        );
    }

    const visible = expanded ? recent : recent.slice(0, 1);
    // "+ N more" only counts towards entries the user hasn't seen *yet*; once
    // expanded, the chip reflects pure overflow (count beyond the 5 the
    // backend returned).
    const overflow = expanded
        ? Math.max(0, count - recent.length)
        : Math.max(0, count - 1);

    return (
        <div className="flex items-start justify-between gap-2">
            <div
                className={`min-w-0 flex-1 space-y-1.5 ${
                    expanded ? 'max-h-44 overflow-y-auto pr-1' : ''
                }`}
            >
                {visible.map((n) => (
                    <NoteCard key={n.id} note={n} />
                ))}
                {recent.length > 1 && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((v) => !v);
                        }}
                        className="text-[10px] font-medium text-primary-600 hover:underline"
                    >
                        {expanded
                            ? 'Show less'
                            : `Show more${overflow > 0 ? ` (+${overflow})` : ''}`}
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                }}
                title="Add note"
                aria-label="Add note"
                className="shrink-0 rounded-md border border-neutral-300 p-1 text-neutral-500 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
            >
                <Plus className="size-3.5" />
            </button>
        </div>
    );
};
