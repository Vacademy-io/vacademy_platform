import { FilterChips } from '@/components/design-system/chips';
import {
    FilterId,
    FilterProps,
} from '@/routes/manage-students/students-list/-types/students-list-types';
import { useEffect, useState } from 'react';

type SelectedFilterListType = Record<FilterId, { id: string; label: string }[]>;

export const Filters = ({
    filterDetails,
    onFilterChange,
    clearFilters,
    filterId,
    columnFilters,
}: FilterProps) => {
    const [selectedFilterList, setSelectedFilterList] = useState<SelectedFilterListType>({
        session: [],
        batch: [],
        statuses: [],
        gender: [],
        session_expiry_days: [],
    });

    const handleSelectDeSelect = (option: { id: string; label: string }) => {
        let updatedValue: { id: string; label: string }[] = [];
        const existingFilter = columnFilters?.find((filter) => filter.id === filterId);

        if (existingFilter) {
            const alreadyExists = existingFilter.value.some((filter) => filter.id === option.id);
            if (alreadyExists) {
                // Remove the option if it exists
                updatedValue = existingFilter.value.filter((filter) => filter.id !== option.id);
            } else {
                // Add the option if it doesn't exist
                updatedValue = [...existingFilter.value, option];
            }
        } else {
            // If no filter exists for this ID, create a new one with just this option
            updatedValue = [option];
        }

        // Update the local state
        setSelectedFilterList((prev) => ({
            ...prev,
            [filterId]: updatedValue,
        }));

        // Notify parent component of the change
        if (onFilterChange) {
            onFilterChange(updatedValue);
        }
    };

    const handleClearFilters = () => {
        setSelectedFilterList((prev) => ({
            ...prev,
            [filterId]: [],
        }));

        if (onFilterChange) {
            onFilterChange([]);
        }
    };

    useEffect(() => {
        if (onFilterChange) {
            // If this is a session expiry filter, extract only the numbers
            if (filterDetails.label === 'Session Expiry') {
                const processedValues = selectedFilterList[filterId].map((filter) => {
                    const numberMatch = filter.label.match(/\d+/);
                    return numberMatch ? { id: filter.id, label: numberMatch[0] } : filter;
                });
                onFilterChange(processedValues);
            } else {
                onFilterChange(selectedFilterList[filterId]);
            }
        }
    }, [selectedFilterList[filterId], filterDetails.label]);

    return (
        <FilterChips
            label={filterDetails.label}
            filterList={filterDetails.filters}
            selectedFilters={selectedFilterList[filterId]}
            clearFilters={clearFilters}
            handleSelect={handleSelectDeSelect}
            handleClearFilters={handleClearFilters}
        />
    );
};
