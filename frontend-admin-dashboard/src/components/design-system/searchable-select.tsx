'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type SearchableSelectOption = {
    label: string;
    value: string;
};

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
    triggerClassName?: string;
    /**
     * Render the list in a body portal (default). Pass false inside a Dialog or
     * Sheet — react-remove-scroll blocks wheel/touch on portalled nodes, so a
     * portalled list can't be scrolled from within a modal.
     */
    portal?: boolean;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Select option',
    searchPlaceholder = 'Search...',
    emptyText = 'No options found.',
    className,
    disabled = false,
    triggerClassName,
    portal = true,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    // Inline (portal={false}) content is clipped by the dialog's overflow, so
    // measure collisions against the dialog box instead of the viewport.
    const [boundary, setBoundary] = React.useState<Element | null>(null);

    React.useEffect(() => {
        if (open && !portal) {
            setBoundary(triggerRef.current?.closest('[role="dialog"]') ?? null);
        }
    }, [open, portal]);

    // Get the label for the selected value
    const selectedLabel = React.useMemo(() => {
        return options.find((option) => option.value === value)?.label || '';
    }, [options, value]);

    const handleSelect = (selectedValue: string) => {
        onChange(selectedValue);
        setOpen(false);
    };

    return (
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    ref={triggerRef}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between font-normal', triggerClassName, className)}
                    onClick={() => setOpen(!open)}
                    disabled={disabled}
                >
                    <span className={cn('truncate', !value && 'text-muted-foreground')}>
                        {value ? selectedLabel : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="flex max-h-[--radix-popover-content-available-height] w-[--radix-popover-trigger-width] flex-col p-0" // design-lint-ignore: Radix runtime CSS vars
                align="start"
                portal={portal}
                collisionBoundary={boundary ?? undefined}
                collisionPadding={8}
            >
                <Command className="min-h-0">
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList className="min-h-0">
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => handleSelect(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === option.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
