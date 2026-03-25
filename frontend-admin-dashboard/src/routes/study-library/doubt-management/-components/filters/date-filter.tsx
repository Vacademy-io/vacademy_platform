import { getDaysAgo, getTomorrow, getYesterday } from '@/utils/dateUtils';
import { FilterType } from '../../-types/filter-type';
import SelectChips from '@/components/design-system/SelectChips';
import { useEffect, useState } from 'react';
import { useDoubtFilters } from '../../-stores/filter-store';

function getDatesFromValue(value: string): [string, string] {
    const [startDate, endDate] = value.split(',');
    return [startDate || '', endDate || ''];
}

export const DateFilter = () => {
    const { updateFilters } = useDoubtFilters();

    const dateFilterList: FilterType[] = [
        {
            label: 'Today',
            value: [getYesterday(), getTomorrow()].join(','),
        },
        {
            label: 'This Week',
            value: [getDaysAgo(7), getTomorrow()].join(','),
        },
        {
            label: 'This Month',
            value: [getDaysAgo(30), getTomorrow()].join(','),
        },
        {
            label: 'This Year',
            value: [getDaysAgo(365), getTomorrow()].join(','),
        },
    ];

    const [selectedDate, setSelectedDate] = useState<FilterType[]>([dateFilterList[1]!]);

    const handleDateChange = (date: FilterType[]) => {
        setSelectedDate(date);
    };

    useEffect(() => {
        updateFilters({
            start_date: getDatesFromValue(selectedDate[0]!.value)[0],
            end_date: getDatesFromValue(selectedDate[0]!.value)[1],
        });
    }, [selectedDate]);

    return (
        <div className="flex items-center gap-2">
            <p>Date</p>
            <SelectChips
                options={dateFilterList}
                selected={selectedDate}
                onChange={handleDateChange}
                hasClearFilter={false}
                className="min-w-40"
            />
        </div>
    );
};
