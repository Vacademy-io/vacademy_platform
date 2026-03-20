import SelectChips from '@/components/design-system/SelectChips';
import { useEffect, useState } from 'react';
import { FilterType } from '../../-types/filter-type';
import { useDoubtFilters } from '../../-stores/filter-store';

export const StatusFilter = () => {
    const { updateFilters } = useDoubtFilters();

    const statusFilterList: FilterType[] = [
        {
            label: 'All',
            value: 'ACTIVE,RESOLVED',
        },
        {
            label: 'Resolved',
            value: 'RESOLVED',
        },
        {
            label: 'Unresolved',
            value: 'ACTIVE',
        },
    ];

    const [selectedStatus, setSelectedStatus] = useState([statusFilterList[0]!]);

    const handleStatusChange = (status: FilterType[]) => {
        setSelectedStatus(status);
    };

    useEffect(() => {
        updateFilters({
            status: selectedStatus.flatMap((status) => status.value.split(',')),
        });
    }, [selectedStatus]);

    return (
        <div className="flex items-center gap-2">
            <p>Status</p>
            <SelectChips
                options={statusFilterList}
                selected={selectedStatus}
                onChange={handleStatusChange}
                hasClearFilter={false}
                className="min-w-40"
            />
        </div>
    );
};
