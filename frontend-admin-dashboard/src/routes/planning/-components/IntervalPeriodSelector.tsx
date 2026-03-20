import { useMemo } from 'react';
import type { IntervalType } from '../-types/types';
import { FilterChips } from '@/components/design-system/chips';
import { getPeriodOptionsForIntervalType, calculateDateForPeriod } from '../-utils/periodOptions';
import { useGenerateIntervalTypeId } from '../-services/generateIntervalTypeId';

interface IntervalPeriodSelectorProps {
    intervalTypes: IntervalType[];
    selectedIntervalTypeIds: string[];
    onChange: (intervalTypeIds: string[]) => void;
}

interface PeriodData {
    id: string;
    label: string;
    intervalType: IntervalType;
    date: Date;
}

// Helper component to fetch a single interval type ID
function usePeriodIntervalId(period: PeriodData | null) {
    return useGenerateIntervalTypeId(
        period ? { intervalType: period.intervalType, date: period.date } : null
    );
}

export default function IntervalPeriodSelector({
    intervalTypes,
    selectedIntervalTypeIds,
    onChange,
}: IntervalPeriodSelectorProps) {
    // Build periods data from selected interval types
    const periodsData = useMemo(() => {
        const allPeriodsData: PeriodData[] = [];

        intervalTypes.forEach((intervalType) => {
            const options = getPeriodOptionsForIntervalType(intervalType);
            options.forEach((option) => {
                const date = calculateDateForPeriod(intervalType, option.offset);
                allPeriodsData.push({
                    id: `${intervalType}_${option.id}`,
                    label: option.label,
                    intervalType,
                    date,
                });
            });
        });

        return allPeriodsData;
    }, [intervalTypes]);

    // Fetch interval type IDs for all periods (max 15 periods: 5 interval types * 3 options each)
    const period0 = periodsData[0] || null;
    const period1 = periodsData[1] || null;
    const period2 = periodsData[2] || null;
    const period3 = periodsData[3] || null;
    const period4 = periodsData[4] || null;
    const period5 = periodsData[5] || null;
    const period6 = periodsData[6] || null;
    const period7 = periodsData[7] || null;
    const period8 = periodsData[8] || null;
    const period9 = periodsData[9] || null;
    const period10 = periodsData[10] || null;
    const period11 = periodsData[11] || null;
    const period12 = periodsData[12] || null;
    const period13 = periodsData[13] || null;
    const period14 = periodsData[14] || null;

    const { data: id0 } = usePeriodIntervalId(period0);
    const { data: id1 } = usePeriodIntervalId(period1);
    const { data: id2 } = usePeriodIntervalId(period2);
    const { data: id3 } = usePeriodIntervalId(period3);
    const { data: id4 } = usePeriodIntervalId(period4);
    const { data: id5 } = usePeriodIntervalId(period5);
    const { data: id6 } = usePeriodIntervalId(period6);
    const { data: id7 } = usePeriodIntervalId(period7);
    const { data: id8 } = usePeriodIntervalId(period8);
    const { data: id9 } = usePeriodIntervalId(period9);
    const { data: id10 } = usePeriodIntervalId(period10);
    const { data: id11 } = usePeriodIntervalId(period11);
    const { data: id12 } = usePeriodIntervalId(period12);
    const { data: id13 } = usePeriodIntervalId(period13);
    const { data: id14 } = usePeriodIntervalId(period14);

    // Create map of period ID to interval type ID
    const generatedIds = useMemo(() => {
        const map = new Map<string, string>();
        const ids = [
            id0,
            id1,
            id2,
            id3,
            id4,
            id5,
            id6,
            id7,
            id8,
            id9,
            id10,
            id11,
            id12,
            id13,
            id14,
        ];

        periodsData.forEach((period, index) => {
            const intervalTypeId = ids[index];
            if (intervalTypeId) {
                map.set(period.id, intervalTypeId);
            }
        });

        return map;
    }, [
        periodsData,
        id0,
        id1,
        id2,
        id3,
        id4,
        id5,
        id6,
        id7,
        id8,
        id9,
        id10,
        id11,
        id12,
        id13,
        id14,
    ]);

    // Convert period selections to interval type IDs
    const handleSelect = (option: { id: string; label: string }) => {
        const intervalTypeId = generatedIds.get(option.id);
        if (!intervalTypeId) return;

        const isSelected = selectedIntervalTypeIds.includes(intervalTypeId);
        let updatedIds: string[];

        if (isSelected) {
            updatedIds = selectedIntervalTypeIds.filter((id) => id !== intervalTypeId);
        } else {
            updatedIds = [...selectedIntervalTypeIds, intervalTypeId];
        }

        onChange(updatedIds);
    };

    const handleClearFilters = () => {
        onChange([]);
    };

    // Convert interval type IDs back to period options for display
    const selectedPeriods = periodsData
        .filter((period) => {
            const intervalTypeId = generatedIds.get(period.id);
            return intervalTypeId && selectedIntervalTypeIds.includes(intervalTypeId);
        })
        .map((period) => ({
            id: period.id,
            label: period.label,
        }));

    // Don't show if no interval types selected or no periods available
    if (intervalTypes.length === 0 || periodsData.length === 0) {
        return null;
    }

    return (
        <FilterChips
            label="Period"
            filterList={periodsData.map((p) => ({ id: p.id, label: p.label }))}
            selectedFilters={selectedPeriods}
            handleSelect={handleSelect}
            handleClearFilters={handleClearFilters}
        />
    );
}
