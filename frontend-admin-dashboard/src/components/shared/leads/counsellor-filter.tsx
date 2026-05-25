import { useState } from 'react';
import { UserPlus, CaretDown, Check } from '@phosphor-icons/react';
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

interface CounsellorOption {
    id: string;
    full_name: string;
}

interface CounsellorFilterProps {
    /** Currently selected counsellor userId, or the sentinel value meaning "all". */
    value: string;
    onChange: (value: string) => void;
    /** Sentinel value used when no counsellor filter is active. */
    allValue: string;
    /** Counsellor list — usually from `fetchCounselors`. */
    options: CounsellorOption[];
    isLoading?: boolean;
}

/** Searchable + scrollable counsellor combobox used in the leads filter bar.
 *  - Type to filter the list by counsellor name (cmdk handles fuzzy match).
 *  - Internal scrollable region caps at ~10 rows so long lists don't overflow. */
export function CounsellorFilter({
    value,
    onChange,
    allValue,
    options,
    isLoading,
}: CounsellorFilterProps) {
    const [open, setOpen] = useState(false);
    const selectedLabel =
        value === allValue
            ? 'All counsellors'
            : (options.find((c) => c.id === value)?.full_name ?? 'Selected counsellor');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Filter by counsellor"
                    className="h-10 w-48 justify-between"
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        <UserPlus className="size-4 shrink-0 text-neutral-400" />
                        <span className="truncate text-sm font-normal">{selectedLabel}</span>
                    </span>
                    <CaretDown className="size-4 shrink-0 text-neutral-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                <Command>
                    <CommandInput placeholder="Search counsellor…" className="h-9" />
                    <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>
                            {isLoading ? 'Loading counsellors…' : 'No counsellor found.'}
                        </CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="All counsellors"
                                onSelect={() => {
                                    onChange(allValue);
                                    setOpen(false);
                                }}
                                className="cursor-pointer"
                            >
                                <Check
                                    className={cn(
                                        'mr-2 size-4',
                                        value === allValue ? 'opacity-100' : 'opacity-0'
                                    )}
                                />
                                All counsellors
                            </CommandItem>
                            {options.map((c) => (
                                <CommandItem
                                    key={c.id}
                                    value={c.full_name}
                                    onSelect={() => {
                                        onChange(c.id);
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 size-4',
                                            value === c.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {c.full_name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
