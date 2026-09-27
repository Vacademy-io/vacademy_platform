import { useState } from 'react';
import { CaretDown, Check, PlusCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChipsWrapper } from '@/components/design-system/chips';
import { useCompactMode } from '@/hooks/use-compact-mode';
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
    /**
     * Secondary line under the label — an email, a role. Also folded into the
     * text the search box matches, so two people with the same name stay
     * tellable apart.
     */
    sublabel?: string;
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
    /**
     * Summarize the selection ON the trigger instead of appending "· <count>" to
     * {@link label}: the chosen option's own label when exactly one is picked,
     * "<n> selected" beyond that.
     *
     * Opt-in, for filter bars that already caption the control with a field
     * `<Label>` above it (e.g. the Call Log's). There "All · 1" reads as noise where
     * "Callback" reads as the value; the default "<label> · <count>" stays right for
     * the self-captioning toolbar pill Recent Leads uses.
     */
    showSelectedLabel?: boolean;
    /**
     * Trigger look. 'button' (default) matches the leads filter bars' outline
     * chips. 'pill' matches Manage Students' rounded FilterChips pill (see
     * design-system/chips.tsx) so this combobox blends in next to that page's
     * other filter chips — the same split CustomFieldMultiSelectFilter makes.
     * Styling only; behaviour is identical.
     */
    variant?: 'button' | 'pill';
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
    showSelectedLabel = false,
    variant = 'button',
}: MultiSelectFilterProps) {
    const [open, setOpen] = useState(false);
    const { isCompact } = useCompactMode();

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
    const soleSelectedLabel =
        count === 1 ? options.find((o) => o.value === selected[0])?.label : undefined;
    const triggerLabel = showSelectedLabel
        ? count === 0
            ? label
            : soleSelectedLabel ?? `${count} selected`
        : count > 0
          ? `${label} · ${count}`
          : label;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {variant === 'pill' ? (
                    <button
                        type="button"
                        role="combobox"
                        aria-expanded={open}
                        aria-label={`Filter by ${label.toLowerCase()}`}
                    >
                        <ChipsWrapper
                            className={cn(
                                count > 0
                                    ? 'border-primary-500 bg-primary-100'
                                    : 'hover:border-primary-500 hover:bg-primary-50'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                {icon ?? (
                                    <PlusCircle
                                        className={cn(
                                            isCompact ? 'size-3.5' : 'size-4',
                                            'text-neutral-600'
                                        )}
                                    />
                                )}
                                <div
                                    className={cn(
                                        'flex items-center',
                                        isCompact ? 'text-xs' : 'text-body',
                                        'text-neutral-600'
                                    )}
                                >
                                    {label}
                                </div>
                                {count > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Separator
                                            orientation="vertical"
                                            className="mx-2 h-4 bg-neutral-500"
                                        />
                                        <div className="inline-flex items-center rounded-md bg-primary-200 px-2.5 py-0.5 text-caption font-normal">
                                            {count} selected
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ChipsWrapper>
                    </button>
                ) : (
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
                )}
            </PopoverTrigger>
            {/* Only the two-line (sublabel) variant needs the extra width; every
                existing call site keeps the width it had. */}
            <PopoverContent
                align="start"
                className={cn('p-0', options.some((opt) => opt.sublabel) ? 'w-64' : 'w-56')}
            >
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
                                    value={
                                        opt.sublabel ? `${opt.label} ${opt.sublabel}` : opt.label
                                    }
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
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate">{opt.label}</span>
                                        {opt.sublabel && (
                                            <span className="truncate text-xs text-neutral-500">
                                                {opt.sublabel}
                                            </span>
                                        )}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
