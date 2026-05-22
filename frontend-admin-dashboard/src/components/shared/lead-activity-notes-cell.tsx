import { Plus } from 'lucide-react';
import { NotePencil } from '@phosphor-icons/react';
import type { LatestNoteEvent } from '@/hooks/use-latest-notes-batch';
import { parseHtmlToString } from '@/lib/utils';

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
    // Always strip HTML (parseHtmlToString is a no-op on plain text). Guarantees
    // no markup leaks into the table preview, regardless of how the note was created.
    const desc = parseHtmlToString(note.description ?? '').trim();
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
 * Shows ONLY the most-recent entry — never expands. A small "+N more" hint sits
 * under the card when the lead has additional notes (open the side view to see
 * the full timeline). The Add Note button is always visible.
 */
export const LeadActivityNotesCell = ({ recent, count, onAdd }: LeadActivityNotesCellProps) => {
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

    // Safe: the early-return above guarantees recent.length > 0.
    const latest = recent[0]!;

    return (
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
                <NoteCard note={latest} />
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
