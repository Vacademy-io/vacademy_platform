import { MyButton } from '@/components/design-system/button';
import { Funnel, X, ArrowsDownUp, Plus } from '@phosphor-icons/react';
import { StudentSearchBox } from '@/components/common/student-search-box';
import { FilterChips } from '@/components/design-system/chips';
import { useMemo, useState, useEffect } from 'react';
import { useCompactMode } from '@/hooks/use-compact-mode';
import { cn } from '@/lib/utils';
import { BatchesSummaryResponse } from '../-types/package-types';
import { ColumnFilter, FilterOption } from '../-hooks/usePackageFilters';
import { Link } from '@tanstack/react-router';

interface PackageFiltersProps {
    summaryData: BatchesSummaryResponse | undefined;
    searchInput: string;
    searchFilter: string;
    columnFilters: ColumnFilter[];
    clearFilters: boolean;
    appliedFilters: {
        sortBy?: string;
        sortDirection?: string;
    };
    totalElements: number;
    getActiveFiltersState: () => boolean;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSearchEnter: () => void;
    onClearSearch: () => void;
    onFilterChange: (filterId: string, values: FilterOption[]) => void;
    onFilterClick: () => void;
    onClearFilters: () => void;
    onSort: (sortBy: string, sortDirection: 'ASC' | 'DESC') => void;
}

const STATUS_OPTIONS = [
    { id: 'ACTIVE', label: 'Active' },
    { id: 'HIDDEN', label: 'Hidden' },
    { id: 'INACTIVE', label: 'Inactive' },
];

const SORT_OPTIONS = [
    { id: 'package_name', label: 'Package Name' },
    { id: 'level_name', label: 'Level Name' },
    { id: 'session_name', label: 'Session Name' },
    { id: 'created_at', label: 'Created Date' },
];

