import { useState } from 'react';
import { Input } from '@/components/ui/input';
import PackageSelector from '@/components/design-system/PackageSelector';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { MagnifyingGlass, X, FunnelSimple, Package, CheckCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { FeeSearchFilterDTO } from '@/types/manage-finances';

interface ManageFinancesFiltersProps {
    filter: FeeSearchFilterDTO;
    onFilterChange: (filter: FeeSearchFilterDTO) => void;
    onClearFilters: () => void;
}

const STATUS_CONFIG = [
    { value: 'PAID', label: 'Paid', activeBg: 'bg-emerald-100', activeText: 'text-emerald-700', activeBorder: 'border-emerald-300' },
    { value: 'PARTIAL', label: 'Partial', activeBg: 'bg-amber-100', activeText: 'text-amber-700', activeBorder: 'border-amber-300' },
    { value: 'PENDING', label: 'Pending', activeBg: 'bg-slate-200', activeText: 'text-slate-700', activeBorder: 'border-slate-300' },
    { value: 'OVERDUE', label: 'Overdue', activeBg: 'bg-red-100', activeText: 'text-red-700', activeBorder: 'border-red-300' },
];

export function ManageFinancesFilters({
    filter,
    onFilterChange,
    onClearFilters,
}: ManageFinancesFiltersProps) {
    const [showPackageFilter, setShowPackageFilter] = useState(false);

    const handlePackageSessionChange = (selection: {
        packageSessionId: string | null;
        packageSessionIds?: string[];
    }) => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                packageSessionIds: selection.packageSessionIds?.length
                    ? selection.packageSessionIds
                    : selection.packageSessionId
                      ? [selection.packageSessionId]
                      : [],
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

    const toggleStatus = (statusValue: string) => {
        const current = filter.filters.statuses || [];
        const updated = current.includes(statusValue)
            ? current.filter((s) => s !== statusValue)
            : [...current, statusValue];

        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                statuses: updated,
            },
        });
    };

    const clearStatuses = () => {
        onFilterChange({
            ...filter,
            page: 0,
            filters: {
                ...filter.filters,
                statuses: [],
            },
        });
    };

    const hasActiveFilters =
        !!filter.filters.studentSearchQuery ||
        (filter.filters.statuses && filter.filters.statuses.length > 0) ||
        (filter.filters.packageSessionIds && filter.filters.packageSessionIds.length > 0);

    const selectedStatuses = filter.filters.statuses || [];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col gap-5 p-5">
            {/* Header row */}
            <div className="flex items-center gap-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <FunnelSimple size={20} weight="duotone" className="text-gray-600" />
                    <h2 className="text-base font-bold text-gray-800 tracking-wide">Filters</h2>
                </div>

                {/* Search input */}
                <div className="relative w-80 ml-auto">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlass className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                        type="search"
                        placeholder="Search student name or phone..."
                        className="pl-10 h-9 rounded-md border-gray-300 bg-gray-50 text-sm font-medium text-gray-700 focus:border-blue-500 hover:bg-white"
                        value={filter.filters.studentSearchQuery || ''}
                        onChange={handleSearchChange}
                    />
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={onClearFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition shadow-sm"
                    >
                        <X size={12} weight="bold" />
                        Clear All
                    </button>
                )}
            </div>

            {/* Status pills row */}
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1">
                    Status
                </span>

                {/* "All" pill */}
                <button
                    onClick={clearStatuses}
                    className={cn(
                        'px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm border',
                        selectedStatuses.length === 0
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'
                    )}
                >
                    All
                </button>

                {/* Individual status pills */}
                {STATUS_CONFIG.map((s) => {
                    const isActive = selectedStatuses.includes(s.value);
                    return (
                        <button
                            key={s.value}
                            onClick={() => toggleStatus(s.value)}
                            className={cn(
                                'px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm border',
                                isActive
                                    ? `${s.activeBg} ${s.activeText} ${s.activeBorder}`
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            )}
                        >
                            {s.label}
                        </button>
                    );
                })}

                {/* Package filter toggle */}
                <div className="ml-auto">
                    <button
                        onClick={() => setShowPackageFilter(!showPackageFilter)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm border',
                            showPackageFilter || (filter.filters.packageSessionIds && filter.filters.packageSessionIds.length > 0)
                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        )}
                    >
                        <Package size={14} weight="duotone" />
                        Course Filter
                        {filter.filters.packageSessionIds && filter.filters.packageSessionIds.length > 0 && (
                            <span className="flex items-center justify-center size-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                                {filter.filters.packageSessionIds.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Expandable Package/Session selector */}
            {showPackageFilter && (
                <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle size={16} weight="duotone" className="text-blue-600" />
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Select Course / Session
                        </span>
                    </div>
                    <PackageSelector
                        instituteId={getCurrentInstituteId() || ''}
                        onChange={handlePackageSessionChange}
                        multiSelect={true}
                        initialPackageSessionIds={filter.filters.packageSessionIds}
                    />
                </div>
            )}
        </div>
    );
}
