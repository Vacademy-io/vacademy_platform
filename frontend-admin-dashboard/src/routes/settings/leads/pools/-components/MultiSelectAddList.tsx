/**
 * Reusable "pick many, add in one go" control for pool settings.
 *
 * Replaces the single-select dropdown + Add button used when attaching
 * counselors or campaigns to a pool. Shows a searchable, scrollable checklist
 * with a select-all toggle and an "Add Selected (N)" action.
 *
 * The backend has no bulk-add endpoint, so `onAdd` is expected to fan out one
 * request per id. It returns the ids that FAILED — this component then keeps
 * those checked (so the admin can retry) and clears the ones that succeeded.
 */

import { useMemo, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';

export interface MultiSelectItem {
    id: string;
    label: string;
    /** Optional muted suffix, e.g. a status or email. */
    sublabel?: string;
}

interface MultiSelectAddListProps {
    items: MultiSelectItem[];
    loading?: boolean;
    /** Fan out the adds; resolve with the ids that failed (empty = all ok). */
    onAdd: (ids: string[]) => Promise<string[]>;
    searchPlaceholder?: string;
    emptyText?: string;
    /** Singular noun for the button, e.g. "counselor" → "Add 2 counselors". */
    itemNoun?: string;
}

export default function MultiSelectAddList({
    items,
    loading = false,
    onAdd,
    searchPlaceholder = 'Search…',
    emptyText = 'Nothing to add.',
    itemNoun = 'item',
}: MultiSelectAddListProps) {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(
            (it) =>
                it.label.toLowerCase().includes(q) ||
                (it.sublabel?.toLowerCase().includes(q) ?? false)
        );
    }, [items, search]);

    // Selection can only ever include ids that still exist in `items` (an add
    // removes succeeded ids from the parent's available list).
    const selectedCount = useMemo(
        () => items.reduce((n, it) => (selected.has(it.id) ? n + 1 : n), 0),
        [items, selected]
    );

    const allFilteredSelected =
        filtered.length > 0 && filtered.every((it) => selected.has(it.id));

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllFiltered = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                for (const it of filtered) next.delete(it.id);
            } else {
                for (const it of filtered) next.add(it.id);
            }
            return next;
        });
    };

    const handleAdd = async () => {
        const ids = items.filter((it) => selected.has(it.id)).map((it) => it.id);
        if (ids.length === 0) return;
        setSubmitting(true);
        try {
            const failed = await onAdd(ids);
            // Keep failed ids checked for retry; clear the rest.
            setSelected(new Set(failed));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="relative">
                <MagnifyingGlass
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="pl-9"
                />
            </div>

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    className="text-caption font-medium text-primary-500 hover:underline disabled:opacity-50"
                    onClick={toggleAllFiltered}
                    disabled={filtered.length === 0 || submitting}
                >
                    {allFilteredSelected ? 'Clear all' : 'Select all'}
                </button>
                <span className="text-caption text-neutral-400">{selectedCount} selected</span>
            </div>

            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
                {loading ? (
                    <p className="px-3 py-6 text-center text-body text-neutral-400">Loading…</p>
                ) : filtered.length === 0 ? (
                    <p className="px-3 py-6 text-center text-body text-neutral-400">
                        {items.length === 0 ? emptyText : 'No matches.'}
                    </p>
                ) : (
                    filtered.map((it) => (
                        <label
                            key={it.id}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-neutral-50"
                        >
                            <Checkbox
                                checked={selected.has(it.id)}
                                onCheckedChange={() => toggle(it.id)}
                            />
                            <span className="flex-1 truncate text-body text-neutral-700">
                                {it.label}
                                {it.sublabel && (
                                    <span className="ml-2 text-caption text-neutral-400">
                                        {it.sublabel}
                                    </span>
                                )}
                            </span>
                        </label>
                    ))
                )}
            </div>

            <MyButton
                buttonType="primary"
                scale="small"
                onClick={handleAdd}
                disable={selectedCount === 0 || submitting}
            >
                {submitting
                    ? 'Adding…'
                    : selectedCount === 0
                      ? `Add ${itemNoun}s`
                      : `Add ${selectedCount} ${itemNoun}${selectedCount === 1 ? '' : 's'}`}
            </MyButton>
        </div>
    );
}
