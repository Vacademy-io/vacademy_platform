import { useMemo, useState } from 'react';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectPopoverProps {
    label: string;
    options: MultiSelectOption[];
    /** Selected values; empty means "All". */
    selected: string[];
    onChange: (next: string[]) => void;
    searchable?: boolean;
    emptyText?: string;
}

/**
 * Compact "All / multi-select" filter dropdown used by the feedback page for
 * batch and subject filters. An empty selection means "All".
 */
export function MultiSelectPopover({
    label,
    options,
    selected,
    onChange,
    searchable = true,
    emptyText = 'No options',
}: MultiSelectPopoverProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    }, [options, search]);

    const toggle = (value: string) => {
        onChange(
            selected.includes(value)
                ? selected.filter((v) => v !== value)
                : [...selected, value]
        );
    };

    const triggerText =
        selected.length === 0
            ? `All ${label.toLowerCase()}`
            : selected.length === 1
              ? options.find((o) => o.value === selected[0])?.label || `1 selected`
              : `${selected.length} selected`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex h-9 min-w-48 items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary-500',
                        selected.length > 0
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    )}
                >
                    <span className="truncate">
                        <span className="text-neutral-500">{label}:</span> {triggerText}
                    </span>
                    <CaretDown size={14} className="shrink-0 text-neutral-500" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                {searchable && (
                    <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
                        <MagnifyingGlass size={14} className="text-neutral-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={`Search ${label.toLowerCase()}…`}
                            className="h-6 w-full border-none bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                        />
                    </div>
                )}
                <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
                    <span className="text-xs font-medium text-neutral-500">
                        {selected.length === 0 ? 'All selected' : `${selected.length} selected`}
                    </span>
                    {selected.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="text-xs font-medium text-primary-600 hover:underline"
                        >
                            Clear
                        </button>
                    )}
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-6 text-center text-xs text-neutral-400">
                            {emptyText}
                        </div>
                    ) : (
                        filtered.map((opt) => {
                            const checked = selected.includes(opt.value);
                            return (
                                <label
                                    key={opt.value}
                                    className="flex cursor-pointer items-start gap-2 px-3 py-1.5 hover:bg-neutral-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(opt.value)}
                                        className="mt-0.5 size-3.5 shrink-0 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                                    />
                                    <span
                                        className={cn(
                                            'text-xs leading-snug',
                                            checked
                                                ? 'font-medium text-primary-700'
                                                : 'text-neutral-700'
                                        )}
                                    >
                                        {opt.label}
                                    </span>
                                </label>
                            );
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
