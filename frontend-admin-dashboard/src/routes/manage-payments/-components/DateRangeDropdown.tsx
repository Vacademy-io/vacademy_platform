import { useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarBlank, CaretDown, Check } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    PRESET_OPTIONS,
    customRange,
    formatRangeLabel,
    isRangeActive,
    rangeDates,
    resolvePreset,
    type DateRangeValue,
} from '../-utils/dateRange';

interface DateRangeDropdownProps {
    value: DateRangeValue;
    onChange: (value: DateRangeValue) => void;
    /** Popover alignment against the trigger. */
    align?: 'start' | 'center' | 'end';
    className?: string;
}

/**
 * One-click date window: the current range is printed on the trigger, and the whole preset list
 * (plus a custom two-date calendar) is one click away. This sits in the page toolbar precisely so
 * changing the period never means opening the filters panel first.
 */
export function DateRangeDropdown({
    value,
    onChange,
    align = 'start',
    className,
}: DateRangeDropdownProps) {
    const [open, setOpen] = useState(false);
    const [showCalendar, setShowCalendar] = useState(value.preset === 'custom');
    const [draft, setDraft] = useState<DateRange | undefined>(() => rangeDates(value));

    // Re-seed the calendar whenever the popover reopens, so it always reflects what's applied.
    useEffect(() => {
        if (open) {
            setShowCalendar(value.preset === 'custom');
            setDraft(rangeDates(value));
        }
    }, [open, value]);

    const active = isRangeActive(value);

    const applyPreset = (key: Exclude<DateRangeValue['preset'], 'custom'>) => {
        onChange(resolvePreset(key));
        setOpen(false);
    };

    const applyCustom = () => {
        if (!draft?.from) return;
        onChange(customRange(draft.from, draft.to ?? draft.from));
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        'h-9 gap-2 font-medium',
                        active && 'border-primary-500 bg-primary-50 text-primary-600',
                        className
                    )}
                >
                    <CalendarBlank size={16} weight={active ? 'fill' : 'regular'} />
                    {formatRangeLabel(value)}
                    <CaretDown size={12} weight="bold" className="opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align={align} className={cn('w-56 p-0', showCalendar && 'w-80')}>
                <div className="flex flex-col p-1.5">
                    {PRESET_OPTIONS.map((option) => {
                        const isActive = value.preset === option.key;
                        return (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => applyPreset(option.key)}
                                className={cn(
                                    'flex items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-left text-body transition-colors',
                                    isActive
                                        ? 'bg-primary-50 font-medium text-primary-600'
                                        : 'text-neutral-700 hover:bg-neutral-50'
                                )}
                            >
                                {option.label}
                                {isActive && <Check size={14} weight="bold" />}
                            </button>
                        );
                    })}

                    <div className="my-1 h-px bg-neutral-200" />

                    <button
                        type="button"
                        onClick={() => setShowCalendar((prev) => !prev)}
                        className={cn(
                            'flex items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-left text-body transition-colors',
                            value.preset === 'custom'
                                ? 'bg-primary-50 font-medium text-primary-600'
                                : 'text-neutral-700 hover:bg-neutral-50'
                        )}
                        aria-expanded={showCalendar}
                    >
                        Custom range
                        {value.preset === 'custom' ? (
                            <Check size={14} weight="bold" />
                        ) : (
                            <CaretDown
                                size={12}
                                weight="bold"
                                className={cn(
                                    'opacity-60 transition-transform',
                                    showCalendar && 'rotate-180'
                                )}
                            />
                        )}
                    </button>
                </div>

                {showCalendar && (
                    <div className="border-t border-neutral-200 p-2">
                        <Calendar
                            mode="range"
                            selected={draft}
                            onSelect={setDraft}
                            defaultMonth={draft?.from ?? new Date()}
                            numberOfMonths={1}
                            className="p-0"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-neutral-200 pt-2">
                            <span className="text-caption text-neutral-500">
                                {draft?.from
                                    ? formatRangeLabel(
                                          customRange(draft.from, draft.to ?? draft.from)
                                      )
                                    : 'Pick a start and end date'}
                            </span>
                            <Button
                                size="sm"
                                className="h-7"
                                disabled={!draft?.from}
                                onClick={applyCustom}
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
