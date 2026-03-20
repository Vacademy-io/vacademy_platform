import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarBlank, ArrowsClockwise } from '@phosphor-icons/react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { DayTemplates } from '@/types/challenge-analytics';

interface AnalyticsFiltersProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    templates: DayTemplates[];
    selectedTemplates: string[];
    onTemplatesChange: (templates: string[]) => void;
    isLoading: boolean;
    onRefresh: () => void;
}

const quickFilterOptions = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 },
];

export function AnalyticsFilters({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    isLoading,
    onRefresh,
}: AnalyticsFiltersProps) {
    const [startOpen, setStartOpen] = useState(false);
    const [endOpen, setEndOpen] = useState(false);

    const handleQuickFilter = (days: number) => {
        const end = new Date();
        const start = subDays(end, days);
        onStartDateChange(format(start, "yyyy-MM-dd'T'HH:mm:ss"));
        onEndDateChange(format(end, "yyyy-MM-dd'T'HH:mm:ss"));
    };

    const handleThisMonth = () => {
        const now = new Date();
        onStartDateChange(format(startOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss"));
        onEndDateChange(format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss"));
    };

    const handleLastMonth = () => {
        const lastMonth = subMonths(new Date(), 1);
        onStartDateChange(format(startOfMonth(lastMonth), "yyyy-MM-dd'T'HH:mm:ss"));
        onEndDateChange(format(endOfMonth(lastMonth), "yyyy-MM-dd'T'HH:mm:ss"));
    };

    return (
        <Card className="mb-4 border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4">
                {/* Row 1: Date Range and Quick Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Filters */}
                    <div className="flex items-center gap-2">
                        <Popover open={startOpen} onOpenChange={setStartOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2 text-sm">
                                    <CalendarBlank className="size-4" />
                                    {startDate
                                        ? format(new Date(startDate), 'MMM dd, yyyy')
                                        : 'Start Date'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={startDate ? new Date(startDate) : undefined}
                                    onSelect={(date) => {
                                        if (date) {
                                            onStartDateChange(
                                                format(date, "yyyy-MM-dd'T'HH:mm:ss")
                                            );
                                            setStartOpen(false);
                                        }
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <span className="text-gray-400">to</span>

                        <Popover open={endOpen} onOpenChange={setEndOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2 text-sm">
                                    <CalendarBlank className="size-4" />
                                    {endDate
                                        ? format(new Date(endDate), 'MMM dd, yyyy')
                                        : 'End Date'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={endDate ? new Date(endDate) : undefined}
                                    onSelect={(date) => {
                                        if (date) {
                                            onEndDateChange(format(date, "yyyy-MM-dd'T'HH:mm:ss"));
                                            setEndOpen(false);
                                        }
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Quick Filter Buttons */}
                    <div className="hidden items-center gap-2 lg:flex">
                        <span className="text-xs text-gray-500">Quick:</span>
                        {quickFilterOptions.map((option) => (
                            <Button
                                key={option.days}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleQuickFilter(option.days)}
                            >
                                {option.label}
                            </Button>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={handleThisMonth}
                        >
                            This Month
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={handleLastMonth}
                        >
                            Last Month
                        </Button>
                    </div>

                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="ml-auto gap-2"
                    >
                        <ArrowsClockwise className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>
        </Card>
    );
}
