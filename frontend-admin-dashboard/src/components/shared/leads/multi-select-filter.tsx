import { useState } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
    value: string;
    label: string;
    /** When true, selecting this clears all other selections (acts like "All"). */
    clearAll?: boolean;
}

interface MultiSelectFilterProps {
    /** Display label shown on the trigger when nothing is selected. */
    label: string;
    /** Optional icon rendered before the label on the trigger button. */
    icon?: React.ReactNode;
    options: MultiSelectOption[];
    /** Currently selected values. An empty array means "all" (no filter). */
    selected: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    /** Width class for the trigger button (default: w-44). */
    widthClass?: string;
}

/**
 * Generic multi-select combobox for static option lists (tier, SLA, etc.).
 * Stays open while the user checks items, shows a count badge on the trigger.
 * Selecting a clearAll option resets all others.
 */
export function MultiSelectFilter({
    label,
    icon,
    options,
    selected,
    onChange,
    placeholder = 'Search…',
    widthClass = 'w-44',
}: MultiSelectFilterProps) {
    const [open, setOpen] = useState(false);

    const toggle = (value: string, clearAll: boolean | undefined) => {
        if (clearAll) {
            // "All" option — clear every selection
            onChange([]);
            return;
        }
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const count = selected.length;
    const triggerLabel = count > 0 ? `${label} · ${count}` : label;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={`Filter by ${label.toLowerCase()}`}
                    className={cn(
                        'h-10 justify-between',
                        widthClass,
                        count > 0 && 'border-primary-300 bg-primary-50'
                    )}
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        {icon}
                        <span className="truncate text-sm font-normal">{triggerLabel}</span>
                    </span>
                    <CaretDown className="size-4 shrink-0 text-neutral-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-0">
                <Command>
                    <CommandInput placeholder={placeholder} className="h-9" />
                    <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>No options found.</CommandEmpty>
                        {count > 0 && (
                            <CommandItem
                                value="__clear__"
                                onSelect={() => onChange([])}
                                className="cursor-pointer text-neutral-500"
                            >
                                Clear selection
                            </CommandItem>
                        )}
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.label}
                                    onSelect={() => toggle(opt.value, opt.clearAll)}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 size-4 shrink-0',
                                            opt.clearAll
                                                ? count === 0
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                : selected.includes(opt.value)
                                                  ? 'opacity-100'
                                                  : 'opacity-0'
                                        )}
                                    />
                                    <span className="truncate">{opt.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
