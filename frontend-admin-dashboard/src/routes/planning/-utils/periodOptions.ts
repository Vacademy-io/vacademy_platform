import type { IntervalType } from '../-types/types';

export type PeriodOffset = 'current' | 'next' | 'previous';

export interface PeriodOption {
    id: string;
    label: string;
    offset: PeriodOffset;
}

/**
 * Get period options for a specific interval type
 */
export function getPeriodOptionsForIntervalType(intervalType: IntervalType): PeriodOption[] {
    switch (intervalType) {
        case 'daily':
            return [
                { id: 'today', label: 'Today', offset: 'current' },
                { id: 'tomorrow', label: 'Tomorrow', offset: 'next' },
                { id: 'yesterday', label: 'Yesterday', offset: 'previous' },
            ];
        case 'weekly':
            return [
                { id: 'today', label: 'Today', offset: 'current' },
                { id: 'tomorrow', label: 'Tomorrow', offset: 'next' },
                { id: 'yesterday', label: 'Yesterday', offset: 'previous' },
            ];
        case 'monthly':
            return [
                { id: 'this-week-month', label: 'This Week', offset: 'current' },
                { id: 'next-month', label: 'Next Month', offset: 'next' },
                { id: 'last-month', label: 'Last Month', offset: 'previous' },
            ];
        case 'yearly_month':
            return [
                { id: 'this-month', label: 'This Month', offset: 'current' },
                { id: 'next-month-year', label: 'Next Month', offset: 'next' },
                { id: 'last-month-year', label: 'Last Month', offset: 'previous' },
            ];
        case 'yearly_quarter':
            return [
                { id: 'this-quarter', label: 'This Quarter', offset: 'current' },
                { id: 'next-quarter', label: 'Next Quarter', offset: 'next' },
                { id: 'last-quarter', label: 'Last Quarter', offset: 'previous' },
            ];
        default:
            return [];
    }
}

/**
 * Calculate date for a specific period offset and interval type
 */
export function calculateDateForPeriod(intervalType: IntervalType, offset: PeriodOffset): Date {
    const today = new Date();

    switch (intervalType) {
        case 'daily':
            return calculateDailyDate(today, offset);
        case 'weekly':
            return calculateWeeklyDate(today, offset);
        case 'monthly':
            return calculateMonthlyDate(today, offset);
        case 'yearly_month':
            return calculateYearlyMonthDate(today, offset);
        case 'yearly_quarter':
            return calculateYearlyQuarterDate(today, offset);
        default:
            return today;
    }
}

/**
 * Calculate date for daily interval
 */
function calculateDailyDate(baseDate: Date, offset: PeriodOffset): Date {
    const date = new Date(baseDate);

    switch (offset) {
        case 'current':
            return date;
        case 'next':
            date.setDate(date.getDate() + 1);
            return date;
        case 'previous':
            date.setDate(date.getDate() - 1);
            return date;
    }
}

/**
 * Calculate date for weekly interval (daily offsets for day of week)
 */
function calculateWeeklyDate(baseDate: Date, offset: PeriodOffset): Date {
    const date = new Date(baseDate);

    switch (offset) {
        case 'current':
            return date;
        case 'next':
            date.setDate(date.getDate() + 1);
            return date;
        case 'previous':
            date.setDate(date.getDate() - 1);
            return date;
    }
}

/**
 * Calculate date for monthly interval (same week of month)
 */
function calculateMonthlyDate(baseDate: Date, offset: PeriodOffset): Date {
    const date = new Date(baseDate);

    switch (offset) {
        case 'current':
            return date;
        case 'next':
            date.setMonth(date.getMonth() + 1);
            return date;
        case 'previous':
            date.setMonth(date.getMonth() - 1);
            return date;
    }
}

/**
 * Calculate date for yearly month interval
 */
function calculateYearlyMonthDate(baseDate: Date, offset: PeriodOffset): Date {
    const date = new Date(baseDate);

    switch (offset) {
        case 'current':
            return date;
        case 'next':
            date.setMonth(date.getMonth() + 1);
            return date;
        case 'previous':
            date.setMonth(date.getMonth() - 1);
            return date;
    }
}

/**
 * Calculate date for yearly quarter interval
 */
function calculateYearlyQuarterDate(baseDate: Date, offset: PeriodOffset): Date {
    const date = new Date(baseDate);

    switch (offset) {
        case 'current':
            return date;
        case 'next':
            date.setMonth(date.getMonth() + 3);
            return date;
        case 'previous':
            date.setMonth(date.getMonth() - 3);
            return date;
    }
}
