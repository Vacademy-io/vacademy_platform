import { X } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import type { SelectOption } from '@/components/design-system/SelectChips';
import type { PackageSessionFilter, BatchForSession } from '@/types/payment-logs';
import { format } from 'date-fns';

interface ActiveFiltersDisplayProps {
    startDate: string;
    endDate: string;
    packageSessionFilter: PackageSessionFilter;
    batchesForSessions: BatchForSession[];
    onClearFilter: (filterType: string, value?: string) => void;
    // Optional payment-specific filters
    selectedPaymentStatuses?: SelectOption[];
    selectedUserPlanStatuses?: SelectOption[];
    selectedPaymentSources?: SelectOption[];
    // Optional membership-specific filters
    selectedUserTypes?: SelectOption[];
}

export function ActiveFiltersDisplay({
    startDate,
    endDate,
    packageSessionFilter,
    batchesForSessions,
    onClearFilter,
    selectedPaymentStatuses = [],
    selectedUserPlanStatuses = [],
    selectedPaymentSources = [],
    selectedUserTypes = [],
}: ActiveFiltersDisplayProps) {
    const hasActiveFilters =
        startDate ||
        endDate ||
        selectedPaymentStatuses.length > 0 ||
        selectedUserPlanStatuses.length > 0 ||
        selectedPaymentSources.length > 0 ||
        selectedUserTypes.length > 0 ||
        !!packageSessionFilter.packageId ||
        !!packageSessionFilter.packageSessionId ||
        (packageSessionFilter.packageSessionIds && packageSessionFilter.packageSessionIds.length > 0);

    if (!hasActiveFilters) {
        return null;
    }

    const getPackageSessionDisplay = () => {
        if (!packageSessionFilter.packageId && !packageSessionFilter.packageSessionId) return null;

        const batch = batchesForSessions.find((b) => {
            if (packageSessionFilter.packageSessionId) {
                return b.id === packageSessionFilter.packageSessionId;
            }
            return (
                b.package_dto.id === packageSessionFilter.packageId &&
                (!packageSessionFilter.sessionId || b.session.id === packageSessionFilter.sessionId) &&
                (!packageSessionFilter.levelId || b.level.id === packageSessionFilter.levelId)
            );
        });

        if (!batch) return null;

        const parts = [batch.package_dto.package_name];
        if (packageSessionFilter.sessionId) {
            parts.push(batch.session.session_name);
        }
        if (packageSessionFilter.levelId) {
            parts.push(batch.level.level_name);
        }

        return parts.join(' → ');
    };

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
        } catch {
            return dateString;
        }
    };

    return (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mt-4">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-blue-900">Active Filters</h3>
                <button
                    onClick={() => onClearFilter('all')}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                    Clear All
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {/* Date Range Filters */}
                {startDate && (
                    <Badge
                        variant="outline"
                        className="gap-2 border-blue-300 bg-white text-blue-800"
                    >
                        <span className="text-xs">From: {formatDate(startDate)}</span>
                        <button
                            onClick={() => onClearFilter('startDate')}
                            className="hover:text-blue-950"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Badge>
                )}
                {endDate && (
                    <Badge
                        variant="outline"
                        className="gap-2 border-blue-300 bg-white text-blue-800"
                    >
                        <span className="text-xs">To: {formatDate(endDate)}</span>
                        <button
                            onClick={() => onClearFilter('endDate')}
                            className="hover:text-blue-950"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Badge>
                )}

                {/* User Type Filters (Membership Stats) */}
                {selectedUserTypes.map((type) => (
                    <Badge
                        key={type.value}
                        variant="default"
                        className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        <span className="text-xs">User Type: {type.label}</span>
                        <button
                            onClick={() => onClearFilter('userType', type.value)}
                            className="hover:text-indigo-100"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Badge>
                ))}

                {/* Payment Status Filters */}
                {selectedPaymentStatuses.map((status) => (
                    <Badge
                        key={status.value}
                        variant="default"
                        className="gap-2 bg-green-600 text-white hover:bg-green-700"
                    >
                        <span className="text-xs">Payment: {status.label}</span>
                        <button
                            onClick={() => onClearFilter('paymentStatus', status.value)}
                            className="hover:text-green-100"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Badge>
                ))}

                {/* User Plan Status Filters */}
                {selectedUserPlanStatuses.map((status) => (
                    <Badge
                        key={status.value}
                        variant="default"
                        className="gap-2 bg-purple-600 text-white hover:bg-purple-700"
                    >
                        <span className="text-xs">Plan: {status.label}</span>
                        <button
                            onClick={() => onClearFilter('userPlanStatus', status.value)}
                            className="hover:text-purple-100"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Badge>
                ))}

                {/* Payment Source Filters */}
                {selectedPaymentSources.map((source) => (
                    <Badge
                        key={source.value}
                        variant="default"
                        className="gap-2 bg-orange-600 text-white hover:bg-orange-700"
                    >
                        <span className="text-xs">Source: {source.label}</span>
                        <button
                            onClick={() => onClearFilter('paymentSource', source.value)}
                            className="hover:text-orange-100"
                        >
                            <X size={12} weight="bold" />
                        </button>
                    </Badge>
                ))}

                {/* Package Session Filters (Multi-select) */}
                {packageSessionFilter.packageSessionIds && packageSessionFilter.packageSessionIds.length > 0 ? (
                    packageSessionFilter.packageSessionIds.map(id => {
                        const batch = batchesForSessions.find(b => b.id === id);
                        let label = batch ? batch.package_dto.package_name : id;

                        if (batch) {
                            const parts = [batch.package_dto.package_name];
                            if (batch.level.level_name) parts.push(batch.level.level_name);
                            if (batch.session.session_name) parts.push(batch.session.session_name);
                            label = parts.join(' → ');
                        }

                        return (
                            <Badge
                                key={id}
                                variant="default"
                                className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <span className="text-xs">
                                    Course: {label}
                                </span>
                                <button
                                    onClick={() => onClearFilter('packageSession', id)}
                                    className="hover:text-blue-100"
                                >
                                    <X size={12} weight="bold" />
                                </button>
                            </Badge>
                        );
                    })
                ) : (
                    /* Legacy single select fallback */
                    (packageSessionFilter.packageId || packageSessionFilter.packageSessionId) && (
                        <Badge
                            variant="default"
                            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                        >
                            <span className="text-xs">
                                Course: {getPackageSessionDisplay() || 'Selected'}
                            </span>
                            <button
                                onClick={() => onClearFilter('packageSession')}
                                className="hover:text-blue-100"
                            >
                                <X size={12} weight="bold" />
                            </button>
                        </Badge>
                    )
                )}
            </div>
        </div>
    );
}
