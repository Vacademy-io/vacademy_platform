import { useState } from 'react';
import { X } from 'lucide-react';
import type {
    ListPlanningLogsRequest,
    LogType,
    IntervalType,
    PlanningLogStatus,
} from '../-types/types';
import { MyButton } from '@/components/design-system/button';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { FilterChips } from '@/components/design-system/chips';
import IntervalPeriodSelector from './IntervalPeriodSelector';

interface PlanningFiltersProps {
    filters: ListPlanningLogsRequest;
    onChange: (filters: ListPlanningLogsRequest) => void;
    hideLogTypeFilter?: boolean; // When true, hides the log type filter
    logType: LogType;
}

export default function PlanningFilters({
    filters,
    onChange,
    hideLogTypeFilter,
    logType,
}: PlanningFiltersProps) {
    const [localFilters, setLocalFilters] = useState<ListPlanningLogsRequest>(filters);
    const { instituteDetails } = useInstituteDetailsStore();

    const packageSessionOptions =
        instituteDetails?.batches_for_sessions?.map((batch) => ({
            id: batch.id, // Use 'id' instead of 'value' for FilterChips compatibility
            label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}`,
        })) || [];

    const logTypeOptions = [
        { id: 'planning', label: 'Planning' },
        { id: 'diary_log', label: 'Diary' },
    ];

    const intervalTypeOptions = [
        { id: 'daily', label: 'Daily' },
        { id: 'weekly', label: 'Day of week' },
        { id: 'monthly', label: 'Weekly' },
        { id: 'yearly_month', label: 'Monthly' },
        { id: 'yearly_quarter', label: 'Quarterly' },
    ];

    const statusOptions = [
        { id: 'ACTIVE', label: 'Active' },
        { id: 'DELETED', label: 'Deleted' },
    ];

    const handleApply = () => {
        onChange(localFilters);
    };

    const handleReset = () => {
        setLocalFilters({});
        onChange({});
    };

    const handleLogTypeChange = (option: { id: string; label: string }) => {
        const currentLogTypes = localFilters.log_types || [];
        const alreadyExists = currentLogTypes.includes(option.id as LogType);

        let updatedLogTypes: LogType[];
        if (alreadyExists) {
            updatedLogTypes = currentLogTypes.filter((type) => type !== option.id);
        } else {
            updatedLogTypes = [...currentLogTypes, option.id as LogType];
        }

        setLocalFilters({
            ...localFilters,
            log_types: updatedLogTypes.length > 0 ? updatedLogTypes : undefined,
        });
    };

    const handleClearLogTypeFilter = () => {
        setLocalFilters({ ...localFilters, log_types: undefined });
    };

    const handleIntervalTypeChange = (option: { id: string; label: string }) => {
        const currentIntervalTypes = localFilters.interval_types || [];
        const alreadyExists = currentIntervalTypes.includes(option.id as IntervalType);

        let updatedIntervalTypes: IntervalType[];
        if (alreadyExists) {
            updatedIntervalTypes = currentIntervalTypes.filter((type) => type !== option.id);
        } else {
            updatedIntervalTypes = [...currentIntervalTypes, option.id as IntervalType];
        }

        setLocalFilters({
            ...localFilters,
            interval_types: updatedIntervalTypes.length > 0 ? updatedIntervalTypes : undefined,
        });
    };

    const handleClearIntervalTypeFilter = () => {
        setLocalFilters({ ...localFilters, interval_types: undefined });
    };

    const handleStatusChange = (option: { id: string; label: string }) => {
        const currentStatuses = localFilters.statuses || [];
        const alreadyExists = currentStatuses.includes(option.id as PlanningLogStatus);

        let updatedStatuses: PlanningLogStatus[];
        if (alreadyExists) {
            updatedStatuses = currentStatuses.filter((status) => status !== option.id);
        } else {
            updatedStatuses = [...currentStatuses, option.id as PlanningLogStatus];
        }

        setLocalFilters({
            ...localFilters,
            statuses: updatedStatuses.length > 0 ? updatedStatuses : undefined,
        });
    };

    const handleClearStatusFilter = () => {
        setLocalFilters({ ...localFilters, statuses: undefined });
    };

    const handleCourseChange = (option: { id: string; label: string }) => {
        const currentEntityIds = localFilters.entity_ids || [];
        const alreadyExists = currentEntityIds.includes(option.id);

        let updatedEntityIds: string[];
        if (alreadyExists) {
            // Remove the option if it exists
            updatedEntityIds = currentEntityIds.filter((id) => id !== option.id);
        } else {
            // Add the option if it doesn't exist
            updatedEntityIds = [...currentEntityIds, option.id];
        }

        setLocalFilters({
            ...localFilters,
            entity_ids: updatedEntityIds.length > 0 ? updatedEntityIds : undefined,
        });
    };

    const handleClearCourseFilter = () => {
        setLocalFilters({ ...localFilters, entity_ids: undefined });
    };

    const handleIntervalTypeIdsChange = (intervalTypeIds: string[]) => {
        setLocalFilters({
            ...localFilters,
            interval_type_ids: intervalTypeIds.length > 0 ? intervalTypeIds : undefined,
        });
    };

    return (
        <>
            <div className="flex gap-2">
                {/* Log Type Filter - Only show if not hidden */}
                {!hideLogTypeFilter && (
                    <div className="space-y-2">
                        <FilterChips
                            label="Log Type"
                            filterList={logTypeOptions}
                            selectedFilters={
                                localFilters.log_types?.map((type) => ({
                                    id: type,
                                    label:
                                        logTypeOptions.find((opt) => opt.id === type)?.label ||
                                        type,
                                })) || []
                            }
                            handleSelect={handleLogTypeChange}
                            handleClearFilters={handleClearLogTypeFilter}
                        />
                    </div>
                )}

                {/* Interval Type Filter */}
                {logType === 'planning' && (
                    <FilterChips
                        label="Interval"
                        filterList={intervalTypeOptions.filter(
                            (opt) => logType === 'planning' && opt.id !== 'daily'
                        )}
                        selectedFilters={
                            localFilters.interval_types?.map((type) => ({
                                id: type,
                                label:
                                    intervalTypeOptions.find((opt) => opt.id === type)?.label ||
                                    type,
                            })) || []
                        }
                        handleSelect={handleIntervalTypeChange}
                        handleClearFilters={handleClearIntervalTypeFilter}
                    />
                )}

                {/* Interval Period Filter - Shows when interval types are selected */}
                {logType === 'planning' &&
                    localFilters.interval_types &&
                    localFilters.interval_types.length > 0 && (
                        <IntervalPeriodSelector
                            intervalTypes={localFilters.interval_types}
                            selectedIntervalTypeIds={localFilters.interval_type_ids || []}
                            onChange={handleIntervalTypeIdsChange}
                        />
                    )}

                {/* Status Filter */}

                {/* <FilterChips
                    label="Status"
                    filterList={statusOptions}
                    selectedFilters={
                        localFilters.statuses?.map((status) => ({
                            id: status,
                            label: statusOptions.find((opt) => opt.id === status)?.label || status,
                        })) || []
                    }
                    handleSelect={handleStatusChange}
                    handleClearFilters={handleClearStatusFilter}
                /> */}

                {/* Course Filter - Multiselect */}

                <FilterChips
                    label="Batch"
                    filterList={packageSessionOptions}
                    selectedFilters={
                        localFilters.entity_ids?.map((id) => {
                            const option = packageSessionOptions.find((opt) => opt.id === id);
                            return { id, label: option?.label || id };
                        }) || []
                    }
                    handleSelect={handleCourseChange}
                    handleClearFilters={handleClearCourseFilter}
                />
                <div className="flex items-center justify-end gap-2">
                    <MyButton buttonType="secondary" scale="small" onClick={handleReset}>
                        Reset
                    </MyButton>
                    <MyButton scale="small" onClick={handleApply}>
                        Apply Filters
                    </MyButton>
                </div>
            </div>
        </>
    );
}
