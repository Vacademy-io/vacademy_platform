import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectChips from '@/components/design-system/SelectChips';
import PackageSelector from '@/components/design-system/PackageSelector';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { SelectOption } from '@/components/design-system/SelectChips';
import { Calendar, Funnel, X, MagnifyingGlass } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { FeeSearchFilterDTO } from '@/types/manage-finances';

interface ManageFinancesFiltersProps {
    filter: FeeSearchFilterDTO;
    onFilterChange: (filter: FeeSearchFilterDTO) => void;
    onClearFilters: () => void;
}

const STATUS_OPTIONS: SelectOption[] = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'PAID', label: 'Paid' },
    { value: 'PARTIAL_PAID', label: 'Partial Paid' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'WAIVED', label: 'Waived' },
];

export function ManageFinancesFilters({
    filter,
    onFilterChange,
    onClearFilters,
}: ManageFinancesFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    const handlePackageSessionChange = (selection: {
        packageSessionId: string | null;
        packageSessionIds?: string[];
    }) => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                packageSessionIds: selection.packageSessionIds?.length ? selection.packageSessionIds : 
                    selection.packageSessionId ? [selection.packageSessionId] : [],
            },
        });
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                studentSearchQuery: e.target.value,
            },
        });
    };

    const handleStatusChange = (statuses: SelectOption[]) => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                statuses: statuses.map(s => s.value),
            },
        });
    };

    const handleStartDateChange = (startDate: string) => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                dueDateRange: {
                    ...filter.filters.dueDateRange,
                    startDate,
                    endDate: filter.filters.dueDateRange?.endDate || '',
                },
            },
        });
    };

    const handleEndDateChange = (endDate: string) => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                dueDateRange: {
                    ...filter.filters.dueDateRange,
                    startDate: filter.filters.dueDateRange?.startDate || '',
                    endDate,
                },
            },
        });
    };
    
    const hasActiveFilters =
        !!filter.filters.studentSearchQuery ||
        (filter.filters.statuses && filter.filters.statuses.length > 0) ||
        (filter.filters.packageSessionIds && filter.filters.packageSessionIds.length > 0) ||
        !!filter.filters.dueDateRange?.startDate ||
        !!filter.filters.dueDateRange?.endDate;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn('gap-2', hasActiveFilters && 'border-primary-500 bg-primary-50')}
                >
                    <Funnel size={16} weight={hasActiveFilters ? 'fill' : 'regular'} />
                    Filters
                    {hasActiveFilters && (
                        <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary-500 text-xs text-white">
                            !
                        </span>
                    )}
                </Button>

                <div className="relative w-64">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlass className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                        type="search"
                        placeholder="Search student or email..."
                        className="pl-10 h-9"
                        value={filter.filters.studentSearchQuery || ''}
                        onChange={handleSearchChange}
                    />
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearFilters}
                        className="ml-auto gap-2 text-red-600 hover:text-red-700"
                    >
                        <X size={16} />
                        Clear All
                    </Button>
                )}
            </div>

            {showFilters && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                        <Label className="mb-2 block text-sm font-semibold text-blue-900">
                            Filter by Course/Session
                        </Label>

                        <PackageSelector
                            instituteId={getCurrentInstituteId() || ''}
                            onChange={handlePackageSessionChange}
                            multiSelect={true}
                            initialPackageSessionIds={filter.filters.packageSessionIds}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                <Calendar size={14} className="mr-1 inline" />
                                Due Start Date
                            </Label>
                            <Input
                                type="date"
                                value={filter.filters.dueDateRange?.startDate || ''}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                <Calendar size={14} className="mr-1 inline" />
                                Due End Date
                            </Label>
                            <Input
                                type="date"
                                value={filter.filters.dueDateRange?.endDate || ''}
                                onChange={(e) => handleEndDateChange(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Payment Status
                            </Label>
                            <SelectChips
                                options={STATUS_OPTIONS}
                                selected={STATUS_OPTIONS.filter(o => filter.filters.statuses?.includes(o.value))}
                                onChange={handleStatusChange}
                                placeholder="Select statuses"
                                multiSelect={true}
                                clearable={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
