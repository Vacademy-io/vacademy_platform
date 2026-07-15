'use client';

import * as React from 'react';
import { Check, CaretUpDown, CircleNotch } from '@phosphor-icons/react';

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

export type LoadOptionsResult = {
    options: SearchableSelectOption[];
    hasMore: boolean;
};

interface AsyncSearchableSelectProps {
    value: string;
    onChange: (value: string, option?: SearchableSelectOption) => void;
    /** Label of the currently selected option, shown on the trigger even before its page has loaded. */
    selectedLabel?: string;
    /** Fetch one page of options for the given search text. `page` is 0-based. */
    loadOptions: (search: string, page: number) => Promise<LoadOptionsResult>;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
    triggerClassName?: string;
    debounceMs?: number;
    /** Extra items rendered after the loaded options (e.g. "Add new"). */
    footer?: React.ReactNode;
}

const SCROLL_LOAD_MORE_THRESHOLD_PX = 48;

export function AsyncSearchableSelect({
    value,
    onChange,
    selectedLabel,
    loadOptions,
    placeholder = 'Select option',
    searchPlaceholder = 'Search...',
    emptyText = 'No options found.',
    className,
    disabled = false,
    triggerClassName,
    debounceMs = 300,
    footer,
}: AsyncSearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchInput, setSearchInput] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [options, setOptions] = React.useState<SearchableSelectOption[]>([]);
    const [page, setPage] = React.useState(0);
    const [hasMore, setHasMore] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const requestIdRef = React.useRef(0);

    // Debounce the search box before it triggers a server fetch
    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), debounceMs);
        return () => clearTimeout(timer);
    }, [searchInput, debounceMs]);

    // (Re)load the first page whenever the popover opens or the debounced search changes
    React.useEffect(() => {
        if (!open) return;
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        loadOptions(debouncedSearch, 0)
            .then((result) => {
                if (requestIdRef.current !== requestId) return;
                setOptions(result.options);
                setHasMore(result.hasMore);
                setPage(0);
            })
            .finally(() => {
                if (requestIdRef.current === requestId) setIsLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, debouncedSearch]);

    const loadMore = React.useCallback(() => {
        if (isLoading || isLoadingMore || !hasMore) return;
        const requestId = ++requestIdRef.current;
        const nextPage = page + 1;
        setIsLoadingMore(true);
        loadOptions(debouncedSearch, nextPage)
            .then((result) => {
                if (requestIdRef.current !== requestId) return;
                setOptions((current) => [...current, ...result.options]);
                setHasMore(result.hasMore);
                setPage(nextPage);
            })
            .finally(() => {
                if (requestIdRef.current === requestId) setIsLoadingMore(false);
            });
    }, [debouncedSearch, hasMore, isLoading, isLoadingMore, loadOptions, page]);

    const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (distanceFromBottom < SCROLL_LOAD_MORE_THRESHOLD_PX) {
            loadMore();
        }
    };

    const handleSelect = (option: SearchableSelectOption) => {
        onChange(option.value, option);
        setOpen(false);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSearchInput('');
            setDebouncedSearch('');
        }
    };

    const triggerLabel = selectedLabel || options.find((option) => option.value === value)?.label || '';

    return (
        <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between font-normal', triggerClassName, className)}
                    disabled={disabled}
                >
                    <span className={cn('truncate', !value && 'text-muted-foreground')}>
                        {value ? triggerLabel || value : placeholder}
                    </span>
                    <CaretUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={searchInput}
                        onValueChange={setSearchInput}
                    />
                    <CommandList onScroll={handleScroll}>
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <CircleNotch className="size-4 animate-spin" />
                                Loading...
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>{emptyText}</CommandEmpty>
                                <CommandGroup>
                                    {options.map((option) => (
                                        <CommandItem
                                            key={option.value}
                                            value={option.value}
                                            onSelect={() => handleSelect(option)}
                                        >
                                            <Check
                                                className={cn(
                                                    'mr-2 h-4 w-4',
                                                    value === option.value ? 'opacity-100' : 'opacity-0'
                                                )}
                                            />
                                            <span className="truncate">{option.label}</span>
                                        </CommandItem>
                                    ))}
                                    {isLoadingMore && (
                                        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                                            <CircleNotch className="size-3 animate-spin" />
                                            Loading more...
                                        </div>
                                    )}
                                </CommandGroup>
                                {footer}
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
