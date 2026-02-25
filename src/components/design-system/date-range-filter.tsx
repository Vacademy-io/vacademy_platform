import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export type DateFilterType =
    | '1 Day'
    | '3 Days'
    | '7 Days'
    | '15 Days'
    | '30 Days'
    | 'Custom'
    | null;

export interface DateRangeResult {
    type: DateFilterType;
    startDate: string; // DD/MM/YYYY format
    endDate: string; // DD/MM/YYYY format
}

interface DateRangeFilterProps {
    onChange: (result: DateRangeResult | null) => void;
    defaultFilter?: DateFilterType;
    className?: string;
}

const FILTER_OPTIONS: Exclude<DateFilterType, null>[] = [
    '1 Day',
    '3 Days',
    '7 Days',
    '15 Days',
    '30 Days',
    'Custom',
];

export function DateRangeFilter({
    onChange,
    defaultFilter = null,
    className = '',
}: DateRangeFilterProps) {
    const [activeFilter, setActiveFilter] = useState<DateFilterType>(defaultFilter);

    // Internally, using YYYY-MM-DD for native input date pickers to work reliably
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    // Update parent only when valid range is set
    const updateParent = useCallback(
        (
            type: DateFilterType,
            startStr: string, // YYYY-MM-DD
            endStr: string // YYYY-MM-DD
        ) => {
            if (!type) {
                onChange(null);
                return;
            }

            // Return DD/MM/YYYY formats as strictly requested
            const formattedStart = startStr ? dayjs(startStr).format('DD/MM/YYYY') : '';
            const formattedEnd = endStr ? dayjs(endStr).format('DD/MM/YYYY') : '';

            onChange({
                type,
                startDate: formattedStart,
                endDate: formattedEnd,
            });
        },
        [onChange]
    );

    const handleQuickSelect = useCallback(
        (type: Exclude<DateFilterType, 'Custom' | null>) => {
            setActiveFilter(type);
            const end = dayjs().format('YYYY-MM-DD');
            let start = end;

            switch (type) {
                case '1 Day':
                    start = dayjs().format('YYYY-MM-DD');
                    break;
                case '3 Days':
                    start = dayjs().subtract(2, 'day').format('YYYY-MM-DD');
                    break;
                case '7 Days':
                    start = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
                    break;
                case '15 Days':
                    start = dayjs().subtract(14, 'day').format('YYYY-MM-DD');
                    break;
                case '30 Days':
                    start = dayjs().subtract(29, 'day').format('YYYY-MM-DD');
                    break;
            }

            setCustomStartDate(start);
            setCustomEndDate(end);
            updateParent(type, start, end);
        },
        [updateParent]
    );

    useEffect(() => {
        if (defaultFilter && defaultFilter !== 'Custom') {
            handleQuickSelect(defaultFilter as Exclude<DateFilterType, 'Custom' | null>);
        } else if (defaultFilter === 'Custom') {
            setActiveFilter('Custom');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCustomSelect = () => {
        setActiveFilter('Custom');
        // Do not update parent until start and end date are both selected
        if (customStartDate && customEndDate) {
            updateParent('Custom', customStartDate, customEndDate);
        } else {
            onChange(null); // Not fully selected yet
        }
    };

    const handleCustomDateChange = (isStart: boolean, value: string) => {
        // value is from native input type="date", so format is YYYY-MM-DD
        if (isStart) {
            setCustomStartDate(value);
            if (activeFilter === 'Custom' && value && customEndDate) {
                updateParent('Custom', value, customEndDate);
            }
        } else {
            setCustomEndDate(value);
            if (activeFilter === 'Custom' && customStartDate && value) {
                updateParent('Custom', customStartDate, value);
            }
        }
    };

    const handleClear = () => {
        if (defaultFilter) {
            if (defaultFilter !== 'Custom') {
                handleQuickSelect(defaultFilter as Exclude<DateFilterType, 'Custom' | null>);
            } else {
                setActiveFilter('Custom');
                setCustomStartDate('');
                setCustomEndDate('');
                onChange(null);
            }
        } else {
            setActiveFilter(null);
            setCustomStartDate('');
            setCustomEndDate('');
            updateParent(null, '', '');
        }
    };

    // Determine if we should show the clear button
    const isFilterActive =
        defaultFilter === null
            ? activeFilter !== null // If no default, show if any filter is active
            : activeFilter !== defaultFilter || // If default exists, show if current differs from default
            (activeFilter === 'Custom' && (customStartDate !== '' || customEndDate !== '')); // OR if it's 'Custom' and user entered dates

    return (
        <div className={`flex flex-col gap-4 w-full ${className}`}>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
                {FILTER_OPTIONS.map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() =>
                            option === 'Custom'
                                ? handleCustomSelect()
                                : handleQuickSelect(option as Exclude<DateFilterType, 'Custom' | null>)
                        }
                        className={`rounded-full px-3 py-1.5 sm:px-4 text-[13px] sm:text-sm font-medium transition-colors border ${activeFilter === option
                                ? 'bg-primary-500 text-white border-primary-500 shadow-sm hover:bg-primary-600'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
                            }`}
                        // Backup contrast color exactly as a final fallback
                        style={{
                            color: activeFilter === option ? '#ffffff' : '#374151',
                        }}
                    >
                        {option}
                    </button>
                ))}

                {isFilterActive && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="rounded-md bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-[13px] sm:text-sm font-semibold hover:bg-red-100 hover:text-red-700 transition-colors focus:outline-none flex-shrink-0"
                    >
                        Clear Filter
                    </button>
                )}
            </div>

            {/* Displaying selected date range text with explicitly requested DD/MM/YYYY formatting */}
            {activeFilter && activeFilter !== 'Custom' && customStartDate && customEndDate && (
                <div className="text-[13px] sm:text-sm text-neutral-600 px-3 py-2 font-medium bg-neutral-50 rounded-md border border-neutral-200 w-full sm:w-fit inline-flex flex-wrap items-center gap-1 sm:gap-1.5 shadow-sm">
                    <span className="text-neutral-500 whitespace-nowrap">Selected Range:</span>
                    <span className="text-primary-600 font-semibold whitespace-nowrap">{dayjs(customStartDate).format('DD/MM/YYYY')}</span>
                    <span className="text-neutral-400 whitespace-nowrap">—</span>
                    <span className="text-primary-600 font-semibold whitespace-nowrap">{dayjs(customEndDate).format('DD/MM/YYYY')}</span>
                </div>
            )}

            {/* Extra padding and smooth transition to render Custom Pickers */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out w-full ${activeFilter === 'Custom' ? 'max-h-[300px] opacity-100 mt-2' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end w-full rounded-md border border-neutral-100 bg-neutral-50/50 p-3 shadow-sm">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-semibold text-neutral-700 mb-1.5 block uppercase tracking-wider">
                            Start Date <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-shadow text-neutral-800"
                            type="date"
                            value={customStartDate}
                            onChange={(e) => handleCustomDateChange(true, e.target.value)}
                            data-date-format="DD/MM/YYYY"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs font-semibold text-neutral-700 mb-1.5 block uppercase tracking-wider">
                            End Date <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-shadow text-neutral-800"
                            type="date"
                            value={customEndDate}
                            min={customStartDate} // end date cannot be before start date ideally
                            onChange={(e) => handleCustomDateChange(false, e.target.value)}
                            data-date-format="DD/MM/YYYY"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DateRangeFilter;
