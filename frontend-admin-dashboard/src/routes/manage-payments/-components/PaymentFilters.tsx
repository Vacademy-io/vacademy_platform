import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectChips from '@/components/design-system/SelectChips';
import PackageSelector from '@/components/design-system/PackageSelector';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { SelectOption } from '@/components/design-system/SelectChips';
import { Calendar, Funnel, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { BatchForSession, PackageSessionFilter } from '@/types/payment-logs';

interface PaymentFiltersProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    selectedPaymentStatuses: SelectOption[];
    onPaymentStatusesChange: (statuses: SelectOption[]) => void;
    selectedUserPlanStatuses: SelectOption[];
    onUserPlanStatusesChange: (statuses: SelectOption[]) => void;
    selectedPaymentSources: SelectOption[]; // New prop
    onPaymentSourcesChange: (sources: SelectOption[]) => void; // New prop
    hasOrgAssociatedBatches: boolean; // New prop to conditionally show filter
    packageSessionFilter: PackageSessionFilter;
    onPackageSessionFilterChange: (filter: PackageSessionFilter) => void;
    batchesForSessions: BatchForSession[];
    onQuickFilterSelect: (range: { start: string; end: string }) => void;
    onClearFilters: () => void;
}

const PAYMENT_STATUS_OPTIONS: SelectOption[] = [
    { value: 'PAID', label: 'Paid' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'PAYMENT_PENDING', label: 'Pending' },
];

const USER_PLAN_STATUS_OPTIONS: SelectOption[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'INACTIVE', label: 'Inactive' },
];

const PAYMENT_SOURCE_OPTIONS: SelectOption[] = [
    { value: 'USER', label: 'User' },
    { value: 'SUB_ORG', label: 'Org' },
];

export function PaymentFilters({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    selectedPaymentStatuses,
    onPaymentStatusesChange,
    selectedUserPlanStatuses,
    onUserPlanStatusesChange,
    selectedPaymentSources,
    onPaymentSourcesChange,
    hasOrgAssociatedBatches,
    packageSessionFilter,
    onPackageSessionFilterChange,
    batchesForSessions,
    onQuickFilterSelect,
    onClearFilters,
}: PaymentFiltersProps) {
    const [showFilters, setShowFilters] = useState(false);

    // Handle package selection
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

    const getQuickDateRange = (type: string) => {
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
            case '90d':
                start.setDate(now.getDate() - 90);
                break;
            case 'all':
                return {
                    start: '',
                    end: '',
                };
        }

        return {
            start: start.toISOString(),
            end: now.toISOString(),
        };
    };

    const handleQuickFilter = (type: string) => {
        const range = getQuickDateRange(type);
        onQuickFilterSelect(range);
    };

    const hasActiveFilters =
        startDate ||
        endDate ||
        selectedPaymentStatuses.length > 0 ||
        selectedUserPlanStatuses.length > 0 ||
        selectedPaymentSources.length > 0 ||
        !!packageSessionFilter.packageId ||
        (packageSessionFilter.packageSessionIds && packageSessionFilter.packageSessionIds.length > 0);

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
                    Filters                    {hasActiveFilters && (
                        <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary-500 text-xs text-white">
                            {(selectedPaymentStatuses.length || 0) +
                                (selectedUserPlanStatuses.length || 0) +
                                (selectedPaymentSources.length || 0) +
                                (startDate ? 1 : 0) +
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
                            initialPackageSessionIds={packageSessionFilter.packageSessionIds}
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

                        {/* Payment Status */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                Payment Status
                            </Label>
                            <SelectChips
                                options={PAYMENT_STATUS_OPTIONS}
                                selected={selectedPaymentStatuses}
                                onChange={onPaymentStatusesChange}
                                placeholder="Select statuses"
                                multiSelect={true}
                                clearable={true}
                            />
                        </div>
                        {/* User Plan Status */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-700">
                                User Plan Status
                            </Label>
                            <SelectChips
                                options={USER_PLAN_STATUS_OPTIONS}
                                selected={selectedUserPlanStatuses}
                                onChange={onUserPlanStatusesChange}
                                placeholder="Select statuses"
                                multiSelect={true}
                                clearable={true}
                            />
                        </div>
                        {/* Payment Source - Only show if institute has org-associated batches */}
                        {hasOrgAssociatedBatches && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">
                                    Payment Source
                                </Label>
                                <SelectChips
                                    options={PAYMENT_SOURCE_OPTIONS}
                                    selected={selectedPaymentSources}
                                    onChange={onPaymentSourcesChange}
                                    placeholder="Select sources"
                                    multiSelect={true}
                                    clearable={true}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
