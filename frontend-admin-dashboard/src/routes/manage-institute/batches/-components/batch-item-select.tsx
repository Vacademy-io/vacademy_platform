/**
 * The picker every step of Create Batch uses.
 *
 * Three things the plain dropdown it replaces did not do:
 *
 *   - search. An institute with fifty courses made the course step a scroll.
 *   - say why it is empty. A disabled dropdown with no explanation is the whole
 *     reason "create a batch" felt broken: the session step's list is empty for
 *     a course that has no sessions yet, and nothing on screen said so.
 *   - stay inside the dialog. SearchableSelect portals its list by default, and
 *     react-remove-scroll blocks the wheel on a portalled node inside a Dialog.
 */
import { SearchableSelect } from '@/components/design-system/searchable-select';

export interface BatchItem {
    id: string;
    name: string;
}

interface BatchItemSelectProps {
    items: BatchItem[];
    value: BatchItem | null;
    onChange: (item: BatchItem | null) => void;
    placeholder: string;
    searchPlaceholder: string;
    /** Shown in place of the control when there is nothing to pick. */
    emptyMessage: string;
    disabled?: boolean;
}

export function BatchItemSelect({
    items,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    disabled = false,
}: BatchItemSelectProps) {
    if (items.length === 0) {
        return (
            <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5 text-body text-neutral-500">
                {emptyMessage}
            </p>
        );
    }

    return (
        <SearchableSelect
            options={items.map((item) => ({ label: item.name, value: item.id }))}
            value={value?.id ?? ''}
            onChange={(id) => onChange(items.find((item) => item.id === id) ?? null)}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            disabled={disabled}
            // Inside MyDialog — a portalled list cannot be scrolled there.
            portal={false}
        />
    );
}
