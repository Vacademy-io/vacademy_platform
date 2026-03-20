import { MyInput } from '@/components/design-system/input';
import { MyDropdown } from '@/components/design-system/dropdown';
import type { IntervalType } from '../-types/types';

interface IntervalSelectorProps {
    intervalType: IntervalType;
    selectedDate: Date | null;
    onChange: (date: Date) => void;
}

export default function IntervalSelector({
    intervalType,
    selectedDate,
    onChange,
}: IntervalSelectorProps) {
    const formatDateForInput = (date: Date | null): string => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value ? new Date(e.target.value) : new Date();
        onChange(date);
    };

    // Daily: Date picker
    if (intervalType === 'daily') {
        return (
            <MyInput
                label="Select Date"
                required
                inputType="date"
                inputPlaceholder=""
                input={formatDateForInput(selectedDate)}
                onChangeFunction={handleDateChange}
                className="w-full"
                size="medium"
            />
        );
    }

    // Weekly (Day): Day of week selector
    if (intervalType === 'weekly') {
        const daysOfWeek = [
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
            { label: 'Sunday', value: '0' },
        ];

        const currentDay = selectedDate ? selectedDate.getDay().toString() : '1';
        const currentDayLabel = daysOfWeek.find((d) => d.value === currentDay)?.label || 'Monday';

        const handleDayChange = (value: string) => {
            const dayOfWeek = parseInt(value);
            const today = new Date();
            const currentDayOfWeek = today.getDay();
            const diff = dayOfWeek - currentDayOfWeek;
            const newDate = new Date(today);
            newDate.setDate(today.getDate() + diff);
            onChange(newDate);
        };

        return (
            <MyDropdown
                currentValue={currentDayLabel}
                handleChange={handleDayChange}
                dropdownList={daysOfWeek}
                placeholder="Select day"
                className="w-full"
            />
        );
    }

    // Monthly (Week of Month): Date picker
    if (intervalType === 'monthly') {
        return (
            <MyInput
                label="Select Date"
                required
                inputType="date"
                inputPlaceholder=""
                input={formatDateForInput(selectedDate)}
                onChangeFunction={handleDateChange}
                className="w-full"
                size="medium"
            />
        );
    }

    // Yearly Month: Month selector
    if (intervalType === 'yearly_month') {
        const months = [
            { label: 'January', value: '0' },
            { label: 'February', value: '1' },
            { label: 'March', value: '2' },
            { label: 'April', value: '3' },
            { label: 'May', value: '4' },
            { label: 'June', value: '5' },
            { label: 'July', value: '6' },
            { label: 'August', value: '7' },
            { label: 'September', value: '8' },
            { label: 'October', value: '9' },
            { label: 'November', value: '10' },
            { label: 'December', value: '11' },
        ];

        const currentMonth = selectedDate ? selectedDate.getMonth().toString() : '0';
        const currentMonthLabel = months.find((m) => m.value === currentMonth)?.label || 'January';

        const handleMonthChange = (value: string) => {
            const month = parseInt(value);
            const newDate = new Date();
            newDate.setMonth(month);
            newDate.setDate(1); // Set to first day of month
            onChange(newDate);
        };

        return (
            <MyDropdown
                currentValue={currentMonthLabel}
                handleChange={handleMonthChange}
                dropdownList={months}
                placeholder="Select month"
                className="w-full"
            />
        );
    }

    // Yearly Quarter: Quarter selector
    if (intervalType === 'yearly_quarter') {
        const quarters = [
            { label: 'Q1 (Jan - Mar)', value: '0' },
            { label: 'Q2 (Apr - Jun)', value: '1' },
            { label: 'Q3 (Jul - Sep)', value: '2' },
            { label: 'Q4 (Oct - Dec)', value: '3' },
        ];

        const currentQuarter = selectedDate
            ? Math.floor(selectedDate.getMonth() / 3).toString()
            : '0';
        const currentQuarterLabel =
            quarters.find((q) => q.value === currentQuarter)?.label || 'Q1 (Jan - Mar)';

        const handleQuarterChange = (value: string) => {
            const quarter = parseInt(value);
            const newDate = new Date();
            newDate.setMonth(quarter * 3); // Set to first month of quarter
            newDate.setDate(1);
            onChange(newDate);
        };

        return (
            <MyDropdown
                currentValue={currentQuarterLabel}
                handleChange={handleQuarterChange}
                dropdownList={quarters}
                placeholder="Select quarter"
                className="w-full"
            />
        );
    }

    // Default fallback
    return (
        <MyInput
            label="Select Date"
            required
            inputType="date"
            inputPlaceholder=""
            input={formatDateForInput(selectedDate)}
            onChangeFunction={handleDateChange}
            className="w-full"
            size="medium"
        />
    );
}