export const PackageFilters = ({
    summaryData,
    searchInput,
    searchFilter,
    columnFilters,
    clearFilters,
    appliedFilters,
    totalElements,
    getActiveFiltersState,
    onSearchChange,
    onSearchEnter,
    onClearSearch,
    onFilterChange,
    onFilterClick,
    onClearFilters,
    onSort,
}: PackageFiltersProps) => {
    const { isCompact } = useCompactMode();
    const [localFilters, setLocalFilters] = useState<Record<string, FilterOption[]>>({});

    useEffect(() => {
        if (clearFilters) {
            setLocalFilters({});
        }
    }, [clearFilters]);

    useEffect(() => {
        const newLocalFilters: Record<string, FilterOption[]> = {};
        columnFilters.forEach((filter) => {
            newLocalFilters[filter.id] = filter.value;
        });
        setLocalFilters(newLocalFilters);
    }, [columnFilters]);

    const isFilterActive = useMemo(() => {
        return getActiveFiltersState();
    }, [columnFilters, searchFilter, getActiveFiltersState]);

    const handleFilterSelect = (filterId: string, option: FilterOption) => {
        const currentValues = localFilters[filterId] || [];
        const exists = currentValues.some((v) => v.id === option.id);

        let newValues: FilterOption[];
        if (exists) {
            newValues = currentValues.filter((v) => v.id !== option.id);
        } else {
            newValues = [...currentValues, option];
        }

        setLocalFilters((prev) => ({
            ...prev,
            [filterId]: newValues,
        }));
        onFilterChange(filterId, newValues);
    };

    const handleClearFilter = (filterId: string) => {
        setLocalFilters((prev) => ({
            ...prev,
            [filterId]: [],
        }));
        onFilterChange(filterId, []);
    };

    const sessionOptions = useMemo(() => {
        return summaryData?.sessions.map((s) => ({ id: s.id, label: s.name })) || [];
    }, [summaryData]);

    const levelOptions = useMemo(() => {
        return summaryData?.levels.map((l) => ({ id: l.id, label: l.name })) || [];
    }, [summaryData]);

    const packageOptions = useMemo(() => {
        return summaryData?.packages.map((p) => ({ id: p.id, label: p.name })) || [];
    }, [summaryData]);

    return (
        <div className="animate-fadeIn space-y-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-500">
                        Total: <strong className="text-neutral-700">{totalElements}</strong>{' '}
                        packages
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link to="/admin-package-management/bulk-create">
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            layoutVariant="default"
                            className="flex items-center gap-1.5"
                        >
                            <Plus className="size-4" />
                            Bulk Create
                        </MyButton>
                    </Link>
                    <SortDropdown
                        currentSort={appliedFilters.sortBy || 'created_at'}
                        currentDirection={appliedFilters.sortDirection || 'DESC'}
                        onSort={onSort}
                        isCompact={isCompact}
                    />
                </div>
            </div>

            <div
                className={cn(
                    'rounded-xl border border-neutral-200/50 bg-gradient-to-r from-white to-neutral-50/30 shadow-sm',
                    isCompact ? 'p-2' : 'p-4'
                )}
            >
                <div className={cn('flex flex-col', isCompact ? 'gap-2' : 'gap-4')}>
                    <div className="w-full lg:max-w-md">
                        <StudentSearchBox
                            searchInput={searchInput}
                            searchFilter={searchFilter}
                            onSearchChange={onSearchChange}
                            onSearchEnter={onSearchEnter}
                            onClearSearch={onClearSearch}
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <FilterChips
                            label="Session"
                            filterList={sessionOptions}
                            selectedFilters={localFilters['session'] || []}
                            clearFilters={clearFilters}
                            handleSelect={(option) => handleFilterSelect('session', option)}
                            handleClearFilters={() => handleClearFilter('session')}
                        />

                        <FilterChips
                            label="Level"
                            filterList={levelOptions}
                            selectedFilters={localFilters['level'] || []}
                            clearFilters={clearFilters}
                            handleSelect={(option) => handleFilterSelect('level', option)}
                            handleClearFilters={() => handleClearFilter('level')}
                        />

                        <FilterChips
                            label="Package"
                            filterList={packageOptions}
                            selectedFilters={localFilters['package'] || []}
                            clearFilters={clearFilters}
                            handleSelect={(option) => handleFilterSelect('package', option)}
                            handleClearFilters={() => handleClearFilter('package')}
                        />

                        <FilterChips
                            label="Status"
                            filterList={STATUS_OPTIONS}
                            selectedFilters={localFilters['status'] || []}
                            clearFilters={clearFilters}
                            handleSelect={(option) => handleFilterSelect('status', option)}
                            handleClearFilters={() => handleClearFilter('status')}
                        />
                    </div>

                    {(columnFilters.length > 0 || isFilterActive) && (
                        <div className="animate-scaleIn flex flex-wrap items-center gap-3 border-t border-neutral-200/50 pt-2">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                layoutVariant="default"
                                className="hover:scale-102 group flex h-8 items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 shadow-md transition-all duration-200 hover:from-primary-600 hover:to-primary-700"
                                onClick={onFilterClick}
                            >
                                <Funnel className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
                                Apply Filters
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                className="hover:scale-102 group flex h-8 items-center gap-2 border border-neutral-300 bg-neutral-100 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-200 active:border-neutral-500 active:bg-neutral-300"
                                onClick={onClearFilters}
                            >
                                <X className="size-3.5 transition-transform duration-200 group-hover:scale-110" />
                                Reset All
                            </MyButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SortDropdown = ({
    currentSort,
    currentDirection,
    onSort,
    isCompact,
}: {
    currentSort: string;
    currentDirection: string;
    onSort: (sortBy: string, sortDirection: 'ASC' | 'DESC') => void;
    isCompact: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const currentLabel = SORT_OPTIONS.find((o) => o.id === currentSort)?.label || 'Created Date';

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm transition-all hover:border-neutral-300 hover:bg-neutral-50',
                    isCompact && 'px-2 py-1 text-xs'
                )}
            >
                <ArrowsDownUp className={cn('size-4', isCompact && 'size-3')} />
                <span>{currentLabel}</span>
                <span className="text-xs text-neutral-400">
                    ({currentDirection === 'ASC' ? '↑' : '↓'})
                </span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                        {SORT_OPTIONS.map((option) => (
                            <div key={option.id} className="px-1">
                                <button
                                    className={cn(
                                        'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-neutral-100',
                                        currentSort === option.id &&
                                            'bg-primary-50 text-primary-600'
                                    )}
                                    onClick={() => {
                                        const newDirection =
                                            currentSort === option.id && currentDirection === 'DESC'
                                                ? 'ASC'
                                                : 'DESC';
                                        onSort(option.id, newDirection);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span>{option.label}</span>
                                    {currentSort === option.id && (
                                        <span className="text-xs">
                                            {currentDirection === 'ASC' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
