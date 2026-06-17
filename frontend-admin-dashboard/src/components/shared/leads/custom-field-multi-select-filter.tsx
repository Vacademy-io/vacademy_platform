import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CaretDown, Check, CircleNotch } from '@phosphor-icons/react';
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
import { fetchLeadCustomFieldValues } from '@/routes/audience-manager/list/-services/get-lead-custom-field-values';

const PAGE_SIZE = 20;

interface CustomFieldMultiSelectFilterProps {
    instituteId: string;
    /** custom_field_id (uuid) — matches how lead rows key their values. */
    fieldId: string;
    /** Display label, e.g. "City". */
    fieldName: string;
    /** Currently selected values. */
    selected: string[];
    onChange: (values: string[]) => void;
}

/**
 * Searchable, paginated multi-select for a single custom field, used in the
 * leads filter bar. Distinct values are loaded lazily from the backend only
 * once the dropdown is opened (and re-fetched as the admin types), so a field
 * the admin hasn't interacted with never hits the API. Selecting values OR's
 * them within this field; the leads request AND's across fields.
 */
export function CustomFieldMultiSelectFilter({
    instituteId,
    fieldId,
    fieldName,
    selected,
    onChange,
}: CustomFieldMultiSelectFilterProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce the typed search so each keystroke doesn't fire a request.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    // Reset the search box whenever the dropdown closes so it reopens clean.
    useEffect(() => {
        if (!open) {
            setSearch('');
            setDebouncedSearch('');
        }
    }, [open]);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
        useInfiniteQuery({
            queryKey: ['leadCustomFieldValues', instituteId, fieldId, debouncedSearch],
            queryFn: ({ pageParam }) =>
                fetchLeadCustomFieldValues({
                    instituteId,
                    customFieldId: fieldId,
                    search: debouncedSearch || undefined,
                    pageNo: pageParam,
                    pageSize: PAGE_SIZE,
                }),
            initialPageParam: 0,
            getNextPageParam: (lastPage) =>
                lastPage.last ? undefined : (lastPage.number ?? 0) + 1,
            // Lazy: only fetch once the dropdown is actually open.
            enabled: open && Boolean(instituteId) && Boolean(fieldId),
            staleTime: 60 * 1000,
        });

    const fetchedValues = useMemo(
        () => data?.pages.flatMap((p) => p.content ?? []) ?? [],
        [data]
    );

    // Surface already-selected values that aren't in the current (search-filtered)
    // page first, so they can always be unchecked.
    const orderedValues = useMemo(() => {
        const selectedNotShown = selected.filter((v) => !fetchedValues.includes(v));
        return [...selectedNotShown, ...fetchedValues];
    }, [selected, fetchedValues]);

    const toggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const count = selected.length;
    const triggerLabel = count > 0 ? `${fieldName} · ${count}` : fieldName;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={`Filter by ${fieldName}`}
                    className={cn(
                        'h-10 max-w-56 justify-between',
                        count > 0 && 'border-primary-300 bg-primary-50'
                    )}
                >
                    <span className="truncate text-sm font-normal">{triggerLabel}</span>
                    <CaretDown className="size-4 shrink-0 text-neutral-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${fieldName.toLowerCase()}…`}
                        className="h-9"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList className="max-h-64 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-neutral-500">
                                <CircleNotch className="size-4 animate-spin" />
                                Loading…
                            </div>
                        ) : isError ? (
                            <div className="py-6 text-center text-sm text-danger-600">
                                Couldn&apos;t load values.
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>No values found.</CommandEmpty>
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
                                    {orderedValues.map((value) => (
                                        <CommandItem
                                            key={value}
                                            value={value}
                                            onSelect={() => toggle(value)}
                                            className="cursor-pointer"
                                        >
                                            <Check
                                                className={cn(
                                                    'mr-2 size-4',
                                                    selected.includes(value)
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                )}
                                            />
                                            <span className="truncate">{value}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                {hasNextPage && (
                                    <button
                                        type="button"
                                        onClick={() => fetchNextPage()}
                                        disabled={isFetchingNextPage}
                                        className="flex w-full items-center justify-center gap-2 py-2 text-xs font-medium text-primary-500 hover:text-primary-600 disabled:opacity-60"
                                    >
                                        {isFetchingNextPage ? (
                                            <CircleNotch className="size-3 animate-spin" />
                                        ) : null}
                                        Load more
                                    </button>
                                )}
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
