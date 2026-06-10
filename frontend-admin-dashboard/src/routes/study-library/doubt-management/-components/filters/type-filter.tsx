import SelectChips from '@/components/design-system/SelectChips';
import { useEffect, useMemo, useState } from 'react';
import { FilterType } from '../../-types/filter-type';
import { useDoubtFilters } from '../../-stores/filter-store';
import { useDoubtQueryTypes } from '../../-services/use-doubt-query-types';

const AllTypesOption: FilterType = { label: 'All', value: '' };

/**
 * Filters the unified inbox by configurable query type (Doubt, Technical Issue, Payment Issue, ...).
 * Options come from the institute's DOUBT_MANAGEMENT_SETTING.query_types. "All" clears the filter.
 */
export const TypeFilter = () => {
    const { updateFilters } = useDoubtFilters();
    const { enabledTypes } = useDoubtQueryTypes();

    const typeOptions = useMemo<FilterType[]>(
        () => [AllTypesOption, ...enabledTypes.map((t) => ({ label: t.label, value: t.key }))],
        [enabledTypes]
    );

    const [selectedTypes, setSelectedTypes] = useState<FilterType[]>([AllTypesOption]);

    const handleTypeChange = (next: FilterType[]) => {
        if (next.length === 0) {
            setSelectedTypes([AllTypesOption]);
            return;
        }
        const hadAll = selectedTypes.some((t) => t.value === '');
        const hasAll = next.some((t) => t.value === '');
        // Picking "All" collapses to All; picking a specific type drops "All".
        if (hasAll && !hadAll) {
            setSelectedTypes([AllTypesOption]);
        } else if (hasAll && next.length > 1) {
            setSelectedTypes(next.filter((t) => t.value !== ''));
        } else {
            setSelectedTypes(next);
        }
    };

    useEffect(() => {
        const keys = selectedTypes.map((t) => t.value).filter((v) => v !== ''); // "All" → no type filter
        updateFilters({ types: keys });
    }, [selectedTypes]);

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600">Type</span>
            <SelectChips
                options={typeOptions}
                selected={selectedTypes}
                onChange={handleTypeChange}
                multiSelect={true}
                hasClearFilter={false}
                className="min-w-40"
            />
        </div>
    );
};
