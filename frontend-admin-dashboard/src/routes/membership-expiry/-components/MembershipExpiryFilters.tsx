import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PackageSelector from '@/components/design-system/PackageSelector';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { Calendar, Funnel, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { BatchForSession, PackageSessionFilter } from '@/types/payment-logs';

interface MembershipExpiryFiltersProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    packageSessionFilter: PackageSessionFilter;
    onPackageSessionFilterChange: (filter: PackageSessionFilter) => void;
    batchesForSessions: BatchForSession[];
    onQuickFilterSelect: (range: { start: string; end: string }) => void;
    onClearFilters: () => void;
}

export function MembershipExpiryFilters({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    packageSessionFilter,
    onPackageSessionFilterChange,
    batchesForSessions,
    onQuickFilterSelect,
    onClearFilters,
}: MembershipExpiryFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    // Simplified package session ID logic
    const handlePackageSessionChange = (selection: {
        packageSessionId: string | null;
        levelId: string;
        sessionId: string;
        packageId: string;
        packageSessionIds?: string[];
    }) => {
        onPackageSessionFilterChange({
            ...packageSessionFilter,
            packageSessionId: selection.packageSessionId || '',
            levelId: selection.levelId,
            sessionId: selection.sessionId,
            packageId: selection.packageId,
            packageSessionIds: selection.packageSessionIds,
        });
    };

    const handleQuickFilter = (type: string) => {
        const now = new Date();
        const start = new Date();

        switch (type) {
            case '1h':
                start.setHours(now.getHours() - 1);
                break;
            case 'today':
                start.setHours(0, 0, 0, 0);
                break;
            case '7d':
                start.setDate(now.getDate() - 7);
                break;
            case '30d':
                start.setDate(now.getDate() - 30);
                break;
            case 'all':
                onQuickFilterSelect({ start: '', end: '' });
                return;
        }

        onQuickFilterSelect({
            start: start.toISOString(),
            end: now.toISOString(),
        });
    };

    const hasActiveFilters =
        startDate ||
        endDate ||
        !!packageSessionFilter.packageId;

    return (
        <div className="space-y-4">
            {/* Filter Toggle & Quick Filters */}
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
                            {(startDate ? 1 : 0) +
                                (endDate ? 1 : 0) +
                                (packageSessionFilter.packageSessionIds?.length || (packageSessionFilter.packageId ? 1 : 0))}
                        </span>
                    )}
                </Button>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Quick:</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickFilter('1h')}
                        className="h-8"
                    >
                        Last 1 Hour
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickFilter('today')}
                        className="h-8"
                    >
                        Today
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickFilter('7d')}
                        className="h-8"
                    >
                        Last 7 Days
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickFilter('30d')}
                        className="h-8"
                    >
                        Last 30 Days
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickFilter('all')}
                        className="h-8"
                    >
                        All Time
                    </Button>
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

            {/* Expanded Filter Panel */}
            {showFilters && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    {/* Package Session Filter Section */}
                    <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                        <Label className="mb-2 block text-sm font-semibold text-blue-900">
                            Filter by Course/Session
                        </Label>

                        <PackageSelector
                            instituteId={getCurrentInstituteId() || ''}
                            onChange={handlePackageSessionChange}
                            initialLevelId={packageSessionFilter.levelId}
                            initialSessionId={packageSessionFilter.sessionId}
                            initialPackageId={packageSessionFilter.packageId}
                            multiSelect={true}
                            batchesForSessions={batchesForSessions}
                        />
                    </div>

                    {/* Other Filters */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Start Date */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                <Calendar size={14} className="mr-1 inline" />
                                Start Date
                            </Label>
                            <Input
                                type="datetime-local"
                                value={
                                    startDate ? new Date(startDate).toISOString().slice(0, 16) : ''
                                }
                                onChange={(e) =>
                                    onStartDateChange(
                                        e.target.value ? new Date(e.target.value).toISOString() : ''
                                    )
                                }
                                className="h-9"
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                <Calendar size={14} className="mr-1 inline" />
                                End Date
                            </Label>
                            <Input
                                type="datetime-local"
                                value={endDate ? new Date(endDate).toISOString().slice(0, 16) : ''}
                                onChange={(e) =>
                                    onEndDateChange(
                                        e.target.value ? new Date(e.target.value).toISOString() : ''
                                    )
                                }
                                className="h-9"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
